import type { Product, ProductVariant } from './productTypes'
import { isVariantAvailable } from './productTypes'

/**
 * TAGGO shop catalog — the only place products, variants and prices are declared.
 *
 * NO COMMERCIAL DATA IS INVENTED
 * No official TAGGO price, size, color, SKU or textile stock exists in the
 * project yet. Those fields therefore stay empty (`null` / `[]`) and the shop
 * displays "Prix à venir" instead of a made-up amount. The structure is ready:
 * filling `priceCents` (and `sizes` / `colors` / `sku` / `stock`) is the only
 * change needed to publish real prices later.
 *
 * `priceCents` stays the single source of truth for every displayed amount, and
 * the frontend is never the final authority: the backend must re-read and
 * revalidate every price before payment integration.
 */

const CREATED_AT = '2026-09-30T00:00:00.000Z'

function createVariant(
  productId: string,
  key: string,
  overrides: Partial<ProductVariant> = {},
): ProductVariant {
  return {
    id: `${productId}--${key}`,
    productId,
    size: null,
    color: null,
    // Official price: not defined yet.
    priceCents: null,
    sku: null,
    stock: null,
    available: true,
    ...overrides,
  }
}

const TSHIRT_VARIANT = createVariant('tshirt-taggo', 'default')

const HOODIE_VARIANT = createVariant('hoodie-taggo', 'default', {
  available: false,
})

const PRODUCTS: Product[] = [
  {
    id: 'tshirt-taggo',
    slug: 'tshirt-taggo',
    name: 'T-shirt TAGGO',
    shortDescription:
      'Le T-shirt connecté TAGGO : un QR code qui mène à votre profil public personnalisable.',
    description:
      'Le T-shirt TAGGO porte le TAGGO TAG — un QR code unique qui ouvre votre page publique TAGGO. Vous y personnalisez votre profil : liens, contenus et présentation. Un seul exemplaire correspond à un seul profil : chaque T-shirt acheté ouvre la création de votre TAGGO.',
    status: 'active',
    images: [],
    sizes: [],
    colors: [],
    variants: [TSHIRT_VARIANT],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  },
  {
    id: 'hoodie-taggo',
    slug: 'hoodie-taggo',
    name: 'Hoodie TAGGO',
    shortDescription:
      'La version chaude du TAGGO : même QR code, même profil public, format hoodie.',
    description:
      'Le Hoodie TAGGO reprend le principe du T-shirt TAGGO avec le même QR code et la même page publique personnalisable. Sa production et ses références textiles ne sont pas encore communiquées : la fiche produit reste ouverte et n’est pas commandable pour le moment.',
    status: 'draft',
    images: [],
    sizes: [],
    colors: [],
    variants: [HOODIE_VARIANT],
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  },
]

const PRODUCTS_BY_SLUG = new Map(PRODUCTS.map((product) => [product.slug, product]))
const PRODUCTS_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]))

/** Catalogue displayed in the shop, in declaration order. */
export function listShopProducts(): Product[] {
  return PRODUCTS
}

export function getProductBySlug(slug: string | undefined): Product | null {
  if (!slug) return null
  return PRODUCTS_BY_SLUG.get(slug.toLowerCase()) ?? null
}

export function getProductById(id: string): Product | null {
  return PRODUCTS_BY_ID.get(id) ?? null
}

export function getVariantById(variantId: string): ProductVariant | null {
  for (const product of PRODUCTS) {
    const variant = product.variants.find((candidate) => candidate.id === variantId)
    if (variant) return variant
  }
  return null
}

/** Resolves a variant only if it really belongs to the given product. */
export function getProductVariant(product: Product, variantId: string): ProductVariant | null {
  return product.variants.find((variant) => variant.id === variantId) ?? null
}

export function getAvailableVariants(product: Product): ProductVariant[] {
  return product.variants.filter(isVariantAvailable)
}

/** Default variant used by the product page when nothing is selected yet. */
export function getDefaultVariant(product: Product): ProductVariant | null {
  return getAvailableVariants(product)[0] ?? product.variants[0] ?? null
}

/**
 * Resolves the variant matching a partial size/color selection.
 * `null` means "not selected": any variant is acceptable for that axis.
 */
export function findVariantForSelection(
  product: Product,
  selection: { size: string | null; color: string | null },
): ProductVariant | null {
  return (
    product.variants.find(
      (variant) =>
        (selection.size === null || variant.size === selection.size) &&
        (selection.color === null || variant.color === selection.color),
    ) ?? null
  )
}

export function isPurchasable(product: Product): boolean {
  return product.status === 'active' && getAvailableVariants(product).length > 0
}

export function getProductPrices(product: Product): (number | null)[] {
  return product.variants.map((variant) => variant.priceCents)
}