import { recordTaggoScan, type RecordScanOutcome } from '../_lib/analyticsServer'
import { isServerDatabaseConfigured, readServerEnv } from '../_lib/env'
import { json } from '../_lib/http'
import { createServerSupabase } from '../_lib/supabaseAdmin'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * ÉTAPE 11 — POST /api/analytics/scan?public_id=TGG-XXXXXXX
 *
 * Enregistre UN scan. Endpoint PUBLIC : c'est un visiteur non authentifié qui
 * scanne un QR physique, il n'a pas de compte et ne doit pas en créer un.
 *
 * Ce que le visiteur peut fournir : le code public du TAGGO, et rien d'autre.
 * Ce que le serveur détermine : le TAGGO visé, son état, l'horodatage, et
 * l'éventuel rejet par la fenêtre anti-abus.
 *
 * Réponse volontairement pauvre : ni `qr_code_id`, ni `owner_id`, ni IP, ni
 * compteur cumulé. Un attaquant n'a donc rien à exploiter ni à rejouer.
 *
 * Une panne analytics ne doit JAMAIS être visible par le visiteur : en cas
 * d'échec, la réponse reste `200` avec `recorded: false`.
 */

const STATUS_BY_OUTCOME: Record<RecordScanOutcome, number> = {
  recorded: 201,
  duplicate: 200,
  not_found: 200,
  not_active: 200,
  unavailable: 200,
}

export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    return { status: 405, body: { ok: false }, headers: { allow: 'POST' } }
  }

  const rawPublicId = typeof req.query?.public_id === 'string' ? req.query.public_id : ''
  const env = readServerEnv()

  let outcome: RecordScanOutcome = 'unavailable'

  if (isServerDatabaseConfigured(env)) {
    try {
      outcome = await recordTaggoScan(createServerSupabase(env), rawPublicId)
    } catch {
      outcome = 'unavailable'
    }
  }

  return {
    ...json(STATUS_BY_OUTCOME[outcome], {
      ok: true,
      recorded: outcome === 'recorded',
      // Raison utile au client uniquement pour décider s'il doit réessayer.
      // Elle ne distingue pas « TAGGO inexistant » de « TAGGO inactif ».
      outcome,
    }),
    // Un scan ne doit jamais être mis en cache par un proxy ou un navigateur.
    headers: { 'cache-control': 'no-store' },
  }
}
