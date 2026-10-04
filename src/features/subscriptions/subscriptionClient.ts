import { supabase } from '../../lib/supabase'
import {
  type SubscriptionActionResult,
  type SubscriptionFailureReason,
  type SubscriptionReadResult,
  type TaggoSubscriptionSource,
  type TaggoSubscriptionState,
  type TaggoSubscriptionStatus,
} from './subscriptionTypes'

/**
 * ÉTAPE 12 — Client abonnements (navigateur).
 *
 * RÈGLES :
 * - le frontend n'écrit JAMAIS une date, un statut ou un identifiant Stripe : il
 *   n'envoie qu'un `qr_id` (déjà affiché dans le dashboard) et une intention ;
 * - `qr_id` seul ne donne aucun droit : le serveur résout le JWT et revérifie
 *   l'appartenance du TAGGO en base ;
 * - chaque réponse est normalisée. Une valeur illisible ne devient jamais un
 *   « actif » ou un « expiré » par défaut : elle devient « non géré », qui est
 *   le seul état honnête quand on ne sait pas.
 *
 * AUCUN MONTANT, AUCUN PRIX : le serveur expose `renewalAvailable`, le client ne
 * calcule aucun tarif.
 */

const STATUS_ENDPOINT = '/api/subscriptions/taggo'
const RENEW_ENDPOINT = '/api/subscriptions/renew'
const AUTO_RENEW_ENDPOINT = '/api/subscriptions/auto-renew'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isTaggoId(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toIso(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function isSubscriptionStatus(value: unknown): value is TaggoSubscriptionStatus {
  return value === 'active' || value === 'expired'
}

function isSubscriptionSource(value: unknown): value is TaggoSubscriptionSource {
  return value === 'included' || value === 'renewal'
}

/** Raisons d'erreur acceptés : tout le reste devient `subscription_unavailable`. */
function toFailureReason(value: unknown): SubscriptionFailureReason {
  const known: SubscriptionFailureReason[] = [
    'invalid_request',
    'unauthenticated',
    'not_owner',
    'subscription_unavailable',
    'no_valid_subscription',
    'renewal_unavailable',
  ]
  return typeof value === 'string' && (known as string[]).includes(value)
    ? (value as SubscriptionFailureReason)
    : 'subscription_unavailable'
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Normalise l'état renvoyé par le serveur.
 *
 * `managed` n'est accepté que s'il vaut explicitement `true` : une réponse
 * incomplète ne doit pas laisser croire qu'un TAGGO a une période gérée.
 *
 * `subscriptionRequired` est déduit quand le serveur ne l'envoie pas : en
 * l'absence de `managed`, l'accès public est refusé. Le défaut prudent est
 * `true`, jamais `false` — le navigateur ne doit jamais croire qu'un TAGGO sans
 * période est publiquement accessible.
 */
function toSubscriptionState(value: unknown): TaggoSubscriptionState {
  const row = isRecord(value) ? value : {}
  const managed = row.managed === true

  return {
    managed,
    subscriptionRequired: row.subscriptionRequired === true || !managed,
    status: isSubscriptionStatus(row.status) ? row.status : null,
    source: isSubscriptionSource(row.source) ? row.source : null,
    autoRenew: row.autoRenew === true,
    startedAt: toIso(row.startedAt),
    endsAt: toIso(row.endsAt),
    expiredAt: toIso(row.expiredAt),
    lifecycleStatus: typeof row.lifecycleStatus === 'string' ? row.lifecycleStatus : null,
    expiringSoon: row.expiringSoon === true,
    renewalAvailable: row.renewalAvailable === true,
  }
}

/** Lit l'état d'abonnement d'un TAGGO (propriétaire authentifié). */
export async function fetchTaggoSubscription(qrId: string): Promise<SubscriptionReadResult> {
  if (!isTaggoId(qrId)) return { ok: false, reason: 'invalid_request' }

  let response: Response
  try {
    response = await fetch(`${STATUS_ENDPOINT}?qr_id=${encodeURIComponent(qrId)}`, {
      method: 'GET',
      headers: await authHeaders(),
    })
  } catch {
    return { ok: false, reason: 'network_error' }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'subscription_unavailable' }
  }

  if (!response.ok || !isRecord(body) || body.ok !== true) {
    return { ok: false, reason: toFailureReason(isRecord(body) ? body.code : null) }
  }

  return { ok: true, state: toSubscriptionState(body.subscription) }
}

/**
 * Demande un renouvellement manuel.
 *
 * N'envoie qu'un `qr_id`. Ni montant, ni durée, ni date : le serveur refuse tant
 * que le tarif n'est pas configuré, et ne déclare jamais un paiement réussi.
 */
export async function requestTaggoRenewal(qrId: string): Promise<SubscriptionActionResult> {
  if (!isTaggoId(qrId)) return { ok: false, reason: 'invalid_request' }

  let response: Response
  try {
    response = await fetch(`${RENEW_ENDPOINT}?qr_id=${encodeURIComponent(qrId)}`, {
      method: 'POST',
      headers: await authHeaders(),
    })
  } catch {
    return { ok: false, reason: 'network_error' }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'subscription_unavailable' }
  }

  if (!response.ok || !isRecord(body) || body.ok !== true) {
    return { ok: false, reason: toFailureReason(isRecord(body) ? body.code : null) }
  }

  return { ok: true }
}

/**
 * Enregistre la préférence de renouvellement automatique.
 *
 * Le booléen est une INTENTION : c'est la seule chose que le navigateur décide.
 * Aucune date n'est envoyée, donc aucune ne peut être prolongée depuis ici.
 */
export async function setTaggoAutoRenew(
  qrId: string,
  enabled: boolean,
): Promise<SubscriptionActionResult> {
  if (!isTaggoId(qrId)) return { ok: false, reason: 'invalid_request' }

  let response: Response
  try {
    response = await fetch(
      `${AUTO_RENEW_ENDPOINT}?qr_id=${encodeURIComponent(qrId)}&enabled=${enabled ? 'true' : 'false'}`,
      { method: 'POST', headers: await authHeaders() },
    )
  } catch {
    return { ok: false, reason: 'network_error' }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { ok: false, reason: 'subscription_unavailable' }
  }

  if (!response.ok || !isRecord(body) || body.ok !== true) {
    return { ok: false, reason: toFailureReason(isRecord(body) ? body.code : null) }
  }

  return { ok: true }
}