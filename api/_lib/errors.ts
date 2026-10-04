import type { ApiResponse } from './types'
import {
  PAYMENT_ERROR_MESSAGES,
  type PaymentError,
  type PaymentErrorCode,
} from '../../src/features/payments/paymentTypes'

/**
 * ÉTAPE 9 — Erreurs serveur.
 *
 * Aucune stack trace, aucun secret, aucun détail Supabase/Stripe n'est renvoyé
 * au navigateur : uniquement un code interne et un message affichable en français.
 */

export function paymentError(code: PaymentErrorCode): PaymentError {
  return { code, message: PAYMENT_ERROR_MESSAGES[code] }
}

export function errorResponse(code: PaymentErrorCode, status: number): ApiResponse {
  return { status, body: { ok: false, ...paymentError(code) } }
}

export const STATUS_BY_CODE: Record<PaymentErrorCode, number> = {
  unauthenticated: 401,
  empty_cart: 400,
  invalid_item: 400,
  invalid_quantity: 400,
  variant_not_found: 404,
  variant_unavailable: 409,
  price_unavailable: 503,
  invalid_currency: 400,
  invalid_order: 400,
  order_not_found: 404,
  session_not_found: 404,
  stripe_unavailable: 503,
  stripe_error: 502,
  invalid_signature: 400,
  invalid_request: 400,
}

export function failure(code: PaymentErrorCode): ApiResponse {
  return errorResponse(code, STATUS_BY_CODE[code])
}