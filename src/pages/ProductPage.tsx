import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/ui/Button/Button'
import { Card } from '../components/ui/Card/Card'
import { Container, Section } from '../components/ui/Layout/Layout'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { EmptyState } from '../components/ui/State/State'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { usePageSeo } from '../lib/usePageSeo'
import { getDefaultVariant, getProductBySlug, findVariantForSelection, isPurchasable } from '../features/shop/catalog'
import { MAX_LINE_QUANTITY } from '../features/shop/cart'
import { formatPriceCents, formatPriceRange } from '../features/shop/price'
import { getVariantAttributes, isVariantAvailable, type ProductVariant } from '../features/shop/productTypes'
import { ProductMedia } from '../features/shop/components/ProductMedia'
import { ShopFooter, ShopHeader } from '../features/shop/components/ShopShell'
import '../features/shop/shop.css'

function getMeta(product: ReturnType<typeof getProductBySlug>) {
  if (!product) {
    return {
      title: 'Produit introuvable — Boutique TAGGO',
      description: 'Ce produit TAGGO n’existe pas ou n’est plus disponible.',
    }
  }

  return {
    title: `${product.name} — Boutique TAGGO`,
    description: product.shortDescription,
  }
}

/** Public product page — presentation, variant choice, quantity, add to cart. */
export function ProductPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addItem } = useCart()

  const product = getProductBySlug(slug)
  const meta = getMeta(product)

  const purchasable = product ? isPurchasable(product) : false

  const [selection, setSelection] = useState<{ size: string | null; color: string | null }>({
    size: null,
    color: null,
  })
  const [quantity, setQuantity] = useState(1)

  usePageSeo({
    title: meta.title,
    description: meta.description,
    canonicalPath: product ? `/shop/${product.slug}` : undefined,
  })

  if (!product) {
    return (
      <div className="shop-page">
        <ShopHeader />
        <main className="shop-main">
          <Container size="sm">
            <Section spacing="md">
              <EmptyState
                title="Produit introuvable"
                description="Ce produit n’existe pas ou n’est plus disponible."
                action={
                  <Link className="taggo-button taggo-button--primary" to="/shop">
                    Retour à la boutique
                  </Link>
                }
              />
            </Section>
          </Container>
        </main>
        <ShopFooter />
      </div>
    )
  }

  const selectedVariant: ProductVariant | null = product
    ? findVariantForSelection(product, selection) ?? getDefaultVariant(product)
    : null
  const hasSizeSelector = product.sizes.length > 0
  const hasColorSelector = product.colors.length > 0
  const canAdd = purchasable && selectedVariant !== null && isVariantAvailable(selectedVariant)
  const variantAttributes = selectedVariant ? getVariantAttributes(selectedVariant) : []

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!canAdd || !selectedVariant) return

    addItem(product.id, selectedVariant.id, quantity)
    navigate('/cart')
  }

  return (
    <div className="shop-page">
      <ShopHeader />

      <main className="shop-main">
        <Container size="lg">
          <Section spacing="md" className="shop-product">
            <nav aria-label="Fil d’Ariane" className="shop-breadcrumb">
              <Link to="/shop">Boutique</Link>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{product.name}</span>
            </nav>

            <div className="shop-product__layout">
              <div className="shop-product__media">
                <ProductMedia product={product} />
              </div>

              <div className="shop-product__panel">
                <Eyebrow>{purchasable ? 'Disponible' : 'Bientôt disponible'}</Eyebrow>
                <h1>{product.name}</h1>
                <p className="shop-product__price">
                  {selectedVariant
                    ? formatPriceCents(selectedVariant.priceCents)
                    : formatPriceRange(product.variants.map((variant) => variant.priceCents))}
                </p>

                <p className="shop-product__description">{product.description}</p>

                <form className="shop-product__form" onSubmit={handleSubmit}>
                  {hasSizeSelector ? (
                    <fieldset className="shop-option">
                      <legend className="shop-option__legend">Taille</legend>
                      <div className="shop-option__values">
                        {product.sizes.map((size) => (
                          <label key={size} className="shop-option__value">
                            <input
                              type="radio"
                              name="shop-size"
                              value={size}
                              checked={selection.size === size}
                              onChange={() =>
                                setSelection((current) => ({ ...current, size }))
                              }
                            />
                            <span>{size}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}

                  {hasColorSelector ? (
                    <fieldset className="shop-option">
                      <legend className="shop-option__legend">Couleur</legend>
                      <div className="shop-option__values">
                        {product.colors.map((color) => (
                          <label key={color} className="shop-option__value">
                            <input
                              type="radio"
                              name="shop-color"
                              value={color}
                              checked={selection.color === color}
                              onChange={() =>
                                setSelection((current) => ({ ...current, color }))
                              }
                            />
                            <span>{color}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ) : null}

                  {!hasSizeSelector && !hasColorSelector ? (
                    <p className="shop-product__option-note">
                      Les tailles et couleurs seront communiquées dès l’ouverture des commandes.
                      Le format de référence est indiqué à la confirmation.
                    </p>
                  ) : null}

                  <div className="shop-product__quantity">
                    <label htmlFor="shop-product-quantity">Quantité</label>
                    <input
                      id="shop-product-quantity"
                      name="quantity"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MAX_LINE_QUANTITY}
                      step={1}
                      value={quantity}
                      onChange={(event) => setQuantity(Number(event.target.value) || 1)}
                    />
                  </div>

                  {variantAttributes.length > 0 ? (
                    <p className="shop-product__variant-attributes">
                      {variantAttributes.join(' · ')}
                    </p>
                  ) : null}

                  <Button type="submit" disabled={!canAdd}>
                    {purchasable ? 'Ajouter au panier' : 'Bientôt disponible'}
                  </Button>

                  {!purchasable ? (
                    <p className="shop-product__unavailable" role="status">
                      Ce produit n’est pas encore commandable.
                    </p>
                  ) : null}
                </form>
              </div>
            </div>

            <Card as="section" className="shop-product__taggo" aria-labelledby="shop-taggo-heading">
              <h2 id="shop-taggo-heading">Le TAGGO inclus</h2>
              <p>
                Chaque vêtement TAGGO possède un TAGGO — un QR code unique brodé sur le textile.
                En le scannant, vous accédez à votre page TAGGO publique et personnalisable :
                c’est votre profil connecté au vêtement que vous portez.
              </p>
              <p>
                Un TAGGO n’est lié à votre commande qu’après validation du paiement : un panier
                reste un panier et ne réserve aucun TAGGO physique.
              </p>
            </Card>

            {user ? (
              <p className="shop-product__account">
                Connecté en tant que {user.email}. Votre TAGGO sera rattaché à votre compte lors de
                la commande.
              </p>
            ) : (
              <p className="shop-product__account">
                Vous pouvez commander sans compte. Un compte TAGGO (
                <Link to="/register">inscription</Link>) vous permettra ensuite de personnaliser
                votre profil.
              </p>
            )}
          </Section>
        </Container>
      </main>

      <ShopFooter />
    </div>
  )
}