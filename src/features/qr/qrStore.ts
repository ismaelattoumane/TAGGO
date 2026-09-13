import type { QrRecord, QrStatus, TaggoLifecycleStatus } from './qrTypes'

/**
 * LocalStorage-backed QrRepository.
 *
 * Keeps the existing demo persistence (`taggo-demo-qrs`) untouched so no
 * user data is lost. Pages must use this class (via `qrRepository`)
 * instead of importing `demoData.ts` directly.
 */

const STORAGE_KEY = 'taggo-demo-qrs'

export type StoredQr = {
  id: string
  publicId: string
  title: string
  destinationUrl: string
  status: QrStatus
  ownerId?: string
  lifecycleStatus?: TaggoLifecycleStatus
  createdAt: string
  updatedAt?: string
}

const seedQrs: StoredQr[] = [
  {
    id: 'QRT-7812',
    publicId: 'TGG-8K9L2R7',
    title: 'Collection Print',
    destinationUrl: 'https://taggo.example/shop/collection-print',
    status: 'active',
    lifecycleStatus: 'active',
    ownerId: 'demo-user',
    createdAt: '2026-08-30T09:00:00.000Z',
  },
  {
    id: 'QRT-2134',
    publicId: 'TGG-NZ7Q4M2',
    title: 'Limited Capsule',
    destinationUrl: 'https://taggo.example/capsule',
    status: 'draft',
    lifecycleStatus: 'activated',
    ownerId: 'demo-user',
    createdAt: '2026-08-29T09:00:00.000Z',
  },
]

export const LEGACY_SEED_ALIASES: Record<string, string> = {
  'TGG-8K9L2R': 'TGG-8K9L2R7',
  'TGG-NZ7Q4M': 'TGG-NZ7Q4M2',
}

export function normalizeSeed(record: StoredQr): StoredQr {
  const publicId = record.publicId.trim().toUpperCase()
  if (/^TGG-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/.test(publicId)) {
    return { ...record, publicId, lifecycleStatus: record.lifecycleStatus ?? (record.status === 'active' ? 'active' : 'activated') }
  }
  const aliased = LEGACY_SEED_ALIASES[publicId]
  if (aliased) return { ...record, publicId: aliased, lifecycleStatus: record.lifecycleStatus ?? 'activated' }
  return { ...record, publicId: `${publicId}X`.slice(0, 11), lifecycleStatus: record.lifecycleStatus ?? 'activated' }
}

export function readStore(): StoredQr[] {
  if (typeof window === 'undefined') return seedQrs.map(normalizeSeed)
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    const normalized = seedQrs.map(normalizeSeed)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    return normalized
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return seedQrs.map(normalizeSeed)
    return (parsed as StoredQr[]).map((qr) => normalizeSeed(qr))
  } catch {
    return seedQrs.map(normalizeSeed)
  }
}

export function writeStore(qrs: StoredQr[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(qrs))
}

export function toRecord(stored: StoredQr): QrRecord {
  return { ...stored }
}

export function newPrivateId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi && 'randomUUID' in cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `QRT-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
}
