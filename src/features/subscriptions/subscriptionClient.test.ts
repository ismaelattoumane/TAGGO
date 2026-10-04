import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchTaggoSubscription,
  isTaggoId,
  requestTaggoRenewal,
  setTaggoAutoRenew,
} from './subscriptionClient'
import {
  formatSubscriptionDate,
  SUBSCRIPTION_DISPLAY_LABELS,
  subscriptionFailureMessage,
  toSubscriptionDisplay,
  type TaggoSubscriptionState,
} from './subscriptionTypes'

/**
 * ÉTAPE 12 — Tests du client abonnements (navigateur).
 *
 * Le contrat fundamental : le navigateur n'envoie qu'un `qr_id` et une
 * intention. Jamais une date, jamais un statut, jamais un montant.
 */

const QR_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_QR_ID = '22222222-2222-4222-8222-222222222222'

function jsonResponse(body: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => body } as Response
}

const READY_STATE = {
  managed: true,
  subscriptionRequired: false,
  status: 'active',
  source: 'included',
  autoRenew: false,
  startedAt: '2025-10-01T12:00:00.000Z',
  endsAt: '2026-10-01T12:00:00.000Z',
  expiredAt: null,
  lifecycleStatus: 'active',
  expiringSoon: false,
  renewalAvailable: false,
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('lecture de l’abonnement', () => {
  it('lit l’état du TAGGO demandé', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, qrId: QR_ID, subscription: READY_STATE }))

    const result = await fetchTaggoSubscription(QR_ID)

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`/api/subscriptions/taggo?qr_id=${QR_ID}`)
    expect(result).toEqual({ ok: true, state: READY_STATE })
  })

  it('n’envoie que le qr_id — aucune donnée financière ni personnelle', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, subscription: READY_STATE }))

    await fetchTaggoSubscription(QR_ID)

    const serialized = JSON.stringify(vi.mocked(fetch).mock.calls[0])
    for (const forbidden of ['amount', 'price', 'eur', '€', 'card', 'owner_id', 'user_id', 'ends_at', 'status']) {
      expect(serialized, `${forbidden} ne doit pas être envoyé`).not.toContain(forbidden)
    }
  })

  it('refuse un identifiant malformé sans appeler le serveur', async () => {
    await expect(fetchTaggoSubscription('TGG-ABCD234')).resolves.toEqual({ ok: false, reason: 'invalid_request' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('remonte « pas votre TAGGO » sans rien inventer', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, code: 'not_owner' }, 403))

    await expect(fetchTaggoSubscription(OTHER_QR_ID)).resolves.toEqual({ ok: false, reason: 'not_owner' })
  })

  it('ne transforme jamais une erreur en abonnement actif', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, code: 'subscription_unavailable' }, 503))

    const result = await fetchTaggoSubscription(QR_ID)

    expect(result.ok).toBe(false)
  })

  it('traite une charge utile vide comme non gérée, jamais comme active', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, subscription: {} }))

    const result = await fetchTaggoSubscription(QR_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.managed).toBe(false)
      expect(result.state.status).toBeNull()
      expect(result.state.renewalAvailable).toBe(false)
    }
  })

  it('ignore un statut ou une source non reconnus', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, subscription: { managed: true, status: 'pending', source: 'premium' } }),
    )

    const result = await fetchTaggoSubscription(QR_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.state.status).toBeNull()
      expect(result.state.source).toBeNull()
    }
  })

  it('remonte une panne réseau', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchTaggoSubscription(QR_ID)).resolves.toEqual({ ok: false, reason: 'network_error' })
  })

  it('remonte une réponse illisible', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('invalid json')
      },
    } as unknown as Response)

    await expect(fetchTaggoSubscription(QR_ID)).resolves.toEqual({
      ok: false,
      reason: 'subscription_unavailable',
    })
  })

  it('valide le format uuid du TAGGO', () => {
    expect(isTaggoId(QR_ID)).toBe(true)
    expect(isTaggoId('TGG-ABCD234')).toBe(false)
    expect(isTaggoId('')).toBe(false)
  })
})

