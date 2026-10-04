import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchOrderPaymentStatus,
  fetchPaymentConfig,
  requestCheckoutSession,
  toPaymentErrorResponse,
} from './checkoutClient'
import { PAYMENT_ERROR_MESSAGES } from './paymentTypes'

const VARIANT_A = '11111111-1111-4111-8111-111111111111'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestCheckoutSession', () => {
  it('envoie uniquement des références et quantités', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, orderId: 'order-1', sessionId: 'cs_test_1', url: 'https://checkout.stripe.com/x' }),
    )

    const result = await requestCheckoutSession([{ variantId: VARIANT_A, quantity: 2 }])

    expect(result).toEqual({
      ok: true,
      orderId: 'order-1',
      sessionId: 'cs_test_1',
      url: 'https://checkout.stripe.com/x',
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ items: [{ variantId: VARIANT_A, quantity: 2 }] })
  })

  it('refuse un panier vide sans appel réseau', async () => {
    const result = await requestCheckoutSession([])

    expect(result).toEqual({ ok: false, code: 'empty_cart', message: PAYMENT_ERROR_MESSAGES.empty_cart })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('traduit une erreur serveur en message affichable', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, error: 'price_unavailable' }, 503))

    const result = await requestCheckoutSession([{ variantId: VARIANT_A, quantity: 1 }])

    expect(result).toEqual({
      ok: false,
      code: 'price_unavailable',
      message: PAYMENT_ERROR_MESSAGES.price_unavailable,
    })
  })

  it('traduit une erreur serveur inconnue en erreur générique', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: false, error: 'mystery' }, 500))

    const result = await requestCheckoutSession([{ variantId: VARIANT_A, quantity: 1 }])

    expect(result).toEqual({
      ok: false,
      code: 'invalid_request',
      message: PAYMENT_ERROR_MESSAGES.invalid_request,
    })
  })

  it('n’invente pas de succès sur une réponse tronquée', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }, 200))

    const result = await requestCheckoutSession([{ variantId: VARIANT_A, quantity: 1 }])

    expect(result.ok).toBe(false)
  })

  it('signale une indisponibilité si le réseau échoue', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))

    const result = await requestCheckoutSession([{ variantId: VARIANT_A, quantity: 1 }])

    expect(result.ok).toBe(false)
  })
})

describe('toPaymentErrorResponse', () => {
  it('refuse un code inconnu', () => {
    expect(toPaymentErrorResponse({ error: 'oops' })).toMatchObject({
      ok: false,
      code: 'invalid_request',
    })
  })
})

describe('fetchOrderPaymentStatus', () => {
  it('lit un état payé rapporté par le serveur', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ ok: true, orderId: 'order-1', status: 'paid', paid: true, taggoCount: 2 }),
    )

    await expect(fetchOrderPaymentStatus('order-1')).resolves.toEqual({
      ok: true,
      orderId: 'order-1',
      status: 'paid',
      paid: true,
      taggoCount: 2,
    })
  })

  it('ne peut jamais déclarer un paiement depuis le navigateur', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true, orderId: 'order-1', status: 'pending', paid: 'oui' }))

    const result = await fetchOrderPaymentStatus('order-1')

    expect(result.ok && result.paid).toBe(false)
  })

  it('refuse un identifiant de commande vide', async () => {
    const result = await fetchOrderPaymentStatus('')

    expect(result.ok).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('fetchPaymentConfig', () => {
  it('reflète la décision du serveur', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ stripeConfigured: true, checkoutAvailable: false, reason: 'pricing_unavailable', message: 'bientôt' }),
    )

    await expect(fetchPaymentConfig()).resolves.toEqual({
      stripeConfigured: true,
      checkoutAvailable: false,
      reason: 'pricing_unavailable',
      message: 'bientôt',
    })
  })

  it('retombe en mode indisponible si l’API ne répond pas', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'))

    const config = await fetchPaymentConfig()

    expect(config.checkoutAvailable).toBe(false)
    expect(config.stripeConfigured).toBe(false)
  })
})
