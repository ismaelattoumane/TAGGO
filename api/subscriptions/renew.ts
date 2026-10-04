import { isServerDatabaseConfigured, readServerEnv } from '../_lib/env'
import { json } from '../_lib/http'
import { createServerSupabase, extractBearerToken, resolveAuthenticatedUser } from '../_lib/supabaseAdmin'
import { requestTaggoRenewal, type SubscriptionFailureReason } from '../_lib/subscriptionServer'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * ÉTAPE 12 — POST /api/subscriptions/renew?qr_id=…&auto_renew=…
 *
 * Renouvellement MANUEL d'un TAGGO expiré.
 *
 * CE QUE CETTE ROUTE NE FAIT PAS — et c'est l'essentiel :
 *   - elle ne déclare JAMAIS un paiement réussi ;
 *   - elle ne modifie aucun statut côté serveur ;
 *   - elle ne prolonge AUCUNE date.
 *
 * Elle ne peut rien de tout cela : le renouvellement réel passe par une session
 * Stripe payée, confirmée par webhook signé. Ce qui n'existe pas encore, c'est le
 * tarif. Tant que TAGGO n'a pas décidé de prix annuel, la route répond
 * `renewal_unavailable` et ne crée aucune commande.
 *
 * `auto_renew=true|false` est traité comme une INTENTION distincte : c'est une
 * préférence enregistrée, jamais un paiement.
 */

const STATUS_BY_FAILURE: Record<SubscriptionFailureReason, number> = {
  invalid_request: 400,
  unauthenticated: 401,
  not_owner: 403,
  subscription_unavailable: 503,
  no_valid_subscription: 409,
  renewal_unavailable: 503,
}

const FAILURE_MESSAGE: Record<SubscriptionFailureReason, string> = {
  invalid_request: 'Demande invalide.',
  unauthenticated: 'Authentification requise.',
  not_owner: 'TAGGO introuvable dans votre compte.',
  subscription_unavailable: 'Abonnements temporairement indisponibles.',
  no_valid_subscription: 'Aucun renouvellement à effectuer.',
  renewal_unavailable: 'Le renouvellement n’est pas encore disponible.',
}

export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  if ((req.method ?? 'POST').toUpperCase() !== 'POST') {
    return { status: 405, body: { ok: false }, headers: { allow: 'POST' } }
  }

  const env = readServerEnv()
  if (!isServerDatabaseConfigured(env)) {
    return json(STATUS_BY_FAILURE.subscription_unavailable, {
      ok: false,
      code: 'subscription_unavailable',
      message: FAILURE_MESSAGE.subscription_unavailable,
    })
  }

  let supabase
  try {
    supabase = createServerSupabase(env)
  } catch {
    return json(STATUS_BY_FAILURE.subscription_unavailable, {
      ok: false,
      code: 'subscription_unavailable',
      message: FAILURE_MESSAGE.subscription_unavailable,
    })
  }

  const token = extractBearerToken(req.headers?.authorization)
  const user = await resolveAuthenticatedUser(supabase, token)
  if (!user) {
    return json(STATUS_BY_FAILURE.unauthenticated, {
      ok: false,
      code: 'unauthenticated',
      message: FAILURE_MESSAGE.unauthenticated,
    })
  }

  const qrId = typeof req.query?.qr_id === 'string' ? req.query.qr_id.trim() : ''
  const outcome = await requestTaggoRenewal(supabase, { qrId, ownerId: user.id })

  if (!outcome.ok) {
    return json(STATUS_BY_FAILURE[outcome.reason], {
      ok: false,
      code: outcome.reason,
      message: FAILURE_MESSAGE[outcome.reason],
    })
  }

  return json(200, {
    ok: true,
    taggoId: outcome.taggoId,
    startsAt: outcome.startsAt,
    endsAt: outcome.endsAt,
  })
}