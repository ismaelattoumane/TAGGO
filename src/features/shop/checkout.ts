import { isValidEmail, sanitizeText } from '../../lib/validators'
import { SHOP_CURRENCY } from './price'
import { hasCompletePricing, type CartLine } from './cart'

/**
 * TAGGO shop checkout (pre-payment).
 *
 * The checkout validates the minimum customer information required to create an
 * order, then builds a checkout draft. That draft is the exact payload the
 * payment step (next stage) will consume — no payment provider is called here
 * and no order is ever marked as paid.
 *
 * No official price is published yet: a checkout cannot be completed until the
 * prices exist. Rather than quoting a made-up amount, the flow stops with an
 * explicit message.
 */

export type CustomerInfo = {
  firstName: string
  lastName: string
  email: string
}

export type CheckoutLine = {
  productId: string
  variantId: string
  quantity: number
  /** `null` while the official price is not published. */
  unitPriceCents: number | null
  /** `null` while the official price is not published. */
  lineTotalCents: number | null
}

export type CheckoutDraft = {
  currency: typeof SHOP_CURRENCY
  customer: CustomerInfo
  items: CheckoutLine[]
  /** `null` while the official price is not published. */
  subtotalCents: number | null
  /** Explicitly not started: the payment provider is wired in the next stage. */
  payment: {
    status: 'not_started'
    provider: null
  }
}

export type CustomerInfoErrors = Partial<Record<keyof CustomerInfo, string>>

export const CHECKOUT_EMPTY_CART_MESSAGE = 'Votre panier est vide.'
export const CHECKOUT_PRICING_PENDING_MESSAGE =
  'Les prix des produits TAGGO ne sont pas encore publiés. Le paiement ouvrira dès leur annonce.'

export function normalizeCustomerInfo(input: Partial<CustomerInfo>): CustomerInfo {
  return {
    firstName: sanitizeText(input.firstName ?? ''),
    lastName: sanitizeText(input.lastName ?? ''),
    email: sanitizeText(input.email ?? '').toLowerCase(),
  }
}

/**
 * Minimal, non-invasive data collection: no phone, no address, no card.
 * Shipping fields will be added only when the delivery offer is defined.
 */
export function validateCustomerInfo(input: Partial<CustomerInfo>): CustomerInfoErrors {
  const customer = normalizeCustomerInfo(input)
  const errors: CustomerInfoErrors = {}

  if (!customer.firstName) errors.firstName = 'Le prénom est requis.'
  if (!customer.lastName) errors.lastName = 'Le nom est requis.'

  if (!customer.email) {
    errors.email = 'L’adresse email est requise.'
  } else if (!isValidEmail(customer.email)) {
    errors.email = 'Cette adresse email n’est pas valide.'
  }

  return errors
}

export function hasCustomerInfoErrors(errors: CustomerInfoErrors): boolean {
  return Object.keys(errors).length > 0
}

export function hasOrderableLines(lines: CartLine[]): boolean {
  return lines.length > 0
}

/**
 * Builds the payment-ready payload from resolved cart lines.
 * Returns an error instead of throwing so pages can render accessible messages.
 */
export function prepareCheckoutDraft(
  lines: CartLine[],
  customerInput: Partial<CustomerInfo>,
): { draft: CheckoutDraft } | { error: string } {
  if (!hasOrderableLines(lines)) {
    return { error: CHECKOUT_EMPTY_CART_MESSAGE }
  }

  if (!hasCompletePricing(lines)) {
    return { error: CHECKOUT_PRICING_PENDING_MESSAGE }
  }

  const customer = normalizeCustomerInfo(customerInput)
  const errors = validateCustomerInfo(customer)
  if (hasCustomerInfoErrors(errors)) {
    return { error: 'Vos informations client sont incomplètes.' }
  }

  return {
    draft: {
      currency: SHOP_CURRENCY,
      customer,
      items: lines.map((line) => ({
        productId: line.product.id,
        variantId: line.variant.id,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        lineTotalCents: line.lineTotalCents,
      })),
      subtotalCents: lines.reduce((total, line) => total + (line.lineTotalCents ?? 0), 0),
      payment: { status: 'not_started', provider: null },
    },
  }
}