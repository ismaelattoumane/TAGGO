import type { SupabaseClient } from '@supabase/supabase-js'
import { isUuid, type CatalogLookup, type ServerCatalogEntry } from './catalogTypes'

/**
 * ÉTAPE 9 — Lecture serveur du catalogue Supabase.
 *
 * Le frontend ne fournit QUE `variantId` + `quantity`. Le serveur relit le
 * produit, la variante, le prix, la devise et la disponibilité, puis recalcule
 * chaque total. Aucun montant reçu du navigateur n'est réutilisé.
 */

type CatalogProductRow = {
  slug: string
  name: string
  status: string
  description: string | null
}

type CatalogRow = {
  id: string
  product_id: string
  size: string | null
  color: string | null
  price_cents: number | null
  currency: string | null
  available: boolean
  stock: number | null
  products: CatalogProductRow | CatalogProductRow[] | null
}

const VARIANT_SELECT =
  'id, product_id, size, color, price_cents, currency, available, stock, product:products!inner(slug, name, status, description)'

/** Lecture Supabase du catalogue (lecture seule, aucun secret côté client). */
export function createSupabaseCatalogLookup(client: SupabaseClient): CatalogLookup {
  return {
    async findVariant(variantId: string): Promise<ServerCatalogEntry | null> {
      if (!isUuid(variantId)) return null

      const { data, error } = await client
        .from('product_variants')
        .select(VARIANT_SELECT)
        .eq('id', variantId)
        .maybeSingle()

      if (error || !data) return null
      return toCatalogEntry(data as unknown as CatalogRow)
    },
  }
}

export function toCatalogEntry(row: CatalogRow): ServerCatalogEntry {
  const product = Array.isArray(row.products) ? row.products[0] : row.products

  return {
    variantId: row.id,
    productId: row.product_id,
    slug: product?.slug ?? '',
    name: product?.name ?? '',
    description: product?.description ?? '',
    size: row.size,
    color: row.color,
    priceCents: row.price_cents,
    currency: row.currency,
    available: row.available && product?.status === 'active',
    stock: row.stock,
  }
}