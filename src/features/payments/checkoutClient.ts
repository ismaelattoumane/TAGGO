import { supabase } from '../../lib/supabase'
import {
  PAYMENT_ERROR_MESSAGES,
  type CheckoutRequestItem,
  type CheckoutResponse,
  type OrderPaymentStatusErrorResponse,
  type OrderPaymentStatusResponseType,
  type PaymentConfigResponse,
} from './paymentTypes'

/**
 * ÉTAPE 9 — Client de paiement (frontend).
 *
 * Règles non négociables :
 * - le navigateur n'envoie QUE `variantId` + `quantity` ;
 * - aucun prix, aucun total, aucune devise n'est calculé ici ;
 * - aucun secret Stripe n'apparaît dans le bundle ;
 * - le statut `paid` n'est jamais écrit depuis le frontend : il est LU, et c'est
 *   le serveur (webhook Stripe) qui l'applique.
 *
 * Toute réponse serveur en erreur est convertie en message français affichable.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } }
  const token = data.session?.access_token
  return token ? { ...JSON_HEADERS, Authorization: `Bearer ${token}` } : JSON_HEADERS
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Conserve uniquement la branche « erreur » d'une réponse de paiement. */
function toErrorResponse(response: CheckoutResponse): OrderPaymentStatusErrorResponse {
  if (response.ok) {
    return { ok: false, code: 'invalid_request', message: PAYMENT_ERROR_MESSAGES.invalid_request }
  }
  return { ok: false, code: response.code, message: response.message }
}

export function toPaymentErrorResponse(body: unknown): CheckoutResponse {
  const code = isRecord(body) && typeof body.error === 'string' ? body.error : 'invalid_request'
  const known = code in PAYMENT_ERROR_MESSAGES ? (code as keyof typeof PAYMENT_ERROR_MESSAGES) : 'invalid_request'
  return { ok: false, code: known, message: PAYMENT_ERROR_MESSAGES[known] }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/** Demande une Checkout Session Stripe. Le redirection est fait par l'appelant. */
export async function requestCheckoutSession(
  items: CheckoutRequestItem[],
): Promise<CheckoutResponse> {
  if (items.length === 0) {
    return { ok: false, code: 'empty_cart', message: PAYMENT_ERROR_MESSAGES.empty_cart }
  }

  let response: Response
  try {
    response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ items: items.map((item) => ({ ...item })) }),
    })
  } catch {
    return { ok: false, code: 'stripe_unavailable', message: PAYMENT_ERROR_MESSAGES.stripe_unavailable }
  }

  const body = await readJson(response)
  if (!response.ok) return toPaymentErrorResponse(body)
  if (!isRecord(body) || body.ok !== true || typeof body.url !== 'string') {
    return toPaymentErrorResponse(null)
  }

  return {
    ok: true,
    orderId: String(body.orderId),
    sessionId: String(body.sessionId),
    url: body.url,
  }
}

/** État du paiement d'une commande (lecture seule). */
export async function fetchOrderPaymentStatus(orderId: string): Promise<OrderPaymentStatusResponseType> {
  if (!orderId) {
    return { ok: false, code: 'invalid_request', message: PAYMENT_ERROR_MESSAGES.invalid_request }
  }

  let response: Response
  try {
    response = await fetch(`/api/orders/status?order_id=${encodeURIComponent(orderId)}`, {
      headers: await authHeaders(),
    })
  } catch {
    return { ok: false, code: 'stripe_unavailable', message: PAYMENT_ERROR_MESSAGES.stripe_unavailable }
  }

  const body = await readJson(response)
  if (!response.ok || !isRecord(body) || body.ok !== true) {
    return toErrorResponse(toPaymentErrorResponse(body))
  }

  return {
    ok: true,
    orderId: String(body.orderId),
    status: String(body.status),
    paid: body.paid === true,
    taggoCount: Number(body.taggoCount ?? 0),
  }
}

/** Disponibilité du paiement, lue depuis le serveur (jamais supposée). */
export async function fetchPaymentConfig(): Promise<PaymentConfigResponse> {
  try {
    const response = await fetch('/api/stripe/config')
    const body = await readJson(response)
    if (response.ok && isRecord(body) && typeof body.checkoutAvailable === 'boolean') {
      return {
        stripeConfigured: body.stripeConfigured === true,
        checkoutAvailable: body.checkoutAvailable === true,
        reason: (body.reason as PaymentConfigResponse['reason']) ?? null,
        message: String(body.message ?? ''),
      }
    }
  } catch {
    /* état par défaut ci-dessous */
  }

  return {
    stripeConfigured: false,
    checkoutAvailable: false,
    reason: 'stripe_unconfigured',
    message: PAYMENT_ERROR_MESSAGES.stripe_unavailable,
  }
}