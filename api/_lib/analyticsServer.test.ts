import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  bucketForPeriod,
  getTaggoScanStats,
  isScanPeriodDays,
  isUuid,
  isValidPublicId,
  normalizePublicId,
  recordTaggoScan,
  toTaggoScanStats,
  SCAN_PERIOD_DAYS,
  TAGGO_SCAN_MIN_INTERVAL_SECONDS,
} from './analyticsServer'

/**
 * ÉTAPE 11 — Tests de la logique serveur d'analytics.
 *
 * Le client Supabase est un double : on vérifie ce que le serveur transmet à la
 * base, ce qu'il refuse, et ce qu'il expose. Aucune donnée de test n'est
 * injectée comme un « scan réel » : les valeurs ci-dessous sont des doubles de
 * test explicites, jamais des statistiques de production.
 */

const QR_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_QR_ID = '22222222-2222-4222-8222-222222222222'
const OWNER_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_OWNER_ID = '44444444-4444-4444-8444-444444444444'
const PUBLIC_ID = 'TGG-ABCD234'

type RpcCall = { fn: string; args: Record<string, unknown> }

function fakeClient(result: { data?: unknown; error?: unknown } | ((args: Record<string, unknown>) => { data?: unknown; error?: unknown })) {
  const calls: RpcCall[] = []

  const client = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return typeof result === 'function' ? result(args) : result
    }),
  }

  return { client: client as unknown as SupabaseClient, calls }
}

describe('normalisation des identifiants', () => {
  it('n’accepte que le format public TGG-XXXXXXX', () => {
    expect(isValidPublicId(PUBLIC_ID)).toBe(true)
    expect(isValidPublicId('  tgg-abcd234 ')).toBe(true)
    expect(isValidPublicId('TGG-ABC')).toBe(false)
    expect(isValidPublicId('TGG-ABCDEFGH')).toBe(false)
    expect(isValidPublicId('ABCD-234')).toBe(false)
    expect(isValidPublicId('https://evil.example')).toBe(false)
  })

  it('normalise le code public avant tout appel', () => {
    expect(normalizePublicId(' tgg-abcd234 ')).toBe(PUBLIC_ID)
  })

  it('valide le format uuid des identifiants internes', () => {
    expect(isUuid(QR_ID)).toBe(true)
    expect(isUuid(PUBLIC_ID)).toBe(false)
    expect(isUuid('')).toBe(false)
  })
})

describe('choix de la période et de la granularité', () => {
  it('n’accepte que 7, 30 et 90 jours', () => {
    expect([...SCAN_PERIOD_DAYS]).toEqual([7, 30, 90])
    expect(isScanPeriodDays(7)).toBe(true)
    expect(isScanPeriodDays(30)).toBe(true)
    expect(isScanPeriodDays(90)).toBe(true)
    expect(isScanPeriodDays(14)).toBe(false)
    expect(isScanPeriodDays(365)).toBe(false)
    expect(isScanPeriodDays('30')).toBe(false)
    expect(isScanPeriodDays(null)).toBe(false)
  })

  it('agrège par jour jusqu’à 30 jours, par semaine au-delà', () => {
    expect(bucketForPeriod(7)).toBe('day')
    expect(bucketForPeriod(30)).toBe('day')
    // 90 points/jour seraient illisibles sur le graphique du dashboard.
    expect(bucketForPeriod(90)).toBe('week')
  })
})

describe('enregistrement d’un scan', () => {
  it('envoie uniquement le code public à la base', async () => {
    const { client, calls } = fakeClient({ data: 'recorded' })

    const outcome = await recordTaggoScan(client, ' tgg-abcd234 ')

    expect(outcome).toBe('recorded')
    expect(calls).toHaveLength(1)
    expect(calls[0].fn).toBe('record_taggo_scan')
    // Aucun qr_code_id, owner_id, scanned_at, ip ou user_agent n'est transmis.
    expect(Object.keys(calls[0].args)).toEqual(['p_public_id'])
    expect(calls[0].args.p_public_id).toBe(PUBLIC_ID)
  })

  it('refuse un code public invalide sans appeler la base', async () => {
    const { client, calls } = fakeClient({ data: 'recorded' })

    const outcome = await recordTaggoScan(client, 'pas-un-code')

    expect(outcome).toBe('not_found')
    expect(calls).toHaveLength(0)
  })

  it('remonte le statut de déduplication anti-abus', async () => {
    const { client } = fakeClient({ data: 'duplicate' })
    await expect(recordTaggoScan(client, PUBLIC_ID)).resolves.toBe('duplicate')
  })

  it('distingue TAGGO inexistant et TAGGO inactif', async () => {
    const missing = fakeClient({ data: 'not_found' })
    const inactive = fakeClient({ data: 'not_active' })

    await expect(recordTaggoScan(missing.client, PUBLIC_ID)).resolves.toBe('not_found')
    await expect(recordTaggoScan(inactive.client, PUBLIC_ID)).resolves.toBe('not_active')
  })

  it('absorbe une panne de base au lieu de lever', async () => {
    const { client } = fakeClient({ error: new Error('db down') })
    await expect(recordTaggoScan(client, PUBLIC_ID)).resolves.toBe('unavailable')
  })

  it('absorbe une exception réseau', async () => {
    const client = {
      rpc: vi.fn(async () => {
        throw new Error('ECONNRESET')
      }),
    } as unknown as SupabaseClient

    await expect(recordTaggoScan(client, PUBLIC_ID)).resolves.toBe('unavailable')
  })

  it('rejette une réponse serveur inattendue plutôt que de l’inventer', async () => {
    const { client } = fakeClient({ data: 'something_else' })
    await expect(recordTaggoScan(client, PUBLIC_ID)).resolves.toBe('unavailable')
  })

  it('documente une fenêtre anti-abus courte et sans identité', () => {
    // Une fenêtre par jour sous-countrait des visiteurs légitimes : plusieurs
    // personnes partagent une IP. La valeur reste courte et non identifiante.
    expect(TAGGO_SCAN_MIN_INTERVAL_SECONDS).toBeGreaterThanOrEqual(1)
    expect(TAGGO_SCAN_MIN_INTERVAL_SECONDS).toBeLessThanOrEqual(300)
  })
})

