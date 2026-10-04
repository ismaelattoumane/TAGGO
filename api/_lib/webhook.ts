import { isUuid } from './catalogTypes'
import type { StripeCheckoutSessionLike, StripeEvent } from './types'

/**
 * ÉTAPE 9 — Traitement du webhook Stripe (serveur uniquement).
 *
 * Séquence pour `checkout.session.completed` / `async_payment_succeeded` :
 *  1. idempotence : l'event_id est inséré de façon atomique (UNIQUE) — un rejeu
 *     du même événement ne fait rien ;
 *  2. l'événement est dans la liste traitée ;
 *  3. la session est réellement payée (`payment_status = paid`) ;
 *  4. `metadata.order_id` est présent et valide ;
 *  5. la commande existe ;
 *  6. montant et devise correspondent à la commande ;
 *  7. `pending -> paid` via RPC serveur ;
 *  8. réservation + assignation des TAGGO (une unité par exemplaire vendu).
 *
 * Un montant ou une devise incohérent ne passe JAMAIS la commande à `paid`.
 */

export const HANDLED_EVENT_TYPES = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
] as const

export type StripeEventStatus = 'processed' | 'ignored' | 'failed' | 'rejected'

export type OrderForPayment = {
  id: string
  status: string
  subtotalCents: number | null
  currency: string | null
  stripeCheckoutSessionId: string | null
  taggoQuantity: number
}

export type WebhookDeps = {
  /** Insertion atomique ; retourne false si l'événement a déjà été traité. */
  beginEvent(eventId: string, eventType: string, orderId: string | null): Promise<boolean>
  finishEvent(eventId: string, status: StripeEventStatus, detail?: string | null): Promise<void>
  findOrder(orderId: string): Promise<OrderForPayment | null>
  /** Transition serveur `pending -> paid` + contrôle montant/devise côté SQL. */
  markOrderPaid(input: {
    orderId: string
    stripeSessionId: string
    stripePaymentIntentId: string | null
    amountTotal: number
    currency: string
  }): Promise<void>
  /** Réservation + assignation des TAGGO (idempotent côté SQL). */
  reserveTaggos(orderId: string, quantity: number): Promise<void>
}

export type WebhookOutcome = {
  status: StripeEventStatus
  orderId?: string
  detail?: string
  /** `true` si la commande vient d'être payée par cet événement. */
  paid: boolean
}

export async function processStripeEvent(
  deps: WebhookDeps,
  event: StripeEvent,
): Promise<WebhookOutcome> {
  if (!(HANDLED_EVENT_TYPES as readonly string[]).includes(event.type)) {
    return { status: 'ignored', paid: false, detail: 'unhandled_event_type' }
  }

  const session = event.data.object as unknown as StripeCheckoutSessionLike
  const orderId = session.metadata?.order_id ?? null
  const validOrderId = orderId && isUuid(orderId) ? orderId : null

  const firstTime = await deps.beginEvent(event.id, event.type, validOrderId)
  if (!firstTime) {
    // Rejeu Stripe : déjà traité, aucune seconde effet de bord.
    return { status: 'ignored', paid: false, orderId: validOrderId ?? undefined, detail: 'duplicate_event' }
  }

  try {
    return await handleCheckoutSession(deps, event, session, validOrderId)
  } catch {
    await deps.finishEvent(event.id, 'failed', 'unexpected_error')
    return { status: 'failed', paid: false, orderId: validOrderId ?? undefined, detail: 'unexpected_error' }
  }
}

async function handleCheckoutSession(
  deps: WebhookDeps,
  event: StripeEvent,
  session: StripeCheckoutSessionLike,
  orderId: string | null,
): Promise<WebhookOutcome> {
  if (!orderId) {
    await deps.finishEvent(event.id, 'rejected', 'missing_order_reference')
    return { status: 'rejected', paid: false, detail: 'missing_order_reference' }
  }

  if (session.payment_status !== 'paid') {
    await deps.finishEvent(event.id, 'ignored', 'payment_not_completed', )
    return { status: 'ignored', orderId, paid: false, detail: 'payment_not_completed' }
  }

  const order = await deps.findOrder(orderId)
  if (!order) {
    await deps.finishEvent(event.id, 'rejected', 'order_not_found')
    return { status: 'rejected', orderId, paid: false, detail: 'order_not_found' }
  }

  if (order.status === 'paid') {
    await deps.finishEvent(event.id, 'ignored', 'already_paid')
    return { status: 'ignored', orderId, paid: false, detail: 'already_paid' }
  }

  if (typeof session.amount_total !== 'number') {
    await deps.finishEvent(event.id, 'rejected', 'missing_amount')
    return { status: 'rejected', orderId, paid: false, detail: 'missing_amount' }
  }

  if (order.subtotalCents === null || session.amount_total !== order.subtotalCents) {
    await deps.finishEvent(event.id, 'rejected', 'amount_mismatch')
    return { status: 'rejected', orderId, paid: false, detail: 'amount_mismatch' }
  }

  const sessionCurrency = (session.currency ?? '').toUpperCase()
  const orderCurrency = (order.currency ?? '').toUpperCase()
  if (sessionCurrency !== orderCurrency || sessionCurrency !== 'EUR') {
    await deps.finishEvent(event.id, 'rejected', 'currency_mismatch')
    return { status: 'rejected', orderId, paid: false, detail: 'currency_mismatch' }
  }

  if (
    order.stripeCheckoutSessionId &&
    order.stripeCheckoutSessionId !== session.id
  ) {
    await deps.finishEvent(event.id, 'rejected', 'session_mismatch')
    return { status: 'rejected', orderId, paid: false, detail: 'session_mismatch' }
  }

  await deps.markOrderPaid({
    orderId,
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === 'string' ? session.payment_intent : null,
    amountTotal: session.amount_total,
    currency: sessionCurrency,
  })

  // Paiement confirmé : attribution d'un TAGGO par exemplaire vendu.
  const quantity = Math.max(order.taggoQuantity, 1)
  try {
    await deps.reserveTaggos(orderId, quantity)
  } catch {
    // Le paiement est acquis : on n'annule PAS, on journalise pour traitement.
    await deps.finishEvent(event.id, 'processed', 'paid_taggo_pending')
    return { status: 'processed', orderId, paid: true, detail: 'paid_taggo_pending' }
  }

  await deps.finishEvent(event.id, 'processed', null)
  return { status: 'processed', orderId, paid: true }
}