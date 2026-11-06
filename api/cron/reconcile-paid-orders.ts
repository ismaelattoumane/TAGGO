import { timingSafeEqual } from 'node:crypto'
import { readServerEnv, isServerDatabaseConfigured } from '../_lib/env'
import { getHeader, json } from '../_lib/http'
import { createServerSupabase } from '../_lib/supabaseAdmin'
import { reserveTaggos } from '../_lib/orderServer'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ApiRequest, ApiResponse } from '../_lib/types'

type PendingOrder = {
  order_id: string
  taggo_quantity: number
}

function hasValidCronAuthorization(header: string | null, secret: string): boolean {
  if (!header) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(header)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/**
 * GET /api/cron/reconcile-paid-orders
 *
 * Tâche interne Vercel : répare les commandes payées qui n'ont pas encore reçu
 * tous leurs TAGGO. Le secret CRON_SECRET est obligatoire et la RPC SQL ne
 * retourne que les commandes réellement sous-équipées.
 */
export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  if ((req.method ?? 'GET').toUpperCase() !== 'GET') {
    return json(405, { ok: false, error: 'method_not_allowed' })
  }

  const env = readServerEnv()
  if (!env.cronSecret) {
    return json(503, { ok: false, error: 'cron_not_configured' })
  }

  if (!hasValidCronAuthorization(getHeader(req, 'authorization'), env.cronSecret)) {
    return json(401, { ok: false, error: 'unauthorized' })
  }

  if (!isServerDatabaseConfigured(env)) {
    return json(503, { ok: false, error: 'database_unavailable' })
  }

  let supabase: SupabaseClient
  try {
    supabase = createServerSupabase(env)
  } catch {
    return json(503, { ok: false, error: 'database_unavailable' })
  }

  const result = (await supabase.rpc('list_paid_orders_pending_taggos', {
    p_limit: 100,
  })) as { data: PendingOrder[] | null; error: { message: string } | null }

  if (result.error || !result.data) {
    return json(500, { ok: false, error: 'reconciliation_query_failed' })
  }

  let recovered = 0
  let failed = 0

  for (const order of result.data) {
    try {
      await reserveTaggos(supabase, order.order_id, order.taggo_quantity)
      recovered += 1
    } catch {
      // Le paiement reste acquis. La prochaine exécution reprendra cette commande.
      failed += 1
    }
  }

  return json(200, {
    ok: true,
    scanned: result.data.length,
    recovered,
    failed,
  })
}
