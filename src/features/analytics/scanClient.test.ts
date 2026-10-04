import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchTaggoScanStats,
  isPublicTaggoCode,
  isTaggoId,
  recordTaggoScan,
} from './scanClient'
import { emptyScanStats, SCAN_PERIODS, scanStatsErrorMessage } from './analyticsTypes'

/**
 * ÉTAPE 11 — Tests du client analytics (navigateur).
 *
 * Le contrat vérifié est la séparation des rôles :
 * - le navigateur n'envoie QUE le code public pour écrire un scan ;
 * - il ne lit ses statistiques que par son JWT ;
 * - il n'invente jamais un chiffre quand le serveur échoue.
 */

const QR_ID = '11111111-1111-4111-8111-111111111111'
const PUBLIC_ID = 'TGG-ABCD234'

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    json: async () => body,
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('validation des identifiants', () => {
  it('n’accepte que le format interne uuid', () => {
    expect(isTaggoId(QR_ID)).toBe(true)
    expect(isTaggoId(PUBLIC_ID)).toBe(false)
    expect(isTaggoId('  ')).toBe(false)
  })

  it('n’accepte que le format public TGG-XXXXXXX', () => {
    expect(isPublicTaggoCode(PUBLIC_ID)).toBe(true)
    expect(isPublicTaggoCode('tgg-abcd234')).toBe(true)
    expect(isPublicTaggoCode('TGG-SHORT')).toBe(false)
    expect(isPublicTaggoCode(QR_ID)).toBe(false)
  })
})

describe('enregistrement d’un scan depuis la page publique', () => {
  it('n’envoie que le code public, en POST', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, recorded: true }))

    await expect(recordTaggoScan(PUBLIC_ID)).resolves.toBe(true)

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`/api/analytics/scan?public_id=TGG-ABCD234`)
    expect(init?.method).toBe('POST')
    // Aucun corps : ni taggo_id, ni owner_id, ni timestamp, ni compteur.
    expect(init?.body).toBeUndefined()
  })

  it('ne transmet aucune donnée d’identité', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, recorded: true }))

    await recordTaggoScan(PUBLIC_ID)

    const serialized = JSON.stringify(vi.mocked(fetch).mock.calls[0])
    for (const forbidden of ['owner_id', 'ownerId', 'qr_code_id', 'qrId', 'scanned_at', 'timestamp', 'ip', 'user_agent', 'count']) {
      expect(serialized, `${forbidden} ne doit pas être envoyé`).not.toContain(forbidden)
    }
  })

  it('refuse un code invalide sans appeler le serveur', async () => {
    await expect(recordTaggoScan('pas-un-code')).resolves.toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('absorbe une panne réseau — le visiteur voit toujours la page', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(recordTaggoScan(PUBLIC_ID)).resolves.toBe(false)
  })

  it('absorbe une erreur serveur 500', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}, { status: 500 }))
    await expect(recordTaggoScan(PUBLIC_ID)).resolves.toBe(false)
  })

  it('absorbe une réponse illisible', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json')
      },
    } as unknown as Response)

    await expect(recordTaggoScan(PUBLIC_ID)).resolves.toBe(false)
  })

  it('renvoie false quand le scan est dédupliqué par l’anti-abus', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, recorded: false, outcome: 'duplicate' }))
    await expect(recordTaggoScan(PUBLIC_ID)).resolves.toBe(false)
  })

  it('ne lève jamais, même sur un statut inattendu', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, recorded: 'oui' }))
    await expect(recordTaggoScan(PUBLIC_ID)).resolves.toBe(false)
  })
})

describe('lecture des analytics par le propriétaire', () => {
  const okBody = {
    ok: true,
    qrId: QR_ID,
    days: 30,
    bucket: 'day',
    total: 4,
    today: 1,
    last7: 2,
    last30: 4,
    series: [{ bucketStart: '2026-10-01T00:00:00+00:00', scans: 2 }],
    recent: [{ scannedAt: '2026-10-01T12:00:00+00:00' }],
  }

  it('demande la période choisie et renvoie les agrégats', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(okBody))

    const result = await fetchTaggoScanStats(QR_ID, 30)

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`/api/analytics/taggo?qr_id=${QR_ID}&days=30`)
    expect(result).toEqual({
      ok: true,
      stats: {
        total: 4,
        today: 1,
        last7: 2,
        last30: 4,
        days: 30,
        bucket: 'day',
        series: [{ bucketStart: '2026-10-01T00:00:00+00:00', scans: 2 }],
        recent: [{ scannedAt: '2026-10-01T12:00:00+00:00' }],
      },
    })
  })

  it('supporte les trois périodes du dashboard', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(okBody))

    for (const period of SCAN_PERIODS) {
      const result = await fetchTaggoScanStats(QR_ID, period.days)
      expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain(`days=${period.days}`)
      expect(result.ok).toBe(true)
    }
  })

  it('refuse une période non prévue sans appeler le serveur', async () => {
    const result = await fetchTaggoScanStats(QR_ID, 400 as never)

    expect(result).toEqual({ ok: false, reason: 'invalid_request' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refuse un identifiant de TAGGO invalide', async () => {
    const result = await fetchTaggoScanStats('TGG-ABCD234', 30)

    expect(result).toEqual({ ok: false, reason: 'invalid_request' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('remonte « pas propriétaire » sans exposer de données', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, code: 'not_owner' }, { status: 403 }))

    const result = await fetchTaggoScanStats(QR_ID, 30)

    expect(result).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('remonte une session expirée', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, code: 'unauthenticated' }, { status: 401 }))

    await expect(fetchTaggoScanStats(QR_ID, 30)).resolves.toEqual({
      ok: false,
      reason: 'unauthenticated',
    })
  })

  it('ne transforme jamais une erreur en statistiques à zéro', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, code: 'analytics_unavailable' }, { status: 503 }))

    const result = await fetchTaggoScanStats(QR_ID, 30)

    expect(result.ok).toBe(false)
  })

  it('remonte une panne réseau', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchTaggoScanStats(QR_ID, 30)).resolves.toEqual({ ok: false, reason: 'network_error' })
  })

  it('ignore les entrées de série malformées', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, total: 3, series: [{ scans: 1 }, null], recent: 'nope' }),
    )

    const result = await fetchTaggoScanStats(QR_ID, 7)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.stats.total).toBe(3)
      expect(result.stats.series).toEqual([])
      expect(result.stats.recent).toEqual([])
    }
  })
})

describe('types analytics', () => {
  it('propose exactement 7, 30 et 90 jours', () => {
    expect(SCAN_PERIODS.map((period) => period.days)).toEqual([7, 30, 90])
  })

  it('produit des statistiques vides, pas des chiffres inventés', () => {
    expect(emptyScanStats(30)).toEqual({
      total: 0,
      today: 0,
      last7: 0,
      last30: 0,
      days: 30,
      bucket: 'day',
      series: [],
      recent: [],
    })
    expect(emptyScanStats(90).bucket).toBe('week')
  })

  it('fournit un message français pour chaque échec', () => {
    for (const reason of [
      'invalid_request',
      'invalid_period',
      'unauthenticated',
      'not_owner',
      'analytics_unavailable',
      'network_error',
    ] as const) {
      expect(scanStatsErrorMessage(reason).length).toBeGreaterThan(0)
    }
  })
})
