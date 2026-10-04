import { isServerDatabaseConfigured, isStripeConfigured, readServerEnv } from '../_lib/env'
import { createSupabaseCatalogLookup } from '../_lib/catalogServer'
import { createCheckoutSession, checkoutResponse } from '../_lib/checkout'
import { attachStripeSession, createShopOrder } from '../_lib/orderServer'
import { createServerSupabase, extractBearerToken, resolveAuthenticatedUser } from '../_lib/supabaseAdmin'
import { createStripeGateway } from '../_lib/stripeGateway'
import { jsonBody, resolveAppUrl } from '../_lib/http'
import { failure } from '../_lib/errors'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * POST /api/stripe/create-checkout-session
 *
 * Authentifié par le JWT Supabase transmis par le navigateur : l'identité n'est
 * jamais déduite du corps de la requête.
 */
export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  if ((req.method ?? 'POST').toUpperCase() !== 'POST') {
    return failure('invalid_request')
  }

  const env = readServerEnv()
  if (!isStripeConfigured(env)) return failure('stripe_unavailable')
  if (!isServerDatabaseConfigured(env)) return failure('stripe_unavailable')

  let supabase
  try {
    supabase = createServerSupabase(env)
  } catch {
    return failure('stripe_unavailable')
  }

  const token = extractBearerToken(req.headers?.authorization)
  const user = await resolveAuthenticatedUser(supabase, token)
  if (!user) return failure('unauthenticated')

  let stripe
  try {
    stripe = createStripeGateway(env.stripeSecretKey as string)
  } catch {
    // Clé live refusée volontairement à ce stade (étape 9 = mode test).
    return failure('stripe_unavailable')
  }

  const appUrl = resolveAppUrl(req, env.appUrl)
  const outcome = await createCheckoutSession(
    {
      createOrder: (orderInput) => createShopOrder(supabase, orderInput),
      attachStripeSession: (orderId, sessionId) => attachStripeSession(supabase, orderId, sessionId),
      stripe,
      catalog: createSupabaseCatalogLookup(supabase),
      successUrl: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${appUrl}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
    },
    { body: jsonBody(req), userId: user.id },
  )

  return checkoutResponse(outcome)
}
