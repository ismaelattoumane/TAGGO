import {
  MAX_PAYMENT_LINE_QUANTITY,
  MAX_PAYMENT_LINES,
  type CheckoutRequestItem,
  type PaymentErrorCode,
} from '../../src/features/payments/paymentTypes'
import {
  isSupportedCurrency,
  isUuid,
  type CatalogLookup,
  type PricedCart,
  type PricedCartLine,
  type ServerCatalogEntry,
} from './catalogTypes'

/**
 * ÉTAPE 9 — Tarification serveur.
 *
 * Règles appliquées, dans l'ordre, pour CHAQUE ligne :
 *  1. la variante existe ;
 *  2. elle est active et son produit est `active` ;
 *  3. elle est achetable (`available`) ;
 *  4. son prix existe (jamais inventé) ;
 *  5. la devise est celle de TAGGO ;
 *  6. la quantité est un entier dans les bornes 1..10 ;
 *  7. le stock suffit s'il est géré.
 * Puis le serveur RECALCULE prix de ligne, sous-total et total.
 *
 * Si une seule ligne est invalide : aucune Checkout Session n'est créée.
 */

export type PricingFailure = { ok: false; code: PaymentErrorCode }
export type PricingSuccess = { ok: true; cart: PricedCart }
export type PricingResult = PricingSuccess | PricingFailure

export function isValidVariantId(value: unknown): value is string {
  return typeof value === 'string' && isUuid(value)
}

export function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_PAYMENT_LINE_QUANTITY
  )
}

/**
 * Extraction stricte des seules références envoyées par le navigateur.
 * Tout champ supplémentaire (priceCents, subtotalCents, currency, total…) est
 * IGNORÉ : il ne peut jamais influencer le montant.
 */
export function parseCheckoutItems(body: unknown): CheckoutRequestItem[] | PaymentErrorCode {
  if (!body || typeof body !== 'object') return 'invalid_request'

  const items = (body as { items?: unknown }).items
  if (!Array.isArray(items)) return 'invalid_request'
  if (items.length === 0) return 'empty_cart'
  if (items.length > MAX_PAYMENT_LINES) return 'invalid_quantity'

  const parsed: CheckoutRequestItem[] = []
  const seen = new Set<string>()

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') return 'invalid_item'

    const candidate = raw as Record<string, unknown>
    if (!isValidVariantId(candidate.variantId)) return 'invalid_item'
    if (!isValidQuantity(candidate.quantity)) return 'invalid_quantity'
    if (seen.has(candidate.variantId)) return 'invalid_item'

    seen.add(candidate.variantId)
    parsed.push({ variantId: candidate.variantId, quantity: candidate.quantity })
  }

  return parsed
}

export function toPricedLine(entry: ServerCatalogEntry, quantity: number): PricedCartLine {
  const unitPriceCents = entry.priceCents as number
  return {
    variantId: entry.variantId,
    productId: entry.productId,
    slug: entry.slug,
    name: entry.name,
    description: entry.description,
    size: entry.size,
    color: entry.color,
    quantity,
    unitPriceCents,
    lineTotalCents: unitPriceCents * quantity,
  }
}

export async function priceCart(
  items: CheckoutRequestItem[],
  lookup: CatalogLookup,
): Promise<PricingResult> {
  const lines: PricedCartLine[] = []
  let subtotalCents = 0
  let currency: string | null = null

  for (const item of items) {
    const entry: ServerCatalogEntry | null = await lookup.findVariant(item.variantId)
    if (!entry) return { ok: false, code: 'variant_not_found' }
    if (!entry.available) return { ok: false, code: 'variant_unavailable' }
    if (entry.priceCents === null || !Number.isInteger(entry.priceCents) || entry.priceCents <= 0) {
      return { ok: false, code: 'price_unavailable' }
    }
    if (!isSupportedCurrency(entry.currency)) return { ok: false, code: 'invalid_currency' }
    if (!isValidQuantity(item.quantity)) return { ok: false, code: 'invalid_quantity' }
    if (entry.stock !== null && entry.stock < item.quantity) {
      return { ok: false, code: 'variant_unavailable' }
    }

    if (currency === null) currency = entry.currency
    if (entry.currency !== currency) return { ok: false, code: 'invalid_currency' }

    const line = toPricedLine(entry, item.quantity)
    lines.push(line)
    subtotalCents += line.lineTotalCents
  }

  if (subtotalCents <= 0) return { ok: false, code: 'price_unavailable' }

  return {
    ok: true,
    cart: {
      lines,
      subtotalCents,
      currency: currency as string,
      taggoQuantity: lines.reduce((total, line) => total + line.quantity, 0),
    },
  }
}