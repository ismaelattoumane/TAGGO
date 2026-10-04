import { getProductById, getVariantById } from './catalog'
import { isVariantAvailable, type Product, type ProductVariant } from './productTypes'

/**
 * TAGGO shop cart — pure state transitions.
 *
 * SECURITY NOTE: a cart is not an order. Only references are stored
 * (`productId`, `variantId`, `quantity`): names, prices and availability are
 * always resolved from the catalog at render time, so a tampered localStorage
 * payload can never dictate a price. The backend stays authoritative.
 */

export const MAX_LINE_QUANTITY = 10

export type CartEntry = {
  productId: string
  variantId: string
  quantity: number
}

export type CartState = {
  entries: CartEntry[]
}

export type CartLine = {
  lineId: string
  product: Product
  variant: ProductVariant
  quantity: number
  /** `null` while the official price is not published. */
  unitPriceCents: number | null
  /** `null` while the official price is not published. */
  lineTotalCents: number | null
}

export const EMPTY_CART: CartState = { entries: [] }

export function buildLineId(productId: string, variantId: string): string {
  return `${productId}:${variantId}`
}

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_LINE_QUANTITY)
}

function normalizeEntry(entry: CartEntry): CartEntry | null {
  if (!entry.productId || !entry.variantId) return null
  return {
    productId: entry.productId,
    variantId: entry.variantId,
    quantity: clampQuantity(entry.quantity),
  }
}

/** Adds a product variant, merging quantities when the variant is already in the cart. */
export function addToCart(state: CartState, productId: string, variantId: string, quantity = 1): CartState {
  const safeQuantity = clampQuantity(quantity)
  const index = state.entries.findIndex(
    (entry) => entry.productId === productId && entry.variantId === variantId,
  )

  if (index === -1) {
    return { entries: [...state.entries, { productId, variantId, quantity: safeQuantity }] }
  }

  const entries = state.entries.slice()
  entries[index] = {
    ...entries[index],
    quantity: clampQuantity(entries[index].quantity + safeQuantity),
  }
  return { entries }
}

export function setLineQuantity(state: CartState, lineId: string, quantity: number): CartState {
  if (quantity <= 0) return removeLine(state, lineId)
  return {
    entries: state.entries.map((entry) =>
      buildLineId(entry.productId, entry.variantId) === lineId
        ? { ...entry, quantity: clampQuantity(quantity) }
        : entry,
    ),
  }
}

export function removeLine(state: CartState, lineId: string): CartState {
  return {
    entries: state.entries.filter((entry) => buildLineId(entry.productId, entry.variantId) !== lineId),
  }
}

export function clearCart(): CartState {
  return { entries: [] }
}

export function countCartItems(state: CartState): number {
  return state.entries.reduce((total, entry) => total + entry.quantity, 0)
}

/**
 * Resolves stored entries against the catalog.
 * Unknown products, unknown variants and unavailable variants are dropped:
 * a cart must never display or total something the shop cannot sell.
 */
export function resolveCartLines(state: CartState): CartLine[] {
  const lines: CartLine[] = []

  for (const rawEntry of state.entries) {
    const entry = normalizeEntry(rawEntry)
    if (!entry) continue

    const product = getProductById(entry.productId)
    if (!product) continue

    const variant = getVariantById(entry.variantId)
    if (!variant || variant.productId !== product.id) continue
    if (product.status !== 'active' || !isVariantAvailable(variant)) continue

    lines.push({
      lineId: buildLineId(product.id, variant.id),
      product,
      variant,
      quantity: entry.quantity,
      unitPriceCents: variant.priceCents,
      lineTotalCents: variant.priceCents === null ? null : variant.priceCents * entry.quantity,
    })
  }

  return lines
}

/**
 * True only when every line carries a published price.
 * Totals and payment are refused otherwise: no amount may be invented.
 */
export function hasCompletePricing(lines: CartLine[]): boolean {
  return lines.length > 0 && lines.every((line) => line.unitPriceCents !== null)
}

/** Subtotal in cents, or `null` while at least one price is unpublished. */
export function getCartSubtotalCents(lines: CartLine[]): number | null {
  if (!hasCompletePricing(lines)) return null
  return lines.reduce((total, line) => total + (line.lineTotalCents ?? 0), 0)
}

/** Repairs an arbitrary payload coming from storage. */
export function sanitizeCartState(value: unknown): CartState {
  if (!value || typeof value !== 'object') return { entries: [] }

  const rawEntries = (value as { entries?: unknown }).entries
  if (!Array.isArray(rawEntries)) return { entries: [] }

  const entries = rawEntries
    .map((raw): CartEntry | null => {
      if (!raw || typeof raw !== 'object') return null
      const candidate = raw as Record<string, unknown>
      if (typeof candidate.productId !== 'string' || typeof candidate.variantId !== 'string') {
        return null
      }
      return normalizeEntry({
        productId: candidate.productId,
        variantId: candidate.variantId,
        quantity: typeof candidate.quantity === 'number' ? candidate.quantity : 1,
      })
    })
    .filter((entry): entry is CartEntry => entry !== null)

  return { entries }
}