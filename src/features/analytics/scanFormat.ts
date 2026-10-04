/**
 * ÉTAPE 11 — Formateurs de dates des analytics.
 *
 * Isolés dans leur propre module (et non dans le composant qui les consomme)
 * pour deux raisons :
 *  - les buckets sont calculés en base en UTC ; formater avec le fuseau local
 *    du navigateur afficherait un jour différent de celui qui a été compté ;
 *  - ils sont réutilisés par le panneau et par le graphique, et un fichier qui
 *    exporte à la fois un composant et des fonctions casse le Fast Refresh.
 */

function formatUtcDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'UTC' }).format(date)
}

/** Étiquette d'un bucket journalier, ex. « 01 oct. ». */
export function formatBucketDay(bucketStart: string): string {
  return formatUtcDate(new Date(bucketStart), { day: '2-digit', month: 'short' })
}

/**
 * Étiquette d'un bucket hebdomadaire : le préfixe « sem. » évite de faire
 * croire à une mesure quotidienne sur la période de 90 jours.
 */
export function formatBucketWeek(bucketStart: string): string {
  const formatted = formatBucketDay(bucketStart)
  return formatted ? `sem. ${formatted}` : ''
}

/** Horodatage d'un scan récent, ex. « 01/10/2026 14:05 ». */
export function formatScanTimestamp(scannedAt: string): string {
  return formatUtcDate(new Date(scannedAt), { dateStyle: 'short', timeStyle: 'short' })
}