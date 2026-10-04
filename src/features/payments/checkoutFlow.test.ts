import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isCheckoutAvailable, startStripeCheckout, toCheckoutItems } from './checkoutFlow'
import type { CartLine } from '../shop/cart'
import type { Product, ProductVariant } from '../shop/productTypes'

const requestCheckoutSession = vi.fn()
vi.mock('./checkoutClient', () => ({ requestCheckoutSession: (...args: unknown[]) => requestCheckoutSession(...args) }))

const VARIANT_A = '11111111-1111-4111-8111-111111111111'

const VARIANT: ProductVariant = {
  id: VARIANT_A,
  productId: 'p1',
  size: 'M',
  color: 'Blanc',
  priceCents: 2500,
  sku: 'TS-M-B',
  stock: null,
  available: true,
}

const PRODUCT: Product = {
  id: 'p1',
  slug: 'tshirt-taggo',
  name: 'T-shirt TAGGO',
  shortDescription: '',
  description: '',
  status: 'active',
  images: [],
  sizes: ['M'],
  colors: ['Blanc'],
  variants: [VARIANT],
  createdAt: '2026-09-30T00:00:00.000Z',
  updatedAt: '2026-09-30T00:00:00.000Z',
}

function cartLine(quantity = 1): CartLine {
  return {
    lineId: `p1:${VARIANT_A}`,
    product: PRODUCT,
    variant: VARIANT,
    quantity,
    unitPriceCents: 2500,
    lineTotalCents: 2500 * quantity,
  }
}

beforeEach(() => {
  requestCheckoutSession.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('toCheckoutItems', () => {
  it('n’envoie que variantId et quantity', () => {
    expect(toCheckoutItems([cartLine(2)])).toEqual([{ variantId: VARIANT_A, quantity: 2 }])
  })

  it('ignore les prix calculés localement', () => {
    const line = cartLine(3)
    const items = toCheckoutItems([line]) as Record<string, unknown>[]

    expect(Object.keys(items[0] ?? {}).sort()).toEqual(['quantity', 'variantId'])
  })
})

describe('startStripeCheckout', () => {
  it('refuse un panier vide sans appeler le serveur', async () => {
    const result = await startStripeCheckout([])

    expect(result.ok).toBe(false)
    expect(requestCheckoutSession).not.toHaveBeenCalled()
  })

  it('renvoie l’URL de redirection fournie par Stripe', async () => {
    requestCheckoutSession.mockResolvedValue({
      ok: true,
      orderId: '44444444-4444-4444-8444-444444444444',
      sessionId: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
    })

    const result = await startStripeCheckout([cartLine(2)])

    expect(result).toEqual({
      ok: true,
      orderId: '44444444-4444-4444-8444-444444444444',
      sessionId: 'cs_test_123',
      redirectUrl: 'https://checkout.stripe.com/c/pay/cs_test_123',
    })
    expect(requestCheckoutSession).toHaveBeenCalledWith([{ variantId: VARIANT_A, quantity: 2 }])
  })

  it('propage le message d’erreur serveur', async () => {
    requestCheckoutSession.mockResolvedValue({
      ok: false,
      code: 'price_unavailable',
      message: 'Le paiement sera disponible prochainement.',
    })

    const result = await startStripeCheckout([cartLine(1)])

    expect(result).toEqual({ ok: false, message: 'Le paiement sera disponible prochainement.' })
  })

  it('reste fermé si l’appel serveur échoue', async () => {
    requestCheckoutSession.mockRejectedValue(new Error('network'))

    const result = await startStripeCheckout([cartLine(1)])

    expect(result.ok).toBe(false)
  })
})

describe('isCheckoutAvailable', () => {
  it('suit strictement la décision du serveur', () => {
    expect(isCheckoutAvailable(null)).toBe(false)
    expect(isCheckoutAvailable({ stripeConfigured: true, checkoutAvailable: false, reason: 'pricing_unavailable', message: '' })).toBe(false)
    expect(isCheckoutAvailable({ stripeConfigured: true, checkoutAvailable: true, reason: null, message: '' })).toBe(true)
  })
})
