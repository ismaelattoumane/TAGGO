import { isValidDestinationUrl, sanitizeText } from '../../lib/validators'
import { buildTagCode } from './tagCode'
import { LEGACY_SEED_ALIASES, newPrivateId, readStore, toRecord, writeStore } from './qrStore'
import type { StoredQr } from './qrStore'
import type { QrRepository } from './QrRepository'
import type { CreateQrInput, PublicTaggoState, QrRecord, UpdateQrInput } from './qrTypes'
import { toPublicTaggoProfile, type PublicProfileInput, type PublicProfileRecord, type PublicTaggoProfile } from './publicProfile'
import { assertTaggoTransition } from './taggoLifecycle'
import {
  localSubscriptionAllowsPublic,
  readLocalSubscriptions,
  sweepLocalSubscriptions,
} from './localSubscriptionStore'
import type { TaggoLifecycleStatus } from './qrTypes'

const PROFILE_STORAGE_KEY = 'taggo-demo-public-profiles'

function readProfiles(): Record<string, PublicProfileRecord> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    return raw ? JSON.parse(raw) as Record<string, PublicProfileRecord> : {}
  } catch {
    return {}
  }
}

function writeProfiles(profiles: Record<string, PublicProfileRecord>): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles))
}

/**
 * LocalStorage-backed QrRepository.
 * Pages must use `qrRepository` instead of importing `demoData.ts`.
 */
export class LocalQrRepository implements QrRepository {
  list(ownerId?: string): QrRecord[] {
    const qrs = readStore()
    const scoped = ownerId ? qrs.filter((qr) => qr.ownerId === ownerId) : qrs
    return scoped.map(toRecord)
  }

  getById(id: string, ownerId?: string): QrRecord | null {
    const qr = readStore().find((item) => item.id === id) ?? null
    if (!qr) return null
    if (ownerId && qr.ownerId !== ownerId) return null
    return toRecord(qr)
  }

  getByPublicId(publicId: string): QrRecord | null {
    const normalized = publicId.trim().toUpperCase()
    const qrs = readStore()
    const direct = qrs.find((qr) => qr.publicId.toUpperCase() === normalized) ?? null
    if (direct) return toRecord(direct)
    const aliased = LEGACY_SEED_ALIASES[normalized]
    if (!aliased) return null
    const qr = qrs.find((item) => item.publicId === aliased) ?? null
    return qr ? toRecord(qr) : null
  }

  create(input: CreateQrInput): QrRecord {
    const title = sanitizeText(input.title).slice(0, 80)
    const destinationUrl = input.destinationUrl.trim()
    if (!title || !isValidDestinationUrl(destinationUrl)) {
      throw new Error('Titre ou destination QR invalide.')
    }
    const qrs = readStore()
    const existingCodes = new Set(qrs.map((qr) => qr.publicId))
    let publicId = buildTagCode()
    while (existingCodes.has(publicId)) {
      publicId = buildTagCode()
    }
    const now = new Date().toISOString()
    const record: StoredQr = {
      id: newPrivateId(),
      publicId,
      title,
      destinationUrl,
      status: 'draft',
      lifecycleStatus: 'activated',
      ownerId: input.ownerId,
      createdAt: now,
      updatedAt: now,
    }
    qrs.push(record)
    writeStore(qrs)
    return toRecord(record)
  }

  update(id: string, updates: UpdateQrInput, ownerId?: string): QrRecord | null {
    const qrs = readStore()
    const index = qrs.findIndex((qr) => qr.id === id)
    if (index === -1) return null
    const current = qrs[index]
    if (ownerId && current.ownerId !== ownerId) return null
    const title = updates.title !== undefined ? sanitizeText(updates.title).slice(0, 80) : current.title
    const destinationUrl =
      updates.destinationUrl !== undefined ? updates.destinationUrl.trim() : current.destinationUrl
    if (!title || !isValidDestinationUrl(destinationUrl)) {
      throw new Error('Mise à jour QR invalide.')
    }
    const currentLifecycle = current.lifecycleStatus ?? 'activated'
    const nextLifecycleStatus = updates.status === 'active'
      ? 'active'
      : updates.status === 'inactive'
        ? 'inactive'
        : currentLifecycle
    if (nextLifecycleStatus !== currentLifecycle) {
      assertTaggoTransition(currentLifecycle, nextLifecycleStatus)
    }
    const updated: StoredQr = {
      ...current,
      title,
      destinationUrl,
      status: updates.status ?? current.status,
      lifecycleStatus: nextLifecycleStatus,
      updatedAt: new Date().toISOString(),
    }
    qrs[index] = updated
    writeStore(qrs)
    return toRecord(updated)
  }

  remove(id: string, ownerId?: string): boolean {
    const qrs = readStore()
    const index = qrs.findIndex((qr) => qr.id === id)
    if (index === -1) return false
    if (ownerId && qrs[index].ownerId !== ownerId) return false
    qrs.splice(index, 1)
    writeStore(qrs)
    return true
  }

