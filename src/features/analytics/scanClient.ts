import { supabase } from '../../lib/supabase'
import {
  isScanPeriodDays,
  type RecentScan,
  type ScanBucket,
  type ScanPeriodDays,
  type ScanPoint,
  type ScanStatsFailure,
  type ScanStatsResponse,
  type TaggoScanStats,
} from './analyticsTypes'

/**
 * ÉTAPE 11 — Client analytics (navigateur).
 *
 * RÈGLES :
 * - le frontend n'ENREGISTRE jamais un scan lui-même en base : il appelle
 *   `/api/analytics/scan`, qui est la seule voie d'écriture (serveur) ;
 * - la lecture passe par `/api/analytics/taggo`, qui vérifie le JWT et
 *   l'appartenance côté serveur ET en base ;
 * - le `qr_id` envoyé est l'identifiant interne du TAGGO affiché dans le
 *   dashboard ; il ne permet rien sans le JWT du propriétaire correspondant ;
 * - aucune valeur renvoyée par le serveur n'est considérée comme fiable : chaque
 *   champ est normalisé, et un TAGGO sans scan reste à 0 (aucun chiffre
 *   n'est inventé pour une période vide).
 */

const SCAN_ENDPOINT = '/api/analytics/scan'
const STATS_ENDPOINT = '/api/analytics/taggo'

/** Identifiant interne d'un TAGGO, tel qu'affiché dans le dashboard. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isTaggoId(value: string): boolean {
  return UUID_PATTERN.test(value.trim())
}

/** Code public `TGG-XXXXXXX` : seule donnée qu'un visiteur peut fournir. */
const PUBLIC_ID_PATTERN = /^TGG-[A-Z0-9]{7}$/

export function isPublicTaggoCode(value: string): boolean {
  return PUBLIC_ID_PATTERN.test(value.trim().toUpperCase())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0
}

function toIso(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function toScanPeriods(value: unknown, fallback: ScanPeriodDays): ScanPeriodDays {
  return isScanPeriodDays(value) ? value : fallback
}

function toBucket(value: unknown): ScanBucket {
  return value === 'week' ? 'week' : 'day'
}

function toSeries(value: unknown): ScanPoint[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!isRecord(entry)) return null
      const bucketStart = toIso(entry.bucketStart ?? entry.bucket_start)
      return bucketStart ? { bucketStart, scans: toCount(entry.scans) } : null
    })
    .filter((point): point is ScanPoint => point !== null)
}

function toRecent(value: unknown): RecentScan[] {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => {
      if (!isRecord(entry)) return null
      const scannedAt = toIso(entry.scannedAt ?? entry.scanned_at)
      return scannedAt ? { scannedAt } : null
    })
    .filter((entry): entry is RecentScan => entry !== null)
}

function toStats(body: unknown, requestedDays: ScanPeriodDays): TaggoScanStats {
  const data = isRecord(body) ? body : {}

  return {
    total: toCount(data.total),
    today: toCount(data.today),
    last7: toCount(data.last7),
    last30: toCount(data.last30),
    days: toScanPeriods(data.days, requestedDays),
    bucket: toBucket(data.bucket),
    series: toSeries(data.series),
    recent: toRecent(data.recent),
  }
}

const FAILURES: readonly ScanStatsFailure[] = [
  'invalid_request',
  'invalid_period',
  'unauthenticated',
  'not_owner',
  'analytics_unavailable',
]

function toFailure(body: unknown): ScanStatsFailure {
  const code = isRecord(body) && typeof body.code === 'string' ? body.code : ''
  return (FAILURES as readonly string[]).includes(code) ? (code as ScanStatsFailure) : 'invalid_request'
}

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } }
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Enregistre un scan depuis la page publique `/t/:tag`.
 *
 * PRINCIPE CRITIQUE — l'analytics ne doit jamais bloquer le visiteur :
 * toute erreur réseau, tout 404, tout 500 est absorbé et renvoyé `false`.
 * La page publique affiche la destination quoi qu'il arrive.
 *
 * Le navigateur n'envoie QUE le code public : ni `qr_code_id`, ni `owner_id`,
 * ni horodatage, ni compteur.
 */
export async function recordTaggoScan(publicId: string): Promise<boolean> {
  if (!isPublicTaggoCode(publicId)) return false

  try {
    const response = await fetch(`${SCAN_ENDPOINT}?public_id=${encodeURIComponent(publicId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `keepalive` tolère la fermeture/navigation immédiate de l'onglet.
      keepalive: true,
    })
    const body = await readJson(response)
    return isRecord(body) && body.ok === true && body.recorded === true
  } catch {
    return false
  }
}

/**
 * Charge les analytics d'un TAGGO pour son propriétaire.
 *
 * N'envoie que l'identifiant du TAGGO, la période et le JWT. Ne reçoit que des
 * agrégats : aucune ligne de scan n'est exposée, seulement des horodatages.
 */
export async function fetchTaggoScanStats(
  qrId: string,
  days: ScanPeriodDays,
): Promise<ScanStatsResponse> {
  if (!isTaggoId(qrId) || !isScanPeriodDays(days)) {
    return { ok: false, reason: 'invalid_request' }
  }

  let response: Response
  try {
    response = await fetch(
      `${STATS_ENDPOINT}?qr_id=${encodeURIComponent(qrId)}&days=${encodeURIComponent(String(days))}`,
      { headers: await authHeaders() },
    )
  } catch {
    return { ok: false, reason: 'network_error' }
  }

  const body = await readJson(response)

  if (!response.ok || !isRecord(body) || body.ok !== true) {
    return { ok: false, reason: toFailure(body) }
  }

  return { ok: true, stats: toStats(body, days) }
}
