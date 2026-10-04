import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * ÉTAPE 11 — Analytics de scans côté serveur.
 *
 * Toutes les fonctions reçoivent le client `service_role` en paramètre : elles
 * sont donc testables avec un double, comme les autres modules `api/_lib/`.
 *
 * RÈGLES NON NÉGOCIABLES :
 * - le navigateur ne fournit QUE le code public du TAGGO (`TGG-XXXXXXX`) ;
 * - `qr_code_id`, `owner_id`, `scanned_at` sont déterminés côté serveur / base ;
 * - aucun IP, User-Agent, cookie ni identifiant de visiteur n'est lu ni stocké ;
 * - une panne analytics ne doit jamais faire échouer la résolution du TAGGO :
 *   les fonctions d'écriture renvoient un statut au lieu de lever.
 */

/** Fenêtre anti-abus appliquée par la base. Miroir de la valeur SQL. */
export const TAGGO_SCAN_MIN_INTERVAL_SECONDS = 30

/** Granularité d'agrégation acceptée par la base. */
export type ScanBucket = 'day' | 'week'

/** Périodes proposées dans le dashboard. Aucune période arbitraire. */
export const SCAN_PERIOD_DAYS = [7, 30, 90] as const
export type ScanPeriodDays = (typeof SCAN_PERIOD_DAYS)[number]

/**
 * 90 points/jour rendraient le graphique illisible : la granularité
 * hebdomadaire est imposée au-delà de 30 jours.
 */
export function bucketForPeriod(days: ScanPeriodDays): ScanBucket {
  return days === 90 ? 'week' : 'day'
}

export function isScanPeriodDays(value: unknown): value is ScanPeriodDays {
  return typeof value === 'number' && (SCAN_PERIOD_DAYS as readonly number[]).includes(value)
}

/** Format du code public TAGGO : le serveur n'accepte que cette forme. */
const PUBLIC_ID_PATTERN = /^TGG-[A-Z0-9]{7}$/

export function normalizePublicId(value: string): string {
  return value.trim().toUpperCase()
}

export function isValidPublicId(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(normalizePublicId(value))
}

/** Format interne d'un identifiant TAGGO (uuid), utilisé pour les paramètres. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

/** Résultat de l'enregistrement d'un scan. Aucun détail technique n'est exposé. */
export type RecordScanOutcome = 'recorded' | 'duplicate' | 'not_found' | 'not_active' | 'unavailable'

const RECORD_OUTCOMES: readonly string[] = ['recorded', 'duplicate', 'not_found', 'not_active']

/**
 * Enregistre UN scan pour le TAGGO correspondant au code public.
 *
 * Le code est transmis tel quel à la base : c'est la fonction SQL
 * `record_taggo_scan` qui résout le TAGGO, contrôle son état, applique la
 * fenêtre anti-abus et pose l'horodatage. Le serveur n'invente rien.
 *
 * Ne lève jamais : un échec est reported comme `unavailable` afin que la page
 * publique puisse poursuivre son affichage normalement.
 */
export async function recordTaggoScan(
  client: SupabaseClient,
  publicId: string,
): Promise<RecordScanOutcome> {
  if (!isValidPublicId(publicId)) return 'not_found'

  try {
    const { data, error } = await client.rpc('record_taggo_scan', {
      p_public_id: normalizePublicId(publicId),
    })
    if (error) return 'unavailable'

    return typeof data === 'string' && RECORD_OUTCOMES.includes(data)
      ? (data as RecordScanOutcome)
      : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export type ScanPoint = { bucketStart: string; scans: number }

export type RecentScan = { scannedAt: string }

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

/**
 * Raisons d'échec de la lecture d'analytics, volontairement distinctes des
 * erreurs de paiement (étape 9) : aucune modification de `api/_lib/errors.ts`.
 */
export type ScanStatsFailure = 'invalid_request' | 'invalid_period' | 'unauthenticated' | 'not_owner' | 'analytics_unavailable'

type StatsRpcPayload = {
  ok?: unknown
  reason?: unknown
  total?: unknown
  today?: unknown
  last_7?: unknown
  last_30?: unknown
  days?: unknown
  bucket?: unknown
  series?: unknown
  recent?: unknown
}

function toCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0
}

function toIsoString(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : ''
}

/**
 * Normalise la charge utile de `get_taggo_scan_stats` en une structure stable.
 * Toute valeur absente ou malformée devient 0 / tableau vide : aucune
 * statistique n'est inventée à partir d'une réponse serveur invalide.
 */
export function toTaggoScanStats(payload: unknown, requestedDays: ScanPeriodDays): TaggoScanStats {
  const data = (payload ?? {}) as StatsRpcPayload
  const series = Array.isArray(data.series) ? data.series : []
  const recent = Array.isArray(data.recent) ? data.recent : []

  return {
    total: toCount(data.total),
    today: toCount(data.today),
    last7: toCount(data.last_7),
    last30: toCount(data.last_30),
    days: isScanPeriodDays(data.days) ? data.days : requestedDays,
    bucket: data.bucket === 'week' ? 'week' : 'day',
    series: series
      .map((point) => {
        const entry = (point ?? {}) as { bucket_start?: unknown; bucketStart?: unknown; scans?: unknown }
        const bucketStart = toIsoString(entry.bucket_start ?? entry.bucketStart)
        return bucketStart ? { bucketStart, scans: toCount(entry.scans) } : null
      })
      .filter((point): point is ScanPoint => point !== null),
    recent: recent
      .map((entry) => {
        const scannedAt = toIsoString((entry as { scanned_at?: unknown; scannedAt?: unknown } | null)?.scanned_at
          ?? (entry as { scannedAt?: unknown } | null)?.scannedAt)
        return scannedAt ? { scannedAt } : null
      })
      .filter((point): point is RecentScan => point !== null),
  }
}

export type ScanStatsResult =
  | { ok: true; stats: TaggoScanStats }
  | { ok: false; reason: ScanStatsFailure }

/**
 * Lit les analytics d'UN TAGGO pour son propriétaire.
 *
 * `ownerId` provient du JWT (résolu par `resolveAuthenticatedUser`) et non du
 * corps de la requête. L'appartenance est vérifiée ici ET dans la fonction SQL
 * (défense en profondeur : le client `service_role` contourne la RLS, donc
 * chaque vérification serveur est obligatoire).
 */
export async function getTaggoScanStats(
  client: SupabaseClient,
  input: { qrId: string; ownerId: string; days: ScanPeriodDays },
): Promise<ScanStatsResult> {
  if (!isUuid(input.qrId) || !isUuid(input.ownerId) || !isScanPeriodDays(input.days)) {
    return { ok: false, reason: 'invalid_request' }
  }

  let data: unknown
  try {
    const { data: payload, error } = await client.rpc('get_taggo_scan_stats', {
      p_qr_id: input.qrId.trim(),
      p_owner_id: input.ownerId.trim(),
      p_days: input.days,
      p_bucket: bucketForPeriod(input.days),
    })
    if (error) return { ok: false, reason: 'analytics_unavailable' }
    data = payload
  } catch {
    return { ok: false, reason: 'analytics_unavailable' }
  }

  const result = (data ?? {}) as StatsRpcPayload

  if (result.ok !== true) {
    const reason = typeof result.reason === 'string' ? result.reason : ''
    if (reason === 'not_owner' || reason === 'invalid_period') {
      return { ok: false, reason }
    }
    return { ok: false, reason: 'invalid_request' }
  }

  return { ok: true, stats: toTaggoScanStats(result, input.days) }
}
