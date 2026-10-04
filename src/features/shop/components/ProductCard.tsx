import { Link } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge/Badge'
import { isPurchasable } from '../catalog'
import { formatPriceRange } from '../price'
import type { Product } from '../productTypes'
import { ProductMedia } from './ProductMedia'

/** Catalogue card: image, name, short description, price, variants, CTA. */
export function ProductCard({ product }: { product: Product }) {
  const purchasable = isPurchasable(product)
  const variantCount = product.variants.length

  return (
    <article className="shop-card">
      <Link className="shop-card__media" to={`/shop/${product.slug}`} tabIndex={-1} aria-hidden="true">
        <ProductMedia product={product} />
      </Link>

      <div className="shop-card__body">
        <div className="shop-card__heading">
          <h3 className="shop-card__title">{product.name}</h3>
          <Badge tone={purchasable ? 'active' : 'draft'}>
            {purchasable ? 'Disponible' : 'Bientôt disponible'}
          </Badge>
        </div>

        <p className="shop-card__description">{product.shortDescription}</p>

        <p className="shop-card__price">{formatPriceRange(product.variants.map((v) => v.priceCents))}</p>

        <p className="shop-card__variants">
          {variantCount === 1
            ? '1 variante disponible'
            : `${variantCount} variantes disponibles`}
        </p>

        <Link
          className="taggo-button taggo-button--ghost shop-card__cta"
          to={`/shop/${product.slug}`}
          aria-label={`Voir le produit ${product.name}`}
        >
          Voir le produit
        </Link>
      </div>
    </article>
  )
}