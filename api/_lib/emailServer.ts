import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailDeliveryStatus } from './emailDispatch'
import type { EmailType } from '../../src/emails/emailTypes'

/**
 * ÉTAPE 10 — Journal d'email et déduplication (service_role uniquement).
 *
 * La table `email_events` porte une contrainte UNIQUE sur `dedupe_key` :
 * l'insertion atomique `begin_email_event` réserve la clé. Un rejeu d'événement
 * (webhook Stripe rejoué, job relancé) obtient `false` et n'envoie rien.
 *
 * L'adresse du destinataire n'est PAS stockée en clair : seule son empreinte
 * SHA-256 et sa longueur sont conservées pour le diagnostic.
 */

/** Empreinte SHA-256 de l'adresse : permet de retrouver un envoi sans la donnée. */
export function hashRecipient(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

type RpcResult<T> = { data: T | null; error: { message: string } | null }

export async function beginEmailEvent(
  client: SupabaseClient,
  input: {
    dedupeKey: string
    emailType: EmailType
    orderId: string | null
    recipient: string
  },
): Promise<boolean> {
  const result = (await client.rpc('begin_email_event', {
    p_dedupe_key: input.dedupeKey,
    p_email_type: input.emailType,
    p_order_id: input.orderId,
    p_recipient_hash: hashRecipient(input.recipient),
    p_recipient_length: input.recipient.trim().length,
  })) as RpcResult<boolean>

  if (result.error) throw new Error('email_event_begin_failed')
  return result.data === true
}

export async function finishEmailEvent(
  client: SupabaseClient,
  input: {
    dedupeKey: string
    status: EmailDeliveryStatus
    detail?: string | null
  },
): Promise<void> {
  await client.rpc('finish_email_event', {
    p_dedupe_key: input.dedupeKey,
    p_status: input.status,
    p_detail: input.detail ?? null,
  })
}