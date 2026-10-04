import { isServerDatabaseConfigured, readServerEnv } from '../_lib/env'
import { json } from '../_lib/http'
import { createServerSupabase, extractBearerToken, resolveAuthenticatedUser } from '../_lib/supabaseAdmin'
import { setTaggoAutoRenew, type SubscriptionFailureReason } from '../_lib/subscriptionServer'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * ÉTAPE 12 — POST /api/subscriptions/auto-renew?qr_id=…&enabled=true|false
 *
 * Enregistre la PRÉFÉRENCE de renouvellement automatique.
 *
 * Ce n'est pas un paiement : rien n'est facturé, aucune période n'est
 * prolongée, aucun statut ne change. La RPC appelée ne touche qu'au booléen
 * `auto_renew`, après avoir revérifié en base que le TAGGO appartient bien à
 * l'utilisateur authentifié.
 *
 * Le booléen vient du navigateur, ce qui est correct : une préférence est une
 * intention. Ce que le navigateur ne peut PAS envoyer, c'est une date, un
 * statut, un identifiant Stripe ou un montant.
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
  const rawEnabled = typeof req.query?.enabled === 'string' ? req.query.enabled.trim() : ''
  const autoRenew = rawEnabled === 'true' ? true : rawEnabled === 'false' ? false : null

  if (autoRenew === null) {
    return json(STATUS_BY_FAILURE.invalid_request, {
      ok: false,
      code: 'invalid_request',
      message: FAILURE_MESSAGE.invalid_request,
    })
  }

  const result = await setTaggoAutoRenew(supabase, { qrId, ownerId: user.id, autoRenew })

  if (!result.ok) {
    return json(STATUS_BY_FAILURE[result.reason], {
      ok: false,
      code: result.reason,
      message: FAILURE_MESSAGE[result.reason],
    })
  }

  return json(200, { ok: true, qrId, autoRenew })
}