import {
  MAX_PAYMENT_LINE_QUANTITY,
  type CheckoutRequestItem,
  type PaymentErrorCode,
} from '../../src/features/payments/paymentTypes'
import { failure } from './errors'
import { parseCheckoutItems, priceCart } from './pricing'
import type { CatalogLookup, PricedCart } from './catalogTypes'
import type { ApiResponse, StripeGateway } from './types'

/**
 * ÉTAPE 9 — Création d'une Checkout Session Stripe.
 *
 * Ordre imposé :
 *  1. l'utilisateur est authentifié (JWT vérifié, jamais un customerId du body) ;
 *  2. le panier est validé et RE-TARIFÉ par le serveur ;
 *  3. la commande est créée (`pending`) avec le montant serveur ;
 *  4. la Checkout Session Stripe est créée avec ce montant ;
 *  5. l'identifiant de session est rattaché à la commande.
 *
 * Un échec à n'importe quelle étape laisse la commande en `pending` : elle n'est
 * jamais marquée payée, et aucun TAGGO n'est réservé.
 */

export type OrderRecord = {
  id: string
  status: string
  subtotalCents: number | null
  currency: string | null
  stripeCheckoutSessionId: string | null
}

export type CreatedOrder = {
  id: string
  status: string
  subtotalCents: number
  currency: string
}

export type CheckoutDeps = {
  /** Création de commande serveur (RPC `create_shop_order`). */
  createOrder(input: {
    items: CheckoutRequestItem[]
    cart: PricedCart
    userId: string
  }): Promise<CreatedOrder>
  /** Rattachement de la session Stripe à la commande (serveur uniquement). */
  attachStripeSession(orderId: string, sessionId: string): Promise<void>
  stripe: StripeGateway
  catalog: CatalogLookup
  successUrl: string
  cancelUrl: string
}

export type CheckoutOutcome =
  | { ok: true; orderId: string; sessionId: string; url: string }
  | { ok: false; code: PaymentErrorCode }

export async function createCheckoutSession(
  deps: CheckoutDeps,
  input: { body: unknown; userId: string | null },
): Promise<CheckoutOutcome> {
  if (!input.userId) return { ok: false, code: 'unauthenticated' }

  const items = parseCheckoutItems(input.body)
  if (typeof items === 'string') return { ok: false, code: items }

  const pricing = await priceCart(items, deps.catalog)
  if (!pricing.ok) return { ok: false, code: pricing.code }

  const cart = pricing.cart
  const order = await deps.createOrder({ items, cart, userId: input.userId })

  // Filet de sécurité serveur : l'ordre doit correspondre au panier tarifié.
  if (
    order.subtotalCents !== cart.subtotalCents ||
    order.currency !== cart.currency ||
    order.status === 'paid'
  ) {
    return { ok: false, code: 'invalid_request' }
  }

  let session
  try {
    session = await deps.stripe.createCheckoutSession({
      orderId: order.id,
      currency: cart.currency,
      successUrl: deps.successUrl,
      cancelUrl: deps.cancelUrl,
      lines: cart.lines.map((line) => ({
        name: buildLineName(line.name, line.size, line.color),
        ...(line.description ? { description: line.description } : {}),
        unitAmountCents: line.unitPriceCents,
        currency: cart.currency,
        quantity: line.quantity,
      })),
    })
  } catch {
    return { ok: false, code: 'stripe_error' }
  }

  await deps.attachStripeSession(order.id, session.id)

  return { ok: true, orderId: order.id, sessionId: session.id, url: session.url }
}

function buildLineName(name: string, size: string | null, color: string | null): string {
  const details = [size ? `Taille ${size}` : null, color ? `Couleur ${color}` : null].filter(Boolean)
  return details.length > 0 ? `${name} — ${details.join(' · ')}` : name
}

export function checkoutResponse(outcome: CheckoutOutcome): ApiResponse {
  if (!outcome.ok) return failure(outcome.code)
  return {
    status: 200,
    body: {
      ok: true,
      orderId: outcome.orderId,
      sessionId: outcome.sessionId,
      url: outcome.url,
    },
  }
}

export { MAX_PAYMENT_LINE_QUANTITY }