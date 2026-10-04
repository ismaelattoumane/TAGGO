import type { SupabaseClient } from '@supabase/supabase-js'
import type { CheckoutRequestItem } from '../../src/features/payments/paymentTypes'
import type { PricedCart } from './catalogTypes'
import type { CreatedOrder } from './checkout'
import type { OrderForPayment, StripeEventStatus } from './webhook'

/**
 * ÉTAPE 9 — Accès serveur aux commandes.
 *
 * Toutes les écritures passent par des fonctions SQL `security definer` : le
 * client (frontend) ne dispose d'aucune voie pour écrire `paid`, un identifiant
 * Stripe ou une réservation de TAGGO. Seuls `authenticated` (checkout) et
 * `service_role` (webhook) sont habilités.
 */

type RpcResult<T> = { data: T | null; error: { message: string } | null }

export async function createShopOrder(
  client: SupabaseClient,
  input: { items: CheckoutRequestItem[]; cart: PricedCart; userId: string },
): Promise<CreatedOrder> {
  const result = (await client.rpc('create_shop_order', {
    p_items: input.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
  })) as RpcResult<{
    order_id: string
    status: string
    subtotal_cents: number
    currency: string
  }>

  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? 'order_creation_failed')
  }

  const { order_id, status, subtotal_cents, currency } = result.data
  return { id: order_id, status, subtotalCents: subtotal_cents, currency }
}

export async function attachStripeSession(
  client: SupabaseClient,
  orderId: string,
  sessionId: string,
): Promise<void> {
  const { error } = await client
    .from('orders')
    .update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) throw new Error('order_session_link_failed')
}

export async function markOrderPaid(
  client: SupabaseClient,
  input: {
    orderId: string
    stripeSessionId: string
    stripePaymentIntentId: string | null
    amountTotal: number
    currency: string
  },
): Promise<void> {
  const result = (await client.rpc('mark_shop_order_paid', {
    p_order_id: input.orderId,
    p_stripe_session_id: input.stripeSessionId,
    p_stripe_payment_intent_id: input.stripePaymentIntentId,
    p_amount_total: input.amountTotal,
    p_currency: input.currency,
  })) as RpcResult<unknown>

  if (result.error) throw new Error('mark_paid_failed')
}

export async function reserveTaggos(
  client: SupabaseClient,
  orderId: string,
  quantity: number,
): Promise<void> {
  const result = (await client.rpc('reserve_taggos_for_paid_order', {
    p_order_id: orderId,
    p_quantity: quantity,
  })) as RpcResult<unknown>

  if (result.error) throw new Error('taggo_reservation_failed')
}

export async function beginStripeEvent(
  client: SupabaseClient,
  eventId: string,
  eventType: string,
  orderId: string | null,
): Promise<boolean> {
  const result = (await client.rpc('begin_stripe_event', {
    p_stripe_event_id: eventId,
    p_event_type: eventType,
    p_order_id: orderId,
  })) as RpcResult<boolean>

  if (result.error) throw new Error('stripe_event_begin_failed')
  return result.data === true
}

export async function finishStripeEvent(
  client: SupabaseClient,
  eventId: string,
  status: StripeEventStatus,
  detail: string | null = null,
): Promise<void> {
  await client.rpc('finish_stripe_event', {
    p_stripe_event_id: eventId,
    p_status: status,
    p_detail: detail,
  })
}

type OrderRow = {
  id: string
  status: string
  subtotal_cents: number | null
  currency: string | null
  stripe_checkout_session_id: string | null
  order_items: { quantity: number; product_type: string }[]
}

/** Lecture serveur d'une commande + quantité totale d'exemplaires à équiper. */
export async function findOrderForPayment(
  client: SupabaseClient,
  orderId: string,
): Promise<OrderForPayment | null> {
  const { data, error } = await client
    .from('orders')
    .select('id, status, subtotal_cents, currency, stripe_checkout_session_id, order_items(quantity, product_type)')
    .eq('id', orderId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as unknown as OrderRow
  const items = Array.isArray(row.order_items) ? row.order_items : []
  const taggoQuantity = items
    .filter((item) => item.product_type === 'apparel')
    .reduce((total, item) => total + (item.quantity ?? 0), 0)

  return {
    id: row.id,
    status: row.status,
    subtotalCents: row.subtotal_cents,
    currency: row.currency,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    taggoQuantity,
  }
}

export type ShopOrderPaymentStatus = {
  orderId: string
  status: string
  paid: boolean
  taggoCount: number
}

/** État réel de la commande pour la page /checkout/success (propriétaire uniquement). */
export async function getOrderPaymentStatus(
  client: SupabaseClient,
  orderId: string,
): Promise<ShopOrderPaymentStatus | null> {
  const result = (await client.rpc('get_shop_order_payment_status', {
    p_order_id: orderId,
  })) as RpcResult<{
    order_id: string
    status: string
    paid: boolean
    taggo_count: number
  }>

  if (result.error || !result.data) return null

  return {
    orderId: result.data.order_id,
    status: result.data.status,
    paid: result.data.paid === true,
    taggoCount: result.data.taggo_count ?? 0,
  }
}

/** Le catalogue serveur a-t-il au moins une variante achetable ET tarifée ? */
export async function hasPublishedPrices(client: SupabaseClient): Promise<boolean> {
  const { count, error } = await client
    .from('product_variants')
    .select('id', { count: 'exact', head: true })
    .eq('available', true)
    .not('price_cents', 'is', null)

  if (error) return false
  return (count ?? 0) > 0
}