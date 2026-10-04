import { describe, expect, it } from 'vitest'
import { addToCart, EMPTY_CART, getCartSubtotalCents, resolveCartLines, type CartLine } from './cart'
import {
  CHECKOUT_EMPTY_CART_MESSAGE,
  CHECKOUT_PRICING_PENDING_MESSAGE,
  hasCustomerInfoErrors,
  prepareCheckoutDraft,
  validateCustomerInfo,
} from './checkout'

const TSHIRT_VARIANT = 'tshirt-taggo--default'

/** Test-only fixture price: the real catalog publishes no amount yet. */
const FIXTURE_PRICE_CENTS = 4200

/** Real catalog lines (currently unpriced). */
function buildLines(quantity = 1): CartLine[] {
  return resolveCartLines(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, quantity))
}

/** Same lines, priced, to exercise the published-price checkout path. */
function buildPricedLines(quantity = 1): CartLine[] {
  return buildLines(quantity).map((line) => ({
    ...line,
    unitPriceCents: FIXTURE_PRICE_CENTS,
    lineTotalCents: FIXTURE_PRICE_CENTS * line.quantity,
  }))
}

const VALID_CUSTOMER = {
  firstName: 'Alex',
  lastName: 'Martin',
  email: 'alex@example.com',
}

describe('shop checkout (without payment)', () => {
  describe('validateCustomerInfo', () => {
    it('accepts valid customer data', () => {
      const errors = validateCustomerInfo(VALID_CUSTOMER)
      expect(hasCustomerInfoErrors(errors)).toBe(false)
    })

    it('rejects a missing first name, last name or email', () => {
      const errors = validateCustomerInfo({ firstName: '', lastName: '', email: '' })
      expect(errors.firstName).toBeDefined()
      expect(errors.lastName).toBeDefined()
      expect(errors.email).toBeDefined()
    })

    it('rejects an invalid email', () => {
      expect(validateCustomerInfo({ ...VALID_CUSTOMER, email: 'pas-un-email' }).email).toBe(
        'Cette adresse email n’est pas valide.',
      )
    })

    it('rejects a name made of markup only', () => {
      const errors = validateCustomerInfo({ ...VALID_CUSTOMER, firstName: '<script></script>' })
      expect(errors.firstName).toBeDefined()
    })
  })

  describe('prepareCheckoutDraft', () => {
    it('refuses an empty cart', () => {
      const result = prepareCheckoutDraft([], VALID_CUSTOMER)
      expect('error' in result && result.error).toBe(CHECKOUT_EMPTY_CART_MESSAGE)
    })

    it('refuses invalid customer data', () => {
      const result = prepareCheckoutDraft(buildPricedLines(), { firstName: '', lastName: '', email: '' })
      expect('error' in result).toBe(true)
    })

    it('refuses to quote an order while the official prices are unpublished', () => {
      const result = prepareCheckoutDraft(buildLines(2), VALID_CUSTOMER)
      expect('error' in result && result.error).toBe(CHECKOUT_PRICING_PENDING_MESSAGE)
    })

    it('builds the payment-ready draft from the cart once prices exist', () => {
      const lines = buildPricedLines(2)
      const result = prepareCheckoutDraft(lines, VALID_CUSTOMER)

      if (!('draft' in result)) throw new Error('draft attendu')

      expect(result.draft.currency).toBe('EUR')
      expect(result.draft.customer).toEqual(VALID_CUSTOMER)
      expect(result.draft.items).toEqual([
        {
          productId: 'tshirt-taggo',
          variantId: TSHIRT_VARIANT,
          quantity: 2,
          unitPriceCents: FIXTURE_PRICE_CENTS,
          lineTotalCents: FIXTURE_PRICE_CENTS * 2,
        },
      ])
      expect(result.draft.subtotalCents).toBe(getCartSubtotalCents(lines))
    })

    it('never marks the payment as started', () => {
      const result = prepareCheckoutDraft(buildPricedLines(), VALID_CUSTOMER)
      if (!('draft' in result)) throw new Error('draft attendu')

      expect(result.draft.payment).toEqual({ status: 'not_started', provider: null })
    })

    it('normalises the customer input before building the draft', () => {
      const result = prepareCheckoutDraft(buildPricedLines(), {
        firstName: '  Alex  ',
        lastName: ' Martin  ',
        email: 'Alex@Example.COM',
      })

      if (!('draft' in result)) throw new Error('draft attendu')
      expect(result.draft.customer).toEqual({
        firstName: 'Alex',
        lastName: 'Martin',
        email: 'alex@example.com',
      })
    })
  })
})