describe('renouvellement manuel', () => {
  it('n’envoie qu’une demande, sans montant ni durée', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }))

    const result = await requestTaggoRenewal(QR_ID)

    expect(result).toEqual({ ok: true })
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`/api/subscriptions/renew?qr_id=${QR_ID}`)
    expect(init?.method).toBe('POST')
    // Ni corps, ni prix, ni période : le serveur décide de tout.
    expect(init?.body).toBeUndefined()
  })

  it('remonte « renouvellement indisponible » sans créer de commande', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: false, code: 'renewal_unavailable', message: 'Le renouvellement n’est pas encore disponible.' }, 503),
    )

    await expect(requestTaggoRenewal(QR_ID)).resolves.toEqual({ ok: false, reason: 'renewal_unavailable' })
  })

  it('refuse un identifiant malformé sans appeler le serveur', async () => {
    await expect(requestTaggoRenewal('nope')).resolves.toEqual({ ok: false, reason: 'invalid_request' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('absorbe une panne réseau', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(requestTaggoRenewal(QR_ID)).resolves.toEqual({ ok: false, reason: 'network_error' })
  })
})

describe('renouvellement automatique', () => {
  it('n’envoie que le booleen d’intention', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }))

    const result = await setTaggoAutoRenew(QR_ID, true)

    expect(result).toEqual({ ok: true })
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      `/api/subscriptions/auto-renew?qr_id=${QR_ID}&enabled=true`,
    )
  })

  it('permet de désactiver', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }))

    await setTaggoAutoRenew(QR_ID, false)

    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('enabled=false')
  })

  it('n’envoie jamais de date ni de statut', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }))

    await setTaggoAutoRenew(QR_ID, true)

    const serialized = JSON.stringify(vi.mocked(fetch).mock.calls[0])
    for (const forbidden of ['ends', 'starts', 'expired', 'status', 'price', 'amount']) {
      expect(serialized, `${forbidden} ne doit pas être envoyé`).not.toContain(forbidden)
    }
  })

  it('remonte un refus d’appartenance', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, code: 'not_owner' }, 403))

    await expect(setTaggoAutoRenew(OTHER_QR_ID, true)).resolves.toEqual({ ok: false, reason: 'not_owner' })
  })
})

describe('état affiché', () => {
  const base: TaggoSubscriptionState = {
    managed: true,
    subscriptionRequired: false,
    status: 'active',
    source: 'included',
    autoRenew: false,
    startedAt: null,
    endsAt: null,
    expiredAt: null,
    lifecycleStatus: 'active',
    expiringSoon: false,
    renewalAvailable: false,
  }

  it('affiche « Actif » pour une période valide', () => {
    expect(toSubscriptionDisplay(base)).toBe('active')
  })

  it('affiche « Expire bientôt » sans stocker ce statut', () => {
    expect(toSubscriptionDisplay({ ...base, expiringSoon: true })).toBe('expiring_soon')
  })

  it('affiche « Expiré » pour une période terminée', () => {
    expect(toSubscriptionDisplay({ ...base, status: 'expired', lifecycleStatus: 'expired' })).toBe('expired')
  })

  it('distingue un TAGGO SUSPENDU d’un TAGGO EXPIRÉ', () => {
    // Confusion interdite : un TAGGO suspendu n'est pas un TAGGO expiré.
    expect(toSubscriptionDisplay({ ...base, lifecycleStatus: 'suspended' })).toBe('suspended')
    expect(toSubscriptionDisplay({ ...base, lifecycleStatus: 'suspended' })).not.toBe('expired')
  })

  it('distingue un TAGGO REMPLACÉ d’un TAGGO EXPIRÉ', () => {
    expect(toSubscriptionDisplay({ ...base, lifecycleStatus: 'replaced' })).toBe('replaced')
    expect(toSubscriptionDisplay({ ...base, lifecycleStatus: 'replaced' })).not.toBe('expired')
  })

  it('n’affiche jamais « Actif » pour un TAGGO sans période gérée', () => {
    expect(toSubscriptionDisplay({ ...base, managed: false, status: null })).toBe('unmanaged')
  })

  it('propose un libellé pour chaque état affiché', () => {
    for (const display of ['active', 'expiring_soon', 'expired', 'suspended', 'replaced', 'unmanaged'] as const) {
      expect(SUBSCRIPTION_DISPLAY_LABELS[display].length).toBeGreaterThan(0)
    }
  })

  it('fournit un message français pour chaque erreur', () => {
    for (const reason of [
      'invalid_request',
      'unauthenticated',
      'not_owner',
      'subscription_unavailable',
      'no_valid_subscription',
      'renewal_unavailable',
      'network_error',
    ] as const) {
      expect(subscriptionFailureMessage(reason).length).toBeGreaterThan(0)
    }
  })

  it('formate les dates en UTC et n’invente pas de date manquante', () => {
    expect(formatSubscriptionDate('2026-10-01T12:00:00.000Z')).toBe('1 octobre 2026')
    expect(formatSubscriptionDate(null)).toBe('—')
    expect(formatSubscriptionDate('pas-une-date')).toBe('—')
  })
})