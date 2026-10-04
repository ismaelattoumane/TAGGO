import { describe, expect, it } from 'vitest'
import {
  findVariantForSelection,
  getAvailableVariants,
  getDefaultVariant,
  getProductById,
  getProductBySlug,
  getProductVariant,
  getVariantById,
  isPurchasable,
  listShopProducts,
} from './catalog'
import { formatPriceCents, formatPriceRange, PRICE_NOT_ANNOUNCED } from './price'
import { isVariantAvailable } from './productTypes'

describe('shop catalog', () => {
  describe('catalogue', () => {
    it('exposes the TAGGO products declared by the project', () => {
      const products = listShopProducts()
      expect(products.map((product) => product.slug)).toEqual(['tshirt-taggo', 'hoodie-taggo'])
    })

    it('does not invent extra products', () => {
      expect(listShopProducts()).toHaveLength(2)
    })

    it('keeps the T-shirt TAGGO purchasable and the Hoodie not orderable yet', () => {
      const tshirt = getProductBySlug('tshirt-taggo')
      const hoodie = getProductBySlug('hoodie-taggo')

      expect(tshirt?.status).toBe('active')
      expect(hoodie?.status).toBe('draft')
      expect(isPurchasable(tshirt!)).toBe(true)
      expect(isPurchasable(hoodie!)).toBe(false)
    })
  })

  describe('getProductBySlug', () => {
    it('resolves a valid slug', () => {
      expect(getProductBySlug('tshirt-taggo')?.name).toBe('T-shirt TAGGO')
    })

    it('is case insensitive and trims nothing else', () => {
      expect(getProductBySlug('TSHIRT-TAGGO')?.id).toBe('tshirt-taggo')
    })

    it('returns null for an unknown slug', () => {
      expect(getProductBySlug('casquette-taggo')).toBeNull()
    })

    it('returns null for an empty or undefined slug', () => {
      expect(getProductBySlug('')).toBeNull()
      expect(getProductBySlug(undefined)).toBeNull()
    })

    it('rejects slug traversal attempts', () => {
      expect(getProductBySlug('../dashboard')).toBeNull()
    })
  })

  describe('getProductById', () => {
    it('resolves a known product', () => {
      expect(getProductById('hoodie-taggo')?.name).toBe('Hoodie TAGGO')
    })

    it('returns null for an unknown product', () => {
      expect(getProductById('unknown')).toBeNull()
    })
  })

  describe('variants', () => {
    it('resolves an existing variant', () => {
      const variant = getVariantById('tshirt-taggo--default')
      expect(variant?.productId).toBe('tshirt-taggo')
      expect(isVariantAvailable(variant!)).toBe(true)
    })

    it('returns null for a non-existent variant', () => {
      expect(getVariantById('tshirt-taggo--xl')).toBeNull()
      expect(getProductVariant(getProductBySlug('tshirt-taggo')!, 'tshirt-taggo--xl')).toBeNull()
    })

    it('marks the not-yet-produced Hoodie variant as unavailable', () => {
      const hoodie = getProductBySlug('hoodie-taggo')!
      expect(getAvailableVariants(hoodie)).toHaveLength(0)
      expect(isVariantAvailable(getDefaultVariant(hoodie)!)).toBe(false)
    })

    it('resolves a variant from a partial size/color selection', () => {
      const tshirt = getProductBySlug('tshirt-taggo')!
      expect(findVariantForSelection(tshirt, { size: null, color: null })?.id).toBe('tshirt-taggo--default')
      expect(findVariantForSelection(tshirt, { size: 'XL', color: null })).toBeNull()
    })
  })

  describe('price source of truth', () => {
    it('publishes no invented price: every variant price is null', () => {
      for (const product of listShopProducts()) {
        for (const variant of product.variants) {
          expect(variant.priceCents).toBeNull()
        }
      }
    })

    it('renders an unpublished price as "Prix à venir", never as an amount', () => {
      expect(formatPriceCents(null)).toBe(PRICE_NOT_ANNOUNCED)
      expect(formatPriceCents(null)).not.toMatch(/\d/)
      expect(formatPriceRange([null])).toBe(PRICE_NOT_ANNOUNCED)
      expect(formatPriceRange([null, 1000])).toBe(PRICE_NOT_ANNOUNCED)
      expect(formatPriceRange([])).toBe(PRICE_NOT_ANNOUNCED)
    })

    it('formats a range only once real prices exist', () => {
      expect(formatPriceRange([1000, 2000])).toBe('De 10,00 € à 20,00 €')
      expect(formatPriceRange([1000, 1000])).toBe('10,00 €')
    })
  })

  describe('no invented textile data', () => {
    it('leaves sizes, colors, SKU and stock empty', () => {
      for (const product of listShopProducts()) {
        expect(product.sizes).toEqual([])
        expect(product.colors).toEqual([])
        expect(product.images).toEqual([])
        for (const variant of product.variants) {
          expect(variant.size).toBeNull()
          expect(variant.color).toBeNull()
          expect(variant.sku).toBeNull()
          expect(variant.stock).toBeNull()
        }
      }
    })
  })
})