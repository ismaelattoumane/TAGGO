export type QrStatus = 'draft' | 'active' | 'inactive' | 'archived'

export type TaggoLifecycleStatus =
  | 'available'
  | 'reserved'
  | 'assigned'
  | 'activated'
  | 'active'
  | 'inactive'
  | 'replaced'
  | 'cancelled'

export type PublicTaggoState = 'not_found' | 'unactivated' | 'active' | 'unavailable'

/**
 * Canonical TAGGO QR record.
 *
 * `publicId` is the canonical public TAG code (format `TGG-XXXXXXX`).
 * It is exposed in the public route `/t/:tag`.
 * `id` is the private internal identifier and must never appear in public URLs.
 */
export type QrRecord = {
  id: string
  publicId: string
  title: string
  destinationUrl: string
  status: QrStatus
  /** Future Supabase owner (`profiles.id`). Undefined in LocalStorage mode. */
  ownerId?: string
  lifecycleStatus?: TaggoLifecycleStatus
  createdAt: string
  updatedAt?: string
}

export type CreateQrInput = {
  title: string
  destinationUrl: string
  ownerId?: string
}

export type UpdateQrInput = Partial<
  Pick<QrRecord, 'title' | 'destinationUrl' | 'status' | 'ownerId'>
>
