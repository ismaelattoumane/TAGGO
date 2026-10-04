/**
 * ÉTAPE 11 — Types des analytics de scans (côté navigateur).
 *
 * Ces types décrivent UNIQUEMENT ce que le serveur renvoie. Aucune donnée de
 * visiteur n'existe : il n'y a donc aucun type pour une IP, un device, un pays
 * ou un profil de visiteur, et il n'en faut pas.
 */

/** Périodes proposées. Aucune période libre n'est acceptée par le serveur. */
export const SCAN_PERIODS = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
] as const

export type ScanPeriodDays = (typeof SCAN_PERIODS)[number]['days']

export const DEFAULT_SCAN_PERIOD: ScanPeriodDays = 30

export type ScanBucket = 'day' | 'week'

export type ScanPoint = {
  /** Début du bucket en ISO, calculé en UTC par la base. */
  bucketStart: string
  scans: number
}

export type RecentScan = {
  scannedAt: string
}

export type TaggoScanStats = {
  total: number
  today: number
  last7: number
  last30: number
  days: ScanPeriodDays
  bucket: ScanBucket
  series: ScanPoint[]
  recent: RecentScan[]
}

/** Aucune statistique n'est inventée : une TAGGO sans scan vaut zéro partout. */
export function emptyScanStats(days: ScanPeriodDays = DEFAULT_SCAN_PERIOD): TaggoScanStats {
  return {
    total: 0,
    today: 0,
    last7: 0,
    last30: 0,
    days,
    bucket: days === 90 ? 'week' : 'day',
    series: [],
    recent: [],
  }
}

export function isScanPeriodDays(value: unknown): value is ScanPeriodDays {
  return value === 7 || value === 30 || value === 90
}

export type ScanStatsFailure =
  | 'invalid_request'
  | 'invalid_period'
  | 'unauthenticated'
  | 'not_owner'
  | 'analytics_unavailable'
  | 'network_error'

export const SCAN_STATS_MESSAGES: Record<ScanStatsFailure, string> = {
  invalid_request: 'Impossible de charger les scans de ce TAGGO.',
  invalid_period: 'Période non prise en charge.',
  unauthenticated: 'Session expirée. Reconnectez-vous pour voir vos scans.',
  not_owner: 'Ce TAGGO n’apparaît pas dans votre compte.',
  analytics_unavailable: 'Les analytics sont temporairement indisponibles.',
  network_error: 'Impossible de joindre le serveur de statistiques.',
}

export type ScanStatsResponse =
  | { ok: true; stats: TaggoScanStats }
  | { ok: false; reason: ScanStatsFailure }

export function scanStatsErrorMessage(reason: ScanStatsFailure): string {
  return SCAN_STATS_MESSAGES[reason]
}
