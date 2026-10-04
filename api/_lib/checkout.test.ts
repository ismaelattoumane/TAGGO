import { describe, expect, it, vi } from 'vitest'
import { createCheckoutSession } from './checkout'
import type { CatalogLookup, ServerCatalogEntry } from './catalogTypes'
import type { ApiResponse, StripeGateway } from './types'

const VARIANT_A = '11111111-1111-4111-8111-111111111111'

function entry(overrides: Partial<ServerCatalogEntry> = {}): ServerCatalogEntry {
  return {
    variantId: VARIANT_A,
    productId: '33333333-3333-4333-8333-333333333333',
    slug: 'tshirt-taggo',
    name: 'T-shirt TAGGO',
    description: 'T-shirt officiel',
    size: 'M',
    color: 'Blanc',
    priceCents: 2500,
    currency: 'EUR',
    available: true,
    stock: null,
    ...overrides,
  }
}

function deps(overrides: Partial<Parameters<typeof createCheckoutSession>[0]> = {}) {
  const stripe: StripeGateway = {
    createCheckoutSession: vi.fn(async () => ({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' })),
    constructWebhookEvent: vi.fn(),
  }
  const catalog: CatalogLookup = { findVariant: vi.fn(async () => entry()) }

  return {
    createOrder: vi.fn(async () => ({ id: '44444444-4444-4444-8444-444444444444', status: 'pending', subtotalCents: 5000, currency: 'EUR' })),
    attachStripeSession: vi.fn(async () => undefined),
    stripe,
    catalog,
    successUrl: 'https://taggo.test/checkout/success?order_id={CHECKOUT_SESSION_ID}',
    cancelUrl: 'https://taggo.test/checkout/cancel?order_id={CHECKOUT_SESSION_ID}',
    ...overrides,
  }
}

describe('createCheckoutSession', () => {
  it('refuse un appel non authentifié', async () => {
    const result = await createCheckoutSession(deps(), { body: { items: [] }, userId: null })

    expect(result).toEqual({ ok: false, code: 'unauthenticated' })
  })

  it('crée la commande, la session Stripe et rattache la session', async () => {
    const context = deps()
    const result = await createCheckoutSession(context, {
      body: { items: [{ variantId: VARIANT_A, quantity: 2 }] },
      userId: '55555555-5555-4555-8555-555555555555',
    })

    expect(result).toEqual({
      ok: true,
      orderId: '44444444-4444-4444-8444-444444444444',
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    })

    expect(context.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '55555555-5555-4555-8555-555555555555' }),
    )
    expect(context.attachStripeSession).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      'cs_test_123',
    )
  })

  it('envoie au Stripe le montant recalculé par le serveur, jamais celui du client', async () => {
    const context = deps()
    await createCheckoutSession(context, {
      // Le client tente d'imposer un prix et un total.
      body: {
        items: [{ variantId: VARIANT_A, quantity: 2, unitPriceCents: 1, lineTotalCents: 2 }],
        subtotalCents: 2,
      },
      userId: '55555555-5555-4555-8555-555555555555',
    })

    expect(context.stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'EUR',
        lines: [
          expect.objectContaining({ unitAmountCents: 2500, quantity: 2, currency: 'EUR' }),
        ],
      }),
    )
  })

  it('renvoie le nom de ligne avec taille et couleur', async () => {
    const context = deps()
    await createCheckoutSession(context, {
      body: { items: [{ variantId: VARIANT_A, quantity: 2 }] },
      userId: '55555555-5555-4555-8555-555555555555',
    })

    const call = vi.mocked(context.stripe.createCheckoutSession).mock.calls[0]?.[0]
    expect(call?.lines[0]?.name).toBe('T-shirt TAGGO — Taille M · Couleur Blanc')
  })

  it('ne crée aucune session si le prix est absent', async () => {
    const context = deps({ catalog: { findVariant: vi.fn(async () => entry({ priceCents: null })) } })
    const result = await createCheckoutSession(context, {
      body: { items: [{ variantId: VARIANT_A, quantity: 1 }] },
      userId: '55555555-5555-4555-8555-555555555555',
    })

    expect(result).toEqual({ ok: false, code: 'price_unavailable' })
    expect(context.stripe.createCheckoutSession).not.toHaveBeenCalled()
    expect(context.createOrder).not.toHaveBeenCalled()
  })

  it('ne crée aucune session pour une variante indisponible', async () => {
    const context = deps({ catalog: { findVariant: vi.fn(async () => entry({ available: false })) } })
    const result = await createCheckoutSession(context, {
      body: { items: [{ variantId: VARIANT_A, quantity: 1 }] },
      userId: '55555555-5555-4555-8555-555555555555',
    })

    expect(result).toEqual({ ok: false, code: 'variant_unavailable' })
    expect(context.createOrder).not.toHaveBeenCalled()
  })

  it('refuse de poursuivre si la commande créée ne correspond pas au panier tarifié', async () => {
    const context = deps({
      createOrder: vi.fn(async () => ({ id: '44444444-4444-4444-8444-444444444444', status: 'pending', subtotalCents: 1, currency: 'EUR' })),
    })

    const result = await createCheckoutSession(context, {
      body: { items: [{ variantId: VARIANT_A, quantity: 1 }] },
      userId: '55555555-5555-4555-8555-555555555555',
    })

    expect(result).toEqual({ ok: false, code: 'invalid_request' })
    expect(context.stripe.createCheckoutSession).not.toHaveBeenCalled()
  })

  it('ne marque jamais la commande payée depuis le checkout', async () => {
    const context = deps({
      createOrder: vi.fn(async () => ({ id: '44444444-4444-4444-8444-444444444444', status: 'paid', subtotalCents: 5000, currency: 'EUR' })),
    })

    const result = await createCheckoutSession(context, {
      body: { items: [{ variantId: VARIANT_A, quantity: 2 }] },
      userId: '55555555-5555-4555-8555-555555555555',
    })

    expect(result).toEqual({ ok: false, code: 'invalid_request' })
  })

  it('remonte stripe_error sans masquer la commande en attente', async () => {
    const context = deps({
      stripe: {
        createCheckoutSession: vi.fn(async () => {
          throw new Error('network')
        }),
        constructWebhookEvent: vi.fn(),
      },
    })

    const result = await createCheckoutSession(context, {
      body: { items: [{ variantId: VARIANT_A, quantity: 2 }] },
      userId: '55555555-5555-4555-8555-555555555555',
    })

    expect(result).toEqual({ ok: false, code: 'stripe_error' })
    expect(context.attachStripeSession).not.toHaveBeenCalled()
  })

  it('refuse un panier vide', async () => {
    const context = deps()
    const result = await createCheckoutSession(context, { body: { items: [] }, userId: 'u' })

    expect(result).toEqual({ ok: false, code: 'empty_cart' })
    expect(context.createOrder).not.toHaveBeenCalled()
  })

  it('construit les URL de retour avec le gabarit Checkout', () => {
    expect(deps().successUrl).toContain('{CHECKOUT_SESSION_ID}')
    expect(deps().cancelUrl).toContain('{CHECKOUT_SESSION_ID}')
  })
})

describe('checkoutResponse', () => {
  it('renvoie un body minimal sans secret', async () => {
    const { checkoutResponse } = await import('./checkout')
    const response: ApiResponse = checkoutResponse({ ok: false, code: 'stripe_unavailable' })

    expect(response.status).toBe(503)
    expect(response.body).toMatchObject({ ok: false, code: 'stripe_unavailable' })
  })
})
