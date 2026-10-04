/**
 * TAGGO shop pricing — single formatting source of truth.
 *
 * Amounts are integers in cents (no float arithmetic) to avoid rounding drift
 * between catalogue, product page, cart and order summary.
 *
 * The unit price itself always comes from `ProductVariant.priceCents`
 * (`features/shop/catalog.ts`). Nothing in the UI may hardcode an amount.
 *
 * An unpublished price is `null` and is never guessed: it renders as
 * `PRICE_NOT_ANNOUNCED` so no invented amount can reach the shopper.
 */

export const SHOP_CURRENCY = 'EUR'

export const PRICE_NOT_ANNOUNCED = 'Prix à venir'

const priceFormatters = new Map<string, Intl.NumberFormat>()

function getFormatter(locale: string): Intl.NumberFormat {
  const cached = priceFormatters.get(locale)
  if (cached) return cached

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: SHOP_CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  priceFormatters.set(locale, formatter)
  return formatter
}

export function formatPriceCents(amountCents: number | null, locale = 'fr-FR'): string {
  if (amountCents === null || !Number.isFinite(amountCents)) return PRICE_NOT_ANNOUNCED
  return getFormatter(locale).format(amountCents / 100)
}

/**
 * Product price label.
 * - unpublished price → `Prix à venir`
 * - single published price → the formatted amount, e.g. `29,00 €`
 * - several distinct published prices → `De X à Y`
 */
export function formatPriceRange(priceCentsList: (number | null)[], locale = 'fr-FR'): string {
  if (priceCentsList.some((price) => price === null || !Number.isFinite(price))) {
    return PRICE_NOT_ANNOUNCED
  }

  const prices = priceCentsList as number[]
  if (prices.length === 0) return PRICE_NOT_ANNOUNCED

  const lowest = Math.min(...prices)
  const highest = Math.max(...prices)
  if (lowest === highest) return formatPriceCents(lowest, locale)

  return `De ${formatPriceCents(lowest, locale)} à ${formatPriceCents(highest, locale)}`
}