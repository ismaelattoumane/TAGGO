import { PAYMENT_CURRENCY } from '../../src/features/payments/paymentTypes'

/**
 * ÉTAPE 9 — Types du catalogue serveur (source de vérité des prix).
 *
 * `priceCents` est nullable : tant que le prix officiel TAGGO n'est pas publié,
 * aucune Checkout Session ne peut être créée.
 */

export type ServerCatalogEntry = {
  variantId: string
  productId: string
  slug: string
  name: string
  description: string
  size: string | null
  color: string | null
  /** Prix officiel en centimes, ou `null` si non publié. */
  priceCents: number | null
  currency: string | null
  available: boolean
  /** `null` tant que le stock textile n'est pas géré. */
  stock: number | null
}

export type PricedCartLine = {
  variantId: string
  productId: string
  slug: string
  name: string
  description: string
  size: string | null
  color: string | null
  quantity: number
  unitPriceCents: number
  lineTotalCents: number
}

export type PricedCart = {
  lines: PricedCartLine[]
  subtotalCents: number
  currency: string
  /** Nombre d'exemplaires physiques : autant de TAGGO à attribuer après paiement. */
  taggoQuantity: number
}

export interface CatalogLookup {
  findVariant(variantId: string): Promise<ServerCatalogEntry | null>
}

/** TAGGO ne traite qu'une devise : tout le reste est refusé côté serveur. */
export function isSupportedCurrency(currency: string | null): boolean {
  return currency === PAYMENT_CURRENCY
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}