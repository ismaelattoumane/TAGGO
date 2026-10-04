/**
 * Abonnements TAGGO en mode DÉMO (localStorage).
 *
 * WHY THIS EXISTS
 * ---------------
 * `LocalQrRepository` est le dépôt utilisé quand Supabase n'est pas configuré
 * (dev hors ligne, démo). Il doit malgré tout respecter EXACTEMENT la même règle
 * de visibilité publique que la base, sinon la règle testée en local ne serait
 * pas celle qui s'applique en production.
 *
 * Règle implémentée ici, identique à `taggo_subscription_allows_public` :
 *   - il faut UNE période `active` ET NON ÉCHUE ;
 *   - « aucune période » ne vaut PAS « accès public autorisé » : un TAGGO sans
 *     abonnement n'est PAS disponible publiquement.
 *
 * CE QUE CE MODULE NE FAIT PAS
 * ----------------------------
 * Il n'invente aucun prix, aucun identifiant Stripe, aucune fréquence de
 * paiement, et il n'est write que par `grantLocalIncludedPeriod`, qui représente
 * l'ouverture de la première année incluse. Il n'existe aucun chemin permettant
 * de fabriquer un renouvellement : comme en production, le renouvellement n'est
 * pas implémentable tant que son prix n'est pas décidé.
 *
 * DURÉE : une année CALENDAIRE, jamais 365 jours. Voir `addCalendarYear`.
 */

const STORAGE_KEY = 'taggo-demo-subscriptions'

export type LocalSubscriptionStatus = 'active' | 'expired'

export type LocalSubscription = {
  status: LocalSubscriptionStatus
  /** ISO. Rattachée au moment de l'ouverture de la période. */
  startedAt: string
  /** ISO. Fin de période : une année calendaire après `startedAt`. */
  endsAt: string
  autoRenew: boolean
}

export type LocalSubscriptionStore = Record<string, LocalSubscription>

/**
 * Ajoute UNE ANNÉE CALENDAIRE, avec les mêmes règles que
 * `timestamp + interval '1 year'` en PostgreSQL.
 *
 * Deux pièges réels, tous deux traités ici :
 *
 *   1. « + 365 jours » n'est PAS « + 1 an ». Entre le 1er mars 2028 et le
 *      1er mars 2029 il y a 366 jours. Une période calculée en jours expirerait
 *      un jour trop tôt, une fois tous les quatre ans.
 *
 *   2. Le 29 février n'existe pas tous les ans. PostgreSQL RECALE le jour sur le
 *      dernier jour valide du mois cible (29/02/2028 + 1 an = 28/02/2029), et ne
 *      déborde pas sur le 1er mars. `setFullYear` ferait exactement cela tout
 *      seul : `new Date(2028, 1, 29)` puis `setFullYear(2029)` donne le 1er mars
 *      2029. Le recalage explicite ci-dessous le rend déterministe et visible.
 *
 * L'heure et la minute sont conservées telles quelles : seule la durée est
 * concernée.
 */
export function addCalendarYear(startsAt: Date): Date {
  const startYear = startsAt.getFullYear()
  const endYear = startYear + 1

  // Dernier jour du mois cible : February est le seul cas à borner à 28 jours
  // lorsque la cible n'est pas bissextile.
  const lastDayOfTargetMonth = new Date(endYear, startsAt.getMonth() + 1, 0).getDate()
  const day = Math.min(startsAt.getDate(), lastDayOfTargetMonth)

  return new Date(
    endYear,
    startsAt.getMonth(),
    day,
    startsAt.getHours(),
    startsAt.getMinutes(),
    startsAt.getSeconds(),
    startsAt.getMilliseconds(),
  )
}

export function readLocalSubscriptions(): LocalSubscriptionStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as LocalSubscriptionStore) : {}
  } catch {
    return {}
  }
}

export function writeLocalSubscriptions(store: LocalSubscriptionStore): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

/**
 * Équivalent local de `taggo_subscription_allows_public`.
 *
 * `undefined` = aucune période pour ce TAGGO -> `false`. L'absence de période
 * est traitée comme un blocage, pas comme une autorisation : c'est la correction
 * qui empêche de contourner le modèle commercial.
 */
export function localSubscriptionAllowsPublic(
  subscription: LocalSubscription | undefined,
  now: Date = new Date(),
): boolean {
  if (!subscription) return false
  if (subscription.status !== 'active') return false
  const endsAt = Date.parse(subscription.endsAt)
  if (Number.isNaN(endsAt)) return false
  return endsAt > now.getTime()
}

/**
 * Ouvre la première année incluse d'un TAGGO. Idempotent comme
 * `grant_included_taggo_period` (`on conflict do nothing`) : un rejeu ne peut
 * pas allonger une période existante.
 */
export function grantLocalIncludedPeriod(qrId: string, startsAt: Date = new Date()): LocalSubscription {
  const store = readLocalSubscriptions()
  const existing = store[qrId]
  if (existing) return existing

  const subscription: LocalSubscription = {
    status: 'active',
    startedAt: startsAt.toISOString(),
    endsAt: addCalendarYear(startsAt).toISOString(),
    autoRenew: false,
  }
  store[qrId] = subscription
  writeLocalSubscriptions(store)
  return subscription
}

/**
 * Représente le balayage d'expiration : une période échue passe à `expired`.
 * Idempotent — une période déjà expirée n'est pas réécrite.
 *
 * Fonctionne sur l'horloge locale sans ce que la base fait en base : le
 * prédicat de visibilité (`localSubscriptionAllowsPublic`) compare de toute façon
 * `endsAt` à l'heure courante, donc une période échue est déjà bloquée même si
 * ce balayage n'a pas tourné. C'est exactement la barrière (1) / barrière (2)
 * de la migration.
 */
export function sweepLocalSubscriptions(now: Date = new Date()): number {
  const store = readLocalSubscriptions()
  let swept = 0
  for (const qrId of Object.keys(store)) {
    const subscription = store[qrId]
    if (subscription.status !== 'active') continue
    const endsAt = Date.parse(subscription.endsAt)
    if (Number.isNaN(endsAt) || endsAt > now.getTime()) continue
    store[qrId] = { ...subscription, status: 'expired' }
    swept += 1
  }
  if (swept > 0) writeLocalSubscriptions(store)
  return swept
}

/** Efface la période d'un TAGGO. Utilisé par les tests uniquement. */
export function clearLocalSubscription(qrId: string): void {
  const store = readLocalSubscriptions()
  if (!(qrId in store)) return
  delete store[qrId]
  writeLocalSubscriptions(store)
}