describe('normalisation des statistiques', () => {
  it('convertit une charge utile valide', () => {
    const stats = toTaggoScanStats(
      {
        total: 12,
        today: 2,
        last_7: 5,
        last_30: 9,
        days: 30,
        bucket: 'day',
        series: [{ bucket_start: '2026-10-01T00:00:00+00:00', scans: 3 }],
        recent: [{ scanned_at: '2026-10-01T12:00:00+00:00' }],
      },
      30,
    )

    expect(stats).toEqual({
      total: 12,
      today: 2,
      last7: 5,
      last30: 9,
      days: 30,
      bucket: 'day',
      series: [{ bucketStart: '2026-10-01T00:00:00+00:00', scans: 3 }],
      recent: [{ scannedAt: '2026-10-01T12:00:00+00:00' }],
    })
  })

  it('renvoie des zéros si la réponse est vide — jamais de chiffre inventé', () => {
    const stats = toTaggoScanStats(null, 7)

    expect(stats.total).toBe(0)
    expect(stats.today).toBe(0)
    expect(stats.series).toEqual([])
    expect(stats.recent).toEqual([])
  })

  it('ignore les entrées malformées plutôt que de les compter', () => {
    const stats = toTaggoScanStats(
      {
        total: -5,
        today: 'beaucoup',
        series: [{ scans: 1 }, null, 'nope'],
        recent: [{ scanned_at: '' }],
      },
      7,
    )

    expect(stats.total).toBe(0)
    expect(stats.today).toBe(0)
    expect(stats.series).toEqual([])
    expect(stats.recent).toEqual([])
  })
})

describe('lecture des analytics par le propriétaire', () => {
  it('transmet le qr_id, l’owner_id issu du JWT et la période', async () => {
    const { client, calls } = fakeClient({
      data: { ok: true, total: 3, today: 1, last_7: 2, last_30: 3, days: 90, bucket: 'week', series: [], recent: [] },
    })

    const result = await getTaggoScanStats(client, { qrId: QR_ID, ownerId: OWNER_ID, days: 90 })

    expect(result.ok).toBe(true)
    expect(calls[0].fn).toBe('get_taggo_scan_stats')
    expect(calls[0].args).toEqual({
      p_qr_id: QR_ID,
      p_owner_id: OWNER_ID,
      p_days: 90,
      p_bucket: 'week',
    })
  })

  it('refuse un propriétaire qui ne possède pas le TAGGO', async () => {
    const { client } = fakeClient({ data: { ok: false, reason: 'not_owner' } })

    const result = await getTaggoScanStats(client, {
      qrId: OTHER_QR_ID,
      ownerId: OWNER_ID,
      days: 30,
    })

    expect(result).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('refuse un TAGGO appartenant à un autre utilisateur', async () => {
    const { client } = fakeClient({ data: { ok: false, reason: 'not_owner' } })

    const result = await getTaggoScanStats(client, {
      qrId: QR_ID,
      ownerId: OTHER_OWNER_ID,
      days: 30,
    })

    expect(result.ok).toBe(false)
  })

  it('refuse une période non prévue sans appeler la base', async () => {
    const { client, calls } = fakeClient({ data: { ok: true } })

    const result = await getTaggoScanStats(client, {
      qrId: QR_ID,
      ownerId: OWNER_ID,
      days: 365 as never,
    })

    expect(result).toEqual({ ok: false, reason: 'invalid_request' })
    expect(calls).toHaveLength(0)
  })

  it('refuse un identifiant malformé sans appeler la base', async () => {
    const { client, calls } = fakeClient({ data: { ok: true } })

    await expect(
      getTaggoScanStats(client, { qrId: 'TGG-ABCD234', ownerId: OWNER_ID, days: 30 }),
    ).resolves.toEqual({ ok: false, reason: 'invalid_request' })
    await expect(
      getTaggoScanStats(client, { qrId: QR_ID, ownerId: 'pas-un-uuid', days: 30 }),
    ).resolves.toEqual({ ok: false, reason: 'invalid_request' })
    expect(calls).toHaveLength(0)
  })

  it('remonte une panne au lieu de renvoyer des zéros trompeurs', async () => {
    const { client } = fakeClient({ error: new Error('timeout') })

    const result = await getTaggoScanStats(client, { qrId: QR_ID, ownerId: OWNER_ID, days: 30 })

    // Des zéros seraient interprétés comme « aucun scan » : c'est un mensonge.
    expect(result).toEqual({ ok: false, reason: 'analytics_unavailable' })
  })
})
