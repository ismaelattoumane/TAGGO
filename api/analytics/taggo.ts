import {
  getTaggoScanStats,
  isScanPeriodDays,
  isUuid,
  SCAN_PERIOD_DAYS,
  type ScanPeriodDays,
  type ScanStatsFailure,
} from '../_lib/analyticsServer'
import { isServerDatabaseConfigured, readServerEnv } from '../_lib/env'
import { json } from '../_lib/http'
import { createServerSupabase, extractBearerToken, resolveAuthenticatedUser } from '../_lib/supabaseAdmin'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * ÉTAPE 11 — GET /api/analytics/taggo?qr_id=…&days=7|30|90
 *
 * Analytics d'UN TAGGO, lisibles par son propriétaire uniquement.
 *
 * SÉCURITÉ :
 * - l'identité vient du JWT (`resolveAuthenticatedUser`), jamais d'un paramètre ;
 * - `owner_id` n'est jamais lu dans la requête : c'est l'identifiant de
 *   l'utilisateur authentifié qui est transmis à la base ;
 * - l'appartenance est revérifiée en SQL contre `qr_codes.owner_id` ;
 * - aucune donnée de visiteur n'existe en base, donc aucune ne peut sortir.
 *
 * READ-ONLY : cette route n'écrit rien. Seul `/api/analytics/scan` écrit.
 */

const STATUS_BY_FAILURE: Record<ScanStatsFailure, number> = {
  invalid_request: 400,
  invalid_period: 400,
  unauthenticated: 401,
  not_owner: 403,
  analytics_unavailable: 503,
}

const FAILURE_MESSAGE: Record<ScanStatsFailure, string> = {
  invalid_request: 'Demande invalide.',
  invalid_period: 'Période non prise en charge.',
  unauthenticated: 'Authentification requise.',
  not_owner: 'TAGGO introuvable dans votre compte.',
  analytics_unavailable: 'Analytics temporairement indisponibles.',
}

function readDays(value: unknown): ScanPeriodDays | null {
  const parsed = typeof value === 'string' ? Number(value) : NaN
  return isScanPeriodDays(parsed) ? parsed : null
}

export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    return { status: 405, body: { ok: false }, headers: { allow: 'GET' } }
  }

  const qrId = typeof req.query?.qr_id === 'string' ? req.query.qr_id.trim() : ''
  if (!isUuid(qrId)) {
    return json(STATUS_BY_FAILURE.invalid_request, {
      ok: false,
      code: 'invalid_request',
      message: FAILURE_MESSAGE.invalid_request,
    })
  }

  const days = readDays(req.query?.days)
  if (days === null) {
    return json(STATUS_BY_FAILURE.invalid_period, {
      ok: false,
      code: 'invalid_period',
      message: FAILURE_MESSAGE.invalid_period,
    })
  }

  const env = readServerEnv()
  if (!isServerDatabaseConfigured(env)) {
    return json(STATUS_BY_FAILURE.analytics_unavailable, {
      ok: false,
      code: 'analytics_unavailable',
      message: FAILURE_MESSAGE.analytics_unavailable,
    })
  }

  let supabase
  try {
    supabase = createServerSupabase(env)
  } catch {
    return json(STATUS_BY_FAILURE.analytics_unavailable, {
      ok: false,
      code: 'analytics_unavailable',
      message: FAILURE_MESSAGE.analytics_unavailable,
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

  const result = await getTaggoScanStats(supabase, { qrId, ownerId: user.id, days })

  if (!result.ok) {
    return json(STATUS_BY_FAILURE[result.reason], {
      ok: false,
      code: result.reason,
      message: FAILURE_MESSAGE[result.reason],
    })
  }

  return json(200, {
    ok: true,
    qrId,
    days: result.stats.days,
    bucket: result.stats.bucket,
    total: result.stats.total,
    today: result.stats.today,
    last7: result.stats.last7,
    last30: result.stats.last30,
    series: result.stats.series,
    recent: result.stats.recent,
    // Périodes réellement acceptées : le client n'invente pas les siennes.
    availablePeriods: [...SCAN_PERIOD_DAYS],
  })
}
