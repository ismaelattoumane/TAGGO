import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuid } from './catalogTypes'

/**
 * ÉTAPE 12 — Accès serveur aux abonnements TAGGO.
 *
 * RÈGLE CENTRALE : le navigateur ne fournit que des INTENTIONS (« je veux
 * renouveler », « je veux un renouvellement automatique »). Tout ce qui touche
 * à l'argent, aux dates et aux statuts est déterminé ici et en base.
 *
 * Aucun prix, aucun montant et aucun Price ID n'est défini dans ce module.
 * Tant que le tarif de renouvellement n'est pas configuré par TAGGO,
 * `renewal_unavailable` est la seule réponse possible.
 */

export const SUBSCRIPTION_PERIOD_MONTHS = 12

/** Libellé technique du plan. Ce n'est PAS une offre commerciale ni un prix. */
export const TAGGO_PLAN_LABEL = 'taggo_annual'

/**
 * Fenêtre « expire bientôt » affichée au propriétaire. Ce n'est PAS un statut
 * stocké : c'est un état dérivé de la distance à `ends_at`, donc toujours vrai
 * même si aucun job n'a tourné.
 */
export const EXPIRING_SOON_DAYS = 30

export type SubscriptionStatus = 'active' | 'expired'

export type SubscriptionSource = 'included' | 'renewal'

export type TaggoSubscriptionState = {
  /** `false` = TAGGO sans période (hors boutique / antérieur à l'étape 12). */
  managed: boolean
  /**
   * `true` quand aucune période ne couvre le TAGGO. Cet état BLOQUE l'accès
   * public : « pas de période » ne vaut jamais « accès libre ». Ce n'est pas une
   * expiration, et le propriétaire doit pouvoir distinguer les deux.
   */
  subscriptionRequired: boolean
  status: SubscriptionStatus | null
  source: SubscriptionSource | null
  autoRenew: boolean
  startedAt: string | null
  endsAt: string | null
  expiredAt: string | null
  lifecycleStatus: string | null
  /** `true` quand la période se termine dans moins de `EXPIRING_SOON_DAYS`. */
  expiringSoon: boolean
  /**
   * `false` tant que TAGGO n'a pas configuré de tarif de renouvellement.
   * Le client affiche alors « indisponible » plutôt qu'un montant inventé.
   */
  renewalAvailable: boolean
}

export type SubscriptionFailureReason =
  | 'invalid_request'
  | 'unauthenticated'
  | 'not_owner'
  | 'subscription_unavailable'
  | 'no_valid_subscription'
  | 'renewal_unavailable'

export type SubscriptionReadResult =
  | { ok: true; state: TaggoSubscriptionState }
  | { ok: false; reason: SubscriptionFailureReason }

export type RenewOutcome =
  | { ok: true; taggoId: string; startsAt: string; endsAt: string }
  | { ok: false; reason: SubscriptionFailureReason }

type RpcResult<T> = { data: T | null; error: { message: string } | null }

