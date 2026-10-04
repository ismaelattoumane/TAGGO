export type QrStatus = 'draft' | 'active' | 'inactive' | 'archived'

export type TaggoLifecycleStatus =
  | 'available'
  | 'reserved'
  | 'assigned'
  | 'activated'
  | 'active'
  | 'inactive'
  | 'expired'
  | 'suspended'
  | 'replaced'
  | 'cancelled'

/**
 * État public d'un TAGGO.
 *
 * Les états d'abonnement sont DISTINCTS des états de configuration, parce que
 * les situations ne se déduisent pas l'une de l'autre :
 *
 *   `expired`               la période EXISTE et elle est terminée. Situation
 *                           temporaire et réversible par un renouvellement.
 *   `subscription_required` AUCUNE période n'existe pour ce TAGGO. Ce n'est pas
 *                           une expiration : le propriétaire n'a jamais eu de
 *                           période gérée. Les deux doivent rester distincts,
 *                           sinon le propriétaire reçoit un diagnostic faux et
 *                           le visiteur un message qui ne correspond pas à sa
 *                           situation.
 *
 * `unavailable` reste réservé au TAGGO suspendu, remplacé ou non actif : il ne
 * dit rien de l'abonnement.
 */
export type PublicTaggoState =
  | 'not_found'
  | 'unactivated'
  | 'active'
  | 'expired'
  | 'subscription_required'
  | 'unavailable'

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
  reservedAt?: string
  assignedAt?: string
  activatedAt?: string
}

export type CreateQrInput = {
  title: string
  destinationUrl: string
  ownerId?: string
}

export type UpdateQrInput = Partial<
  Pick<QrRecord, 'title' | 'destinationUrl' | 'status'>
>
