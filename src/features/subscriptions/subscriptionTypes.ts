/**
 * ÉTAPE 12 — Types des abonnements TAGGO (côté navigateur).
 *
 * AUCUN MONTANT N'EST DÉFINI ICI. Le contrat expose un booléen
 * `renewalAvailable` : tant que TAGGO n'a pas décidé de prix annuel, il est à
 * `false` et l'interface affiche « indisponible » plutôt qu'un tarif inventé.
 *
 * Le navigateur reçoit des FAITS, jamais des intentions à exécuter : il ne peut
 * ni prolonger une date, ni changer un statut, ni déclarer un paiement réussi.
 */

/** Statuts RÉELLEMENT stockés. Aucun statut d'affichage n'est stocké. */
export type TaggoSubscriptionStatus = 'active' | 'expired'

/** Origine de la période : première année incluse, ou renouvellement payé. */
export type TaggoSubscriptionSource = 'included' | 'renewal'

export type TaggoSubscriptionState = {
  /**
   * `false` = TAGGO SANS PÉRIODE : créé hors boutique, antérieur à l'étape 12,
   * ou période supprimée par erreur. Aucune période n'est inventée.
   *
   * ATTENTION : cet état BLOQUE l'accès public. « Non géré » ne veut pas dire
   * « accès libre » — voir `taggo_subscription_allows_public`. Le libellé affiché
   * (`unmanaged`) le dit explicitement pour que le propriétaire ne pense pas que
   * son TAGGO fonctionne.
   */
  managed: boolean
  /** `true` quand aucune période n'existe : l'accès public est refusé. */
  subscriptionRequired: boolean
  status: TaggoSubscriptionStatus | null
  source: TaggoSubscriptionSource | null
  autoRenew: boolean
  startedAt: string | null
  endsAt: string | null
  expiredAt: string | null
  /** Cycle de vie du TAGGO, tel que défini par l'étape 5 (`expired`, `active`…). */
  lifecycleStatus: string | null
  /** Vrai si la période se termine dans moins de 30 jours. État DÉRIVÉ. */
  expiringSoon: boolean
  renewalAvailable: boolean
}

export type SubscriptionFailureReason =
  | 'invalid_request'
  | 'unauthenticated'
  | 'not_owner'
  | 'subscription_unavailable'
  | 'no_valid_subscription'
  | 'renewal_unavailable'
  | 'network_error'

export type SubscriptionReadResult =
  | { ok: true; state: TaggoSubscriptionState }
  | { ok: false; reason: SubscriptionFailureReason }

export type SubscriptionActionResult =
  | { ok: true }
  | { ok: false; reason: SubscriptionFailureReason }

/**
 * Fenêtre « expire bientôt ». Ce n'est pas une durée commerciale : c'est un
 * seuil d'affichage, comme le seuil d'alerte d'une carte d'identité.
 */
export const EXPIRING_SOON_DAYS = 30

export const SUBSCRIPTION_FAILURE_MESSAGES: Record<SubscriptionFailureReason, string> = {
  invalid_request: 'Demande invalide.',
  unauthenticated: 'Session expirée. Reconnectez-vous pour voir vos abonnements.',
  not_owner: 'Ce TAGGO n’apparaît pas dans votre compte.',
  subscription_unavailable: 'Les informations d’abonnement sont temporairement indisponibles.',
  no_valid_subscription: 'Aucun renouvellement à effectuer.',
  renewal_unavailable: 'Le renouvellement n’est pas encore disponible.',
  network_error: 'Impossible de joindre le serveur.',
}

/**
 * Libellés du statut affiché.
 *
 * Le cycle de vie du TAGGO reste prioritaire : un TAGGO `suspended` ou
 * `replaced` n'est jamais présenté comme « expiré », même si sa période est
 * terminée. Confondre les deux donnerait au propriétaire une fausse cause.
 */
export type SubscriptionDisplay =
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'suspended'
  | 'replaced'
  | 'unmanaged'

export function toSubscriptionDisplay(state: TaggoSubscriptionState): SubscriptionDisplay {
  // Suspendu / remplacé / annulé : le cycle de vie prime, jamais l'abonnement.
  if (state.lifecycleStatus === 'suspended') return 'suspended'
  if (state.lifecycleStatus === 'replaced') return 'replaced'
  if (state.lifecycleStatus === 'cancelled') return 'expired'

  // Pas de période gérée : ce n'est pas « actif », c'est « non géré ».
  if (!state.managed) return 'unmanaged'

  if (state.status === 'expired') return 'expired'
  if (state.expiringSoon) return 'expiring_soon'
  return 'active'
}

export const SUBSCRIPTION_DISPLAY_LABELS: Record<SubscriptionDisplay, string> = {
  active: 'Actif',
  expiring_soon: 'Expire bientôt',
  expired: 'Expiré',
  suspended: 'Suspendu',
  replaced: 'Remplacé',
  unmanaged: 'Aucun abonnement — page publique désactivée',
}

export function subscriptionFailureMessage(reason: SubscriptionFailureReason): string {
  return SUBSCRIPTION_FAILURE_MESSAGES[reason]
}

/** Formatage de date en UTC, cohérent avec le reste de l'étape 11. */
export function formatSubscriptionDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    dateStyle: 'long',
  }).format(date)
}