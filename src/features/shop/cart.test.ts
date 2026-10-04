import { beforeEach, describe, expect, it } from 'vitest'
import {
  addToCart,
  buildLineId,
  clearCart,
  countCartItems,
  EMPTY_CART,
  getCartSubtotalCents,
  hasCompletePricing,
  MAX_LINE_QUANTITY,
  removeLine,
  resolveCartLines,
  sanitizeCartState,
  setLineQuantity,
  type CartLine,
} from './cart'
import { readCartState, writeCartState, clearStoredCartState, CART_STORAGE_KEY_NAME } from './cartStorage'

/** Test-only fixture price. The real catalog publishes no amount yet. */
const FIXTURE_PRICE_CENTS = 4200

/** Same real line, but priced, to exercise the published-price behaviour. */
function withPrice(line: CartLine): CartLine {
  return {
    ...line,
    unitPriceCents: FIXTURE_PRICE_CENTS,
    lineTotalCents: FIXTURE_PRICE_CENTS * line.quantity,
  }
}

const TSHIRT_VARIANT = 'tshirt-taggo--default'
const HOODIE_VARIANT = 'hoodie-taggo--default'

describe('shop cart', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('addToCart', () => {
    it('adds a product variant', () => {
      const state = addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1)
      expect(state.entries).toHaveLength(1)
      expect(state.entries[0]).toEqual({
        productId: 'tshirt-taggo',
        variantId: TSHIRT_VARIANT,
        quantity: 1,
      })
    })

    it('merges quantities of the same variant', () => {
      const state = addToCart(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2), 'tshirt-taggo', TSHIRT_VARIANT, 1)
      expect(state.entries).toHaveLength(1)
      expect(state.entries[0].quantity).toBe(3)
    })

    it('keeps distinct variants as distinct lines', () => {
      const state = addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1)
      const second = addToCart(state, 'tshirt-taggo', 'tshirt-taggo--second', 1)
      expect(second.entries).toHaveLength(2)
    })

    it('clamps quantity to the allowed range', () => {
      expect(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 0).entries[0].quantity).toBe(1)
      expect(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 99).entries[0].quantity).toBe(
        MAX_LINE_QUANTITY,
      )
    })
  })

  describe('quantity and removal', () => {
    const lineId = buildLineId('tshirt-taggo', TSHIRT_VARIANT)

    it('updates the quantity of a line', () => {
      const state = setLineQuantity(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1), lineId, 4)
      expect(state.entries[0].quantity).toBe(4)
    })

    it('removes a line', () => {
      const state = removeLine(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2), lineId)
      expect(state.entries).toHaveLength(0)
    })

    it('removes a line when the quantity drops to zero', () => {
      const state = setLineQuantity(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2), lineId, 0)
      expect(state.entries).toHaveLength(0)
    })

    it('empties the cart', () => {
      expect(clearCart().entries).toHaveLength(0)
    })
  })

  describe('resolveCartLines', () => {
    it('resolves the product and the variant from the catalog', () => {
      const lines = resolveCartLines(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2))
      expect(lines).toHaveLength(1)
      expect(lines[0].product.name).toBe('T-shirt TAGGO')
      expect(lines[0].variant.id).toBe(TSHIRT_VARIANT)
    })

    it('carries no invented price while the official price is unpublished', () => {
      const lines = resolveCartLines(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2))
      expect(lines[0].unitPriceCents).toBeNull()
      expect(lines[0].lineTotalCents).toBeNull()
      expect(hasCompletePricing(lines)).toBe(false)
    })

    it('totals a line once a real price is published', () => {
      const [line] = resolveCartLines(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2))
      const priced = withPrice(line)
      expect(priced.unitPriceCents).toBe(FIXTURE_PRICE_CENTS)
      expect(priced.lineTotalCents).toBe(FIXTURE_PRICE_CENTS * 2)
      expect(hasCompletePricing([priced])).toBe(true)
    })

    it('drops an unknown product', () => {
      const state = addToCart(EMPTY_CART, 'produit-fantome', TSHIRT_VARIANT, 1)
      expect(resolveCartLines(state)).toHaveLength(0)
    })

    it('drops a non-existent variant', () => {
      const state = addToCart(EMPTY_CART, 'tshirt-taggo', 'tshirt-taggo--xl', 1)
      expect(resolveCartLines(state)).toHaveLength(0)
    })

    it('drops a variant belonging to another product', () => {
      const state = addToCart(EMPTY_CART, 'tshirt-taggo', HOODIE_VARIANT, 1)
      expect(resolveCartLines(state)).toHaveLength(0)
    })

    it('drops an unavailable (not yet produced) variant', () => {
      const state = addToCart(EMPTY_CART, 'hoodie-taggo', HOODIE_VARIANT, 1)
      expect(resolveCartLines(state)).toHaveLength(0)
    })
  })

  describe('subtotal', () => {
    it('is zero for an empty cart', () => {
      expect(getCartSubtotalCents(resolveCartLines(EMPTY_CART))).toBeNull()
      expect(countCartItems(EMPTY_CART)).toBe(0)
    })

    it('stays null while prices are unpublished, never guessed', () => {
      const lines = resolveCartLines(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 3))
      expect(getCartSubtotalCents(lines)).toBeNull()
    })

    it('computes the subtotal of a single priced line', () => {
      const [line] = resolveCartLines(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 3))
      expect(getCartSubtotalCents([withPrice(line)])).toBe(FIXTURE_PRICE_CENTS * 3)
    })

    it('sums several priced lines', () => {
      const state = addToCart(
        addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2),
        'tshirt-taggo',
        'tshirt-taggo--second',
        1,
      )
      // The second variant does not exist in the catalog yet: only the real
      // lines are totalled, so a tampered entry can never add an amount.
      const lines = resolveCartLines(state).map(withPrice)
      expect(getCartSubtotalCents(lines)).toBe(FIXTURE_PRICE_CENTS * 2)
      expect(countCartItems(state)).toBe(3)
    })

    it('never totals a cart mixing priced and unpriced lines', () => {
      const [line] = resolveCartLines(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
      expect(getCartSubtotalCents([withPrice(line), { ...line, lineId: 'other' }])).toBeNull()
    })
  })

  describe('persistence', () => {
    it('survives a storage round-trip', () => {
      writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2))
      const restored = readCartState()
      expect(restored.entries).toHaveLength(1)
      expect(restored.entries[0].quantity).toBe(2)
    })

    it('stores only references, never a price or personal data', () => {
      writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
      const raw = window.localStorage.getItem(CART_STORAGE_KEY_NAME) ?? ''
      expect(raw).not.toContain('price')
      expect(raw).not.toContain('email')
      expect(raw).toContain('tshirt-taggo--default')
    })

    it('clears the persisted cart', () => {
      writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
      clearStoredCartState()
      expect(readCartState().entries).toHaveLength(0)
    })
  })

  describe('sanitizeCartState', () => {
    it('repairs a corrupted payload', () => {
      expect(sanitizeCartState(null).entries).toHaveLength(0)
      expect(sanitizeCartState('{"entries":"nope"}').entries).toHaveLength(0)
      expect(sanitizeCartState({ entries: [{ productId: 1 }, null] }).entries).toHaveLength(0)
    })

    it('clamps a tampered quantity', () => {
      const state = sanitizeCartState({
        entries: [{ productId: 'tshirt-taggo', variantId: TSHIRT_VARIANT, quantity: 5000 }],
      })
      expect(state.entries[0].quantity).toBe(MAX_LINE_QUANTITY)
    })
  })
})