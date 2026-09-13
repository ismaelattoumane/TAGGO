import { isValidDestinationUrl, sanitizeText } from '../../lib/validators'
import { buildTagCode } from './tagCode'
import { LEGACY_SEED_ALIASES, newPrivateId, readStore, toRecord, writeStore } from './qrStore'
import type { StoredQr } from './qrStore'
import type { QrRepository } from './QrRepository'
import type { CreateQrInput, QrRecord, UpdateQrInput } from './qrTypes'
import { toPublicTaggoProfile, type PublicProfileInput, type PublicProfileRecord, type PublicTaggoProfile } from './publicProfile'

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
    const updated: StoredQr = {
      ...current,
      title,
      destinationUrl,
      status: updates.status ?? current.status,
      ownerId: updates.ownerId ?? current.ownerId,
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
}

