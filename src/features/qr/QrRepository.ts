import type { CreateQrInput, QrRecord, UpdateQrInput } from './qrTypes'
import type { QrStatus } from './qrTypes'
import type { PublicProfileInput, PublicProfileRecord, PublicTaggoProfile } from './publicProfile'

/**
 * Storage abstraction for TAGGO QR codes.
 *
 * UI pages must depend on this interface only.
 * Current implementation: LocalStorage (`LocalQrRepository`).
 * Future implementation: Supabase (`SupabaseQrRepository`).
 *
 * `ownerId` scoping is part of the contract so the Supabase
 * implementation can enforce RLS ownership without changing callers.
 */
export interface QrRepository {
  list(ownerId?: string): Promise<QrRecord[]> | QrRecord[]
  getById(id: string, ownerId?: string): Promise<QrRecord | null> | QrRecord | null
  getByPublicId(publicId: string): Promise<QrRecord | null> | QrRecord | null
  create(input: CreateQrInput): Promise<QrRecord> | QrRecord
  update(
    id: string,
    updates: UpdateQrInput,
    ownerId?: string,
  ): Promise<QrRecord | null> | QrRecord | null
  remove(id: string, ownerId?: string): Promise<boolean> | boolean
  getPublicTaggoProfile(publicId: string): Promise<PublicTaggoProfile | null> | PublicTaggoProfile | null
  getPublicTaggoStatus(publicId: string): Promise<QrStatus | null> | QrStatus | null
  getPublicProfile(qrId: string, ownerId?: string): Promise<PublicProfileRecord | null> | PublicProfileRecord | null
  savePublicProfile(qrId: string, input: PublicProfileInput, ownerId?: string): Promise<PublicProfileRecord | null> | PublicProfileRecord | null
}
