import type { Product } from '../productTypes'

/**
 * Product media.
 * Renders the production photo when it exists, otherwise an accessible
 * placeholder: no fake asset is invented before the production photography.
 */
export function ProductMedia({ product, className }: { product: Product; className?: string }) {
  const classes = ['shop-media', className].filter(Boolean).join(' ')
  const image = product.images[0]

  if (image) {
    return <img className={classes} src={image.src} alt={image.alt} loading="lazy" />
  }

  return (
    <div
      className={`${classes} shop-media--placeholder`}
      role="img"
      aria-label={`${product.name} — photographie à venir`}
    >
      <span className="shop-media__monogram" aria-hidden="true">
        TAGGO
      </span>
    </div>
  )
}