function asText(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asTimestamp(value: unknown): string | null {
  const text = asText(value)
  return text && !Number.isNaN(new Date(text).getTime()) ? text : null
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return value === 'active' || value === 'expired'
}

function isSubscriptionSource(value: unknown): value is SubscriptionSource {
  return value === 'included' || value === 'renewal'
}

/**
 * Nombre de jours restants avant la fin de période.
 *
 * Une période déjà terminée vaut 0 : elle ne doit jamais être présentée comme
 * « encore N jours » au propriétaire.
 */
export function daysUntil(endsAt: string | null, now: number = Date.now()): number | null {
  const end = asTimestamp(endsAt)
  if (end === null) return null
  const diff = new Date(end).getTime() - now
  if (diff <= 0) return 0
  return Math.ceil(diff / 86_400_000)
}

/**
 * Convertit la charge utile SQL en état affichable.
 *
 * `expiringSoon` est CALCULÉ ici et non stocké : un état stocké exigerait un job
 * pour rester juste, alors qu'une distance se recalcule à chaque lecture.
 */
export function toTaggoSubscriptionState(
  payload: unknown,
  renewalAvailable: boolean,
  now: number = Date.now(),
): TaggoSubscriptionState {
  const row = (payload ?? {}) as Record<string, unknown>
  const managed = row.managed === true
  const endsAt = asTimestamp(row.ends_at)
  const remaining = daysUntil(endsAt, now)

  return {
    managed,
    // Aucune période -> accès public refusé (`taggo_subscription_allows_public`).
    // Le défaut est `true` quand le serveur ne dit rien : le navigateur ne doit
    // jamais supposer qu'un TAGGO sans période reste publiquement accessible.
    subscriptionRequired: row.subscription_required === true || !managed,
    status: isSubscriptionStatus(row.subscription_status) ? row.subscription_status : null,
    source: isSubscriptionSource(row.source) ? row.source : null,
    autoRenew: row.auto_renew === true,
    startedAt: asTimestamp(row.started_at),
    endsAt,
    expiredAt: asTimestamp(row.expired_at),
    lifecycleStatus: asText(row.lifecycle_status),
    expiringSoon:
      managed &&
      row.subscription_status === 'active' &&
      remaining !== null &&
      remaining > 0 &&
      remaining <= EXPIRING_SOON_DAYS,
    renewalAvailable,
  }
}

/** Lecture de l'état d'abonnement d'un TAGGO (propriétaire vérifié en base). */
export async function getTaggoSubscriptionState(
  client: SupabaseClient,
  input: { qrId: string; ownerId: string; renewalAvailable: boolean },
): Promise<SubscriptionReadResult> {
  if (!isUuid(input.qrId) || !isUuid(input.ownerId)) {
    return { ok: false, reason: 'invalid_request' }
  }

  let result: RpcResult<unknown>
  try {
    result = (await client.rpc('get_taggo_subscription_status', {
      p_qr_id: input.qrId,
      p_owner_id: input.ownerId,
    })) as RpcResult<unknown>
  } catch {
    return { ok: false, reason: 'subscription_unavailable' }
  }

  // Une panne ne doit JAMAIS devenir « aucune période » : ce serait un faux
  // « votre TAGGO a expiré », qui peut faire paniquer un client à tort.
  if (result.error) return { ok: false, reason: 'subscription_unavailable' }

  const row = (result.data ?? {}) as Record<string, unknown>
  if (row.ok !== true) {
    return { ok: false, reason: 'not_owner' }
  }

  return { ok: true, state: toTaggoSubscriptionState(result.data, input.renewalAvailable) }
}

/**
 * Le tarif de renouvellement est-il configuré ?
 *
 * VALEUR FORCEE A `false`. TAGGO n'a pas arrêté de prix de renouvellement, et
 * aucun Price ID Stripe n'existe dans ce projet. Inventer un montant, une
 * fréquence ou un identifiant de prix serait fabriquer une décision
 * commerciale.
 *
 * Tant que ce drapeau est à `false` :
 *   - le tableau de bord affiche « renouvellement indisponible » ;
 *   - `POST /api/subscriptions/renew` refuse en `renewal_unavailable` ;
 *   - aucune session de paiement n'est créée, donc aucune fausse commande.
 *
 * Pour l'activer, TAGGO devra : fixer le tarif annuel, créer le Price ID dans
 * Stripe (mode test), puis brancher une session `mode: 'subscription'` et
 * l'événement de webhook correspondant. Voir docs/subscriptions.md § À DÉCIDER.
 */
export const RENEWAL_PRICE_CONFIGURED = false

/**
 * Demande de renouvellement manuel.
 *
 * CE QUE CETTE FONCTION NE FAIT PAS, délibérément :
 *   - elle ne crée pas de session Stripe (aucun prix n'est configuré) ;
 *   - elle ne modifie aucun statut ;
 *   - elle ne prolonge aucune date.
 *
 * Elle refuse systématiquement tant que le tarif n'est pas décidé. Aucun
 * montant n'est retourné, aucun statut n'est touché : la seule réponse possible
 * est `renewal_unavailable`. Une « commande » créée ici serait une fausse
 * commande.
 */
export async function requestTaggoRenewal(
  _client: SupabaseClient,
  input: { qrId: string; ownerId: string },
): Promise<RenewOutcome> {
  if (!isUuid(input.qrId) || !isUuid(input.ownerId)) {
    return { ok: false, reason: 'invalid_request' }
  }

  return { ok: false, reason: 'renewal_unavailable' }
}

/**
 * Préférence de renouvellement automatique.
 *
 * Le booléen est une INTENTION : la fonction SQL ne touche qu'à `auto_renew` et
 * revérifie l'appartenance du TAGGO. Elle ne peut ni changer un statut, ni
 * déplacer une date.
 */
export async function setTaggoAutoRenew(
  client: SupabaseClient,
  input: { qrId: string; ownerId: string; autoRenew: boolean },
): Promise<{ ok: true } | { ok: false; reason: SubscriptionFailureReason }> {
  if (!isUuid(input.qrId) || !isUuid(input.ownerId)) {
    return { ok: false, reason: 'invalid_request' }
  }

  let result: RpcResult<boolean>
  try {
    result = (await client.rpc('set_taggo_auto_renew', {
      p_qr_id: input.qrId,
      p_owner_id: input.ownerId,
      p_auto_renew: input.autoRenew,
    })) as RpcResult<boolean>
  } catch {
    return { ok: false, reason: 'subscription_unavailable' }
  }

  if (result.error) return { ok: false, reason: 'subscription_unavailable' }
  if (result.data !== true) return { ok: false, reason: 'not_owner' }

  return { ok: true }
}