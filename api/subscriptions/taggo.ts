import { isServerDatabaseConfigured, readServerEnv } from '../_lib/env'
import { json } from '../_lib/http'
import { createServerSupabase, extractBearerToken, resolveAuthenticatedUser } from '../_lib/supabaseAdmin'
import {
  getTaggoSubscriptionState,
  RENEWAL_PRICE_CONFIGURED,
  type SubscriptionFailureReason,
} from '../_lib/subscriptionServer'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * ÉTAPE 12 — GET /api/subscriptions/taggo?qr_id=…
 *
 * État de la période d'un TAGGO, pour son propriétaire uniquement.
 *
 * SÉCURITÉ :
 * - l'identité vient du JWT, jamais d'un paramètre ;
 * - `p_owner_id` est celui déduit du JWT et il est RE-VÉRIFIÉ en base contre
 *   `qr_codes.owner_id` ;
 * - la réponse ne contient ni identifiant Stripe, ni montant, ni donnée de
 *   paiement : le propriétaire n'a rien à voir avec le détail financier.
 *
 * AUCUNE DONNÉE PUBLIQUE NE PASSE PAR ICI : la page publique `/t/:tag` ne
 * dépend que de `get_public_taggo_state`.
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
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    return { status: 405, body: { ok: false }, headers: { allow: 'GET' } }
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
  const result = await getTaggoSubscriptionState(supabase, {
    qrId,
    ownerId: user.id,
    renewalAvailable: RENEWAL_PRICE_CONFIGURED,
  })

  if (!result.ok) {
    return json(STATUS_BY_FAILURE[result.reason], {
      ok: false,
      code: result.reason,
      message: FAILURE_MESSAGE[result.reason],
    })
  }

  return json(200, { ok: true, qrId, subscription: result.state })
}