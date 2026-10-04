import { describe, expect, it, vi } from 'vitest'
import { parseCheckoutItems, priceCart, isValidQuantity } from './pricing'
import type { CatalogLookup, ServerCatalogEntry } from './catalogTypes'
import { MAX_PAYMENT_LINE_QUANTITY, MAX_PAYMENT_LINES } from '../../src/features/payments/paymentTypes'

const VARIANT_A = '11111111-1111-4111-8111-111111111111'
const VARIANT_B = '22222222-2222-4222-8222-222222222222'
const NOT_A_UUID = 'tshirt-taggo'

function entry(overrides: Partial<ServerCatalogEntry> = {}): ServerCatalogEntry {
  return {
    variantId: VARIANT_A,
    productId: VARIANT_A,
    slug: 'tshirt-taggo',
    name: 'T-shirt TAGGO',
    description: '',
    size: 'M',
    color: 'Blanc',
    priceCents: 2500,
    currency: 'EUR',
    available: true,
    stock: null,
    ...overrides,
  }
}

function lookupOf(entries: Record<string, ServerCatalogEntry | null>): CatalogLookup {
  return {
    findVariant: vi.fn(async (variantId: string) => entries[variantId] ?? null),
  }
}

describe('parseCheckoutItems', () => {
  it('accepte uniquement variantId + quantity', () => {
    const result = parseCheckoutItems({
      items: [{ variantId: VARIANT_A, quantity: 2, priceCents: 1, subtotalCents: 1 }],
    })

    expect(result).toEqual([{ variantId: VARIANT_A, quantity: 2 }])
  })

  it('refuse un body vide, non objet ou sans tableau', () => {
    expect(parseCheckoutItems(null)).toBe('invalid_request')
    expect(parseCheckoutItems('panier')).toBe('invalid_request')
    expect(parseCheckoutItems({})).toBe('invalid_request')
  })

  it('refuse un panier vide', () => {
    expect(parseCheckoutItems({ items: [] })).toBe('empty_cart')
  })

  it('refuse une quantité hors bornes ou non entière', () => {
    expect(parseCheckoutItems({ items: [{ variantId: VARIANT_A, quantity: 0 }] })).toBe('invalid_quantity')
    expect(parseCheckoutItems({ items: [{ variantId: VARIANT_A, quantity: 1.5 }] })).toBe('invalid_quantity')
    expect(
      parseCheckoutItems({ items: [{ variantId: VARIANT_A, quantity: MAX_PAYMENT_LINE_QUANTITY + 1 }] }),
    ).toBe('invalid_quantity')
  })

  it('refuse un identifiant de variante qui n’est pas un UUID', () => {
    expect(parseCheckoutItems({ items: [{ variantId: NOT_A_UUID, quantity: 1 }] })).toBe('invalid_item')
  })

  it('refuse la duplication d’une même variante', () => {
    expect(
      parseCheckoutItems({
        items: [
          { variantId: VARIANT_A, quantity: 1 },
          { variantId: VARIANT_A, quantity: 2 },
        ],
      }),
    ).toBe('invalid_item')
  })

  it('refuse un panier surdimensionné', () => {
    const items = Array.from({ length: MAX_PAYMENT_LINES + 1 }, (_, index) => ({
      variantId: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
      quantity: 1,
    }))

    expect(parseCheckoutItems({ items })).toBe('invalid_quantity')
  })
})

describe('priceCart', () => {
  it('recalcule les totaux à partir du catalogue serveur', async () => {
    const result = await priceCart(
      [{ variantId: VARIANT_A, quantity: 2 }, { variantId: VARIANT_B, quantity: 1 }],
      lookupOf({ [VARIANT_A]: entry(), [VARIANT_B]: entry({ variantId: VARIANT_B, priceCents: 1000 }) }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.cart.subtotalCents).toBe(2 * 2500 + 1000)
    expect(result.cart.currency).toBe('EUR')
    expect(result.cart.taggoQuantity).toBe(3)
    expect(result.cart.lines[0]?.unitPriceCents).toBe(2500)
    expect(result.cart.lines[0]?.lineTotalCents).toBe(5000)
  })

  it('refuse une variante inconnue', async () => {
    const result = await priceCart([{ variantId: VARIANT_A, quantity: 1 }], lookupOf({}))

    expect(result).toEqual({ ok: false, code: 'variant_not_found' })
  })

  it('refuse une variante indisponible ou un produit non actif', async () => {
    const unavailable = await priceCart(
      [{ variantId: VARIANT_A, quantity: 1 }],
      lookupOf({ [VARIANT_A]: entry({ available: false }) }),
    )
    expect(unavailable).toEqual({ ok: false, code: 'variant_unavailable' })

    const inactive = await priceCart(
      [{ variantId: VARIANT_A, quantity: 1 }],
      lookupOf({ [VARIANT_A]: entry({ available: true, productId: VARIANT_B }) }),
    )
    expect(inactive.ok).toBe(true)
  })

  it('refuse un prix absent : aucun montant n’est inventé', async () => {
    const result = await priceCart(
      [{ variantId: VARIANT_A, quantity: 1 }],
      lookupOf({ [VARIANT_A]: entry({ priceCents: null }) }),
    )

    expect(result).toEqual({ ok: false, code: 'price_unavailable' })
  })

  it('refuse un prix nul ou négatif', async () => {
    for (const priceCents of [0, -100]) {
      const result = await priceCart(
        [{ variantId: VARIANT_A, quantity: 1 }],
        lookupOf({ [VARIANT_A]: entry({ priceCents }) }),
      )
      expect(result).toEqual({ ok: false, code: 'price_unavailable' })
    }
  })

  it('refuse une devise non supportée', async () => {
    const result = await priceCart(
      [{ variantId: VARIANT_A, quantity: 1 }],
      lookupOf({ [VARIANT_A]: entry({ currency: 'USD' }) }),
    )

    expect(result).toEqual({ ok: false, code: 'invalid_currency' })
  })

  it('refuse un panier en deux devises', async () => {
    const result = await priceCart(
      [{ variantId: VARIANT_A, quantity: 1 }, { variantId: VARIANT_B, quantity: 1 }],
      lookupOf({
        [VARIANT_A]: entry({ currency: 'EUR' }),
        [VARIANT_B]: entry({ variantId: VARIANT_B, currency: 'USD' }),
      }),
    )

    expect(result).toEqual({ ok: false, code: 'invalid_currency' })
  })

  it('refuse une quantité supérieure au stock géré', async () => {
    const result = await priceCart(
      [{ variantId: VARIANT_A, quantity: 3 }],
      lookupOf({ [VARIANT_A]: entry({ stock: 2 }) }),
    )

    expect(result).toEqual({ ok: false, code: 'variant_unavailable' })
  })

  it('ignore le stock tant qu’il n’est pas géré', async () => {
    const result = await priceCart(
      [{ variantId: VARIANT_A, quantity: 3 }],
      lookupOf({ [VARIANT_A]: entry({ stock: null }) }),
    )

    expect(result.ok).toBe(true)
  })
})

describe('isValidQuantity', () => {
  it('borne les quantités', () => {
    expect(isValidQuantity(1)).toBe(true)
    expect(isValidQuantity(MAX_PAYMENT_LINE_QUANTITY)).toBe(true)
    expect(isValidQuantity(MAX_PAYMENT_LINE_QUANTITY + 1)).toBe(false)
    expect(isValidQuantity('2')).toBe(false)
    expect(isValidQuantity(Number.NaN)).toBe(false)
  })
})