  getPublicTaggoProfile(publicId: string): PublicTaggoProfile | null {
    const qr = this.getByPublicId(publicId)
    if (!qr || qr.status !== 'active' || !qr.destinationUrl) return null
    return toPublicTaggoProfile(qr, readProfiles()[qr.id])
  }

  getPublicTaggoStatus(publicId: string): QrRecord['status'] | null {
    return this.getByPublicId(publicId)?.status ?? null
  }

  getPublicTaggoState(publicId: string): PublicTaggoState {
    const qr = this.getByPublicId(publicId)
    if (!qr) return 'not_found'

    // ETAPE 12 — ordre de priorite identique a `get_public_taggo_state` :
    //   1. periode echue        -> expired
    //   2. cycle de vie avant `active` -> unactivated (« pas encore active » est
    //      plus exact que « pas d'abonnement » : le visiteur a une action a faire)
    //   3. actif SANS periode   -> subscription_required
    //   4. actif AVEC periode   -> active
    //   5. sinon                -> unavailable
    //
    // Le balayage est declenche avant le calcul, comme en base. Il est
    // volontairement sans effet sur le resultat : la visibilite depend
    // directement de `endsAt`, donc une periode echue est deja bloquee meme si le
    // balayage n'a pas tourne.
    sweepLocalSubscriptions()

    const subscription = readLocalSubscriptions()[qr.id]
    const allowsPublic = localSubscriptionAllowsPublic(subscription)

    // Une periode existe et elle est echue : c'est une EXPIRATION.
    if (!allowsPublic && subscription) return 'expired'
    // Cycle de vie anterieur a `active` : actionnable par le visiteur.
    if (
      qr.lifecycleStatus === 'available'
      || qr.lifecycleStatus === 'reserved'
      || qr.lifecycleStatus === 'assigned'
      || qr.lifecycleStatus === 'activated'
    ) {
      return 'unactivated'
    }
    // Aucune periode : l'acces est refuse, et ce n'est PAS une expiration.
    if (!allowsPublic) return 'subscription_required'
    if (qr.status === 'active' && qr.lifecycleStatus === 'active') return 'active'
    return 'unavailable'
  }

  assignTagToUser(id: string, ownerId: string): QrRecord | null {
    const qrs = readStore()
    const index = qrs.findIndex((item) => item.id === id)
    if (index === -1) return null
    const current = qrs[index]
    if (current.ownerId) return null
    if (current.lifecycleStatus !== 'available' && current.lifecycleStatus !== 'reserved') return null
    const now = new Date().toISOString()
    qrs[index] = {
      ...current,
      ownerId,
      lifecycleStatus: 'assigned',
      assignedAt: now,
      updatedAt: now,
    }
    writeStore(qrs)
    return toRecord(qrs[index])
  }

  activate(publicId: string, ownerId: string): QrRecord | null {
    const qr = this.getByPublicId(publicId)
    if (!qr || qr.lifecycleStatus !== 'assigned' || (qr.ownerId && qr.ownerId !== ownerId)) return null
    const qrs = readStore()
    const index = qrs.findIndex((item) => item.id === qr.id)
    if (index === -1) return null
    const now = new Date().toISOString()
    qrs[index] = {
      ...qrs[index],
      ownerId,
      lifecycleStatus: 'activated',
      status: 'draft',
      activatedAt: now,
      updatedAt: now,
    }
    writeStore(qrs)
    return toRecord(qrs[index])
  }

  getPublicProfile(qrId: string, ownerId?: string): PublicProfileRecord | null {
    if (!this.getById(qrId, ownerId)) return null
    return readProfiles()[qrId] ?? null
  }

  savePublicProfile(qrId: string, input: PublicProfileInput, ownerId?: string): PublicProfileRecord | null {
    if (!this.getById(qrId, ownerId)) return null
    const profiles = readProfiles()
    profiles[qrId] = input
    writeProfiles(profiles)
    return input
  }

  transition(id: string, to: TaggoLifecycleStatus, ownerId?: string): QrRecord | null {
    const qrs = readStore()
    const index = qrs.findIndex((item) => item.id === id)
    if (index === -1) return null
    const current = qrs[index]
    if (ownerId && current.ownerId !== ownerId) return null
    assertTaggoTransition(current.lifecycleStatus, to)
    const now = new Date().toISOString()
    qrs[index] = {
      ...current,
      lifecycleStatus: to,
      status: to === 'active' ? 'active' : to === 'inactive' ? 'inactive' : current.status,
      reservedAt: to === 'reserved' ? current.reservedAt ?? now : current.reservedAt,
      assignedAt: to === 'assigned' ? current.assignedAt ?? now : current.assignedAt,
      activatedAt: to === 'activated' ? current.activatedAt ?? now : current.activatedAt,
      updatedAt: now,
    }
    writeStore(qrs)
    return toRecord(qrs[index])
  }
}

