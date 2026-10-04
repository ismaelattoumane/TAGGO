import type { CartLine } from '../shop/cart'
import {
  PAYMENT_ERROR_MESSAGES,
  type CheckoutResponse,
  type PaymentConfigResponse,
} from './paymentTypes'
import { requestCheckoutSession } from './checkoutClient'

/**
 * ÉTAPE 9 — Orchestration du passage au paiement.
 *
 * Séparée de la page pour être testable sans React et sans réseau.
 * Le frontend ne fait QUE : translator le panier en références, appeler l'API,
 * et rediriger vers Stripe. Aucun montant, aucun statut `paid`, aucune
 * réservation de TAGGO ici.
 */

export type StartPaymentResult =
  | { ok: true; orderId: string; sessionId: string; redirectUrl: string }
  | { ok: false; message: string }

/** Le panier ne doit contenir que des références et des quantités. */
export function toCheckoutItems(lines: CartLine[]): { variantId: string; quantity: number }[] {
  return lines.map((line) => ({ variantId: line.variant.id, quantity: line.quantity }))
}

export async function startStripeCheckout(lines: CartLine[]): Promise<StartPaymentResult> {
  if (lines.length === 0) {
    return { ok: false, message: PAYMENT_ERROR_MESSAGES.empty_cart }
  }

  let response: CheckoutResponse
  try {
    response = await requestCheckoutSession(toCheckoutItems(lines))
  } catch {
    return { ok: false, message: PAYMENT_ERROR_MESSAGES.stripe_unavailable }
  }

  if (!response.ok) {
    return { ok: false, message: response.message }
  }

  return {
    ok: true,
    orderId: response.orderId,
    sessionId: response.sessionId,
    redirectUrl: response.url,
  }
}

/** Le bouton de paiement n'est actif que si le SERVEUR le déclare possible. */
export function isCheckoutAvailable(config: PaymentConfigResponse | null): boolean {
  return config?.checkoutAvailable === true
}
