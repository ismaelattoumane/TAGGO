import { isServerDatabaseConfigured, isStripeConfigured, readServerEnv } from '../_lib/env'
import { json } from '../_lib/http'
import { createServerSupabase } from '../_lib/supabaseAdmin'
import { hasPublishedPrices } from '../_lib/orderServer'
import type { PaymentConfigResponse } from '../../src/features/payments/paymentTypes'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * GET /api/stripe/config
 *
 * État public du paiement, sans aucun secret : sert à afficher honnêtement que
 * le paiement n'est pas encore possible tant que les prix officiels ne sont pas
 * publiés. Ne déclenche jamais de paiement.
 */
export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    return json(405, { ok: false, error: 'invalid_request' })
  }

  const env = readServerEnv()
  const stripeConfigured = isStripeConfigured(env)

  if (!stripeConfigured || !isServerDatabaseConfigured(env)) {
    const body: PaymentConfigResponse = {
      stripeConfigured,
      checkoutAvailable: false,
      reason: 'stripe_unconfigured',
      message: 'Paiement indisponible — Stripe n’est pas configuré.',
    }
    return json(200, body)
  }

  let pricesPublished = false
  try {
    pricesPublished = await hasPublishedPrices(createServerSupabase(env))
  } catch {
    pricesPublished = false
  }

  const body: PaymentConfigResponse = {
    stripeConfigured: true,
    checkoutAvailable: pricesPublished,
    reason: pricesPublished ? null : 'pricing_unavailable',
    message: pricesPublished
      ? 'Paiement en mode test Stripe disponible.'
      : 'Le paiement sera disponible dès la publication des prix officiels.',
  }

  return json(200, body)
}