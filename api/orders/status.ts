import { isServerDatabaseConfigured, readServerEnv } from '../_lib/env'
import { json } from '../_lib/http'
import { failure } from '../_lib/errors'
import { isUuid } from '../_lib/catalogTypes'
import { extractBearerToken } from '../_lib/supabaseAdmin'
import { createServerSupabase, resolveAuthenticatedUser } from '../_lib/supabaseAdmin'
import { getOrderPaymentStatus } from '../_lib/orderServer'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * GET /api/orders/status?order_id=...
 *
 * État réel de la commande, lisible par son propriétaire uniquement (contrôle
 * serveur via `auth.uid()`, pas via un paramètre `userId`).
 * Ne peut jamais DÉCLENCHER un paiement : lecture seule.
 */
export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    return failure('invalid_request')
  }

  const env = readServerEnv()
  if (!isServerDatabaseConfigured(env)) return failure('stripe_unavailable')

  const orderId = typeof req.query?.order_id === 'string' ? req.query.order_id : null
  if (!orderId || !isUuid(orderId)) return failure('invalid_order')

  let supabase
  try {
    supabase = createServerSupabase(env)
  } catch {
    return failure('stripe_unavailable')
  }

  const token = extractBearerToken(req.headers?.authorization)
  const user = await resolveAuthenticatedUser(supabase, token)
  if (!user) return failure('unauthenticated')

  const status = await getOrderPaymentStatus(supabase, orderId)
  if (!status) return failure('order_not_found')

  return json(200, {
    ok: true,
    orderId: status.orderId,
    status: status.status,
    paid: status.paid,
    taggoCount: status.taggoCount,
  })
}