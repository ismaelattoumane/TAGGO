/**
 * TAGGO shop domain model.
 *
 * Mirrors the shape the Supabase catalog will use (`products` /
 * `product_variants`, added with the server-side catalogue that becomes the
 * price authority before payment) with camelCase domain types, exactly like
 * `features/qr/qrTypes.ts` and `features/orders/orderTypes.ts`.
 *
 * No `orders` / `order_items` table is introduced here: the shop reuses the
 * step 7 order architecture.
 *
 * No price, size, color or stock logic lives in this file: it only describes
 * the shape of the data so the catalog, the cart and the checkout share one
 * contract.
 */

export type ProductStatus = 'draft' | 'active' | 'archived'

export type ProductImage = {
  src: string
  alt: string
}

export type ProductVariant = {
  id: string
  productId: string
  /** `null` while the textile reference is not defined yet. */
  size: string | null
  /** `null` while the textile reference is not defined yet. */
  color: string | null
  /**
   * Unit price in cents, or `null` when no official TAGGO price exists yet.
   * No amount is ever invented: an unpublished price must stay `null` and be
   * displayed as "Prix à venir". The backend becomes the price authority
   * before payment integration.
   */
  priceCents: number | null
  sku: string | null
  /** `null` = textile stock not managed at this stage (step 8). */
  stock: number | null
  available: boolean
}

export type Product = {
  id: string
  slug: string
  name: string
  shortDescription: string
  description: string
  status: ProductStatus
  /** Product photos. Empty until production photography is delivered. */
  images: ProductImage[]
  /** Available sizes. Empty until the textile chart is defined. */
  sizes: string[]
  /** Available colors. Empty until the textile chart is defined. */
  colors: string[]
  variants: ProductVariant[]
  createdAt: string
  updatedAt: string
}

/** Human readable variant attributes, e.g. `['Taille : M', 'Couleur : Noir']`. */
export function getVariantAttributes(variant: ProductVariant): string[] {
  return [
    ...(variant.size ? [`Taille : ${variant.size}`] : []),
    ...(variant.color ? [`Couleur : ${variant.color}`] : []),
  ]
}

export function isVariantAvailable(variant: ProductVariant): boolean {
  if (!variant.available) return false
  return variant.stock === null || variant.stock > 0
}