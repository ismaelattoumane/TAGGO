import { Link } from 'react-router-dom'
import { Button } from '../../../components/ui/Button/Button'
import { Card } from '../../../components/ui/Card/Card'
import { EmptyState } from '../../../components/ui/State/State'
import { formatPriceCents } from '../price'
import { useCart } from '../../../context/CartContext'

export type CartViewProps = {
  /** The checkout CTA can be hidden where navigation must not be proposed. */
  showCheckoutCta?: boolean
  heading?: string
}

/**
 * Shared cart presentation: line items, quantity controls, subtotal, actions.
 * Reused by `/cart` and by the checkout summary so the two stay identical.
 */
export function CartView({ showCheckoutCta = true, heading = 'Panier' }: CartViewProps) {
  const { lines, itemCount, subtotalCents, setQuantity, removeItem, clear } = useCart()

  if (lines.length === 0) {
    return (
      <EmptyState
        title="Votre panier est vide"
        description="Parcourez la boutique pour ajouter votre premier TAGGO."
        action={
          <Link className="taggo-button taggo-button--primary" to="/shop">
            Découvrir la boutique
          </Link>
        }
      />
    )
  }

  return (
    <section className="shop-cart" aria-labelledby="shop-cart-heading">
      <div className="shop-cart__head">
        <h1 id="shop-cart-heading">{heading}</h1>
        <p className="shop-cart__count">
          {itemCount} {itemCount > 1 ? 'articles' : 'article'}
        </p>
      </div>

      <ul className="shop-cart__lines">
        {lines.map((line) => {
          const attributes = [
            ...(line.variant.size ? [`Taille : ${line.variant.size}`] : []),
            ...(line.variant.color ? [`Couleur : ${line.variant.color}`] : []),
          ]
          const quantityId = `quantity-${line.lineId}`

          return (
            <li key={line.lineId} className="shop-cart__line">
              <div className="shop-cart__line-info">
                <p className="shop-cart__line-name">
                  <Link to={`/shop/${line.product.slug}`}>{line.product.name}</Link>
                </p>
                {attributes.map((attribute) => (
                  <p key={attribute} className="shop-cart__line-attribute">
                    {attribute}
                  </p>
                ))}
                <p className="shop-cart__line-price">
                  {line.unitPriceCents === null
                    ? 'Prix non encore publié'
                    : `Prix unitaire : ${formatPriceCents(line.unitPriceCents)}`}
                </p>
              </div>

              <div className="shop-cart__line-quantity">
                <label className="shop-cart__quantity-label" htmlFor={quantityId}>
                  Quantité
                </label>
                <input
                  id={quantityId}
                  className="shop-cart__quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10}
                  step={1}
                  value={line.quantity}
                  onChange={(event) => setQuantity(line.lineId, Number(event.target.value))}
                />
              </div>

              <p className="shop-cart__line-total">{formatPriceCents(line.lineTotalCents)}</p>

              <Button
                variant="danger-ghost"
                className="shop-cart__remove"
                aria-label={`Supprimer ${line.product.name} du panier`}
                onClick={() => removeItem(line.lineId)}
              >
                Supprimer
              </Button>
            </li>
          )
        })}
      </ul>

      <Card as="section" className="shop-cart__summary" aria-label="Sous-total">
        <div className="shop-cart__summary-row">
          <span>Sous-total</span>
          <strong>{formatPriceCents(subtotalCents)}</strong>
        </div>
        <p className="shop-cart__note">
          Livraison et paiement ne sont pas encore disponibles : ils arrivent à l’étape suivante.
        </p>

        <div className="shop-cart__actions">
          <Link className="taggo-button taggo-button--ghost" to="/shop">
            Continuer mes achats
          </Link>
          {showCheckoutCta ? (
            <Link className="taggo-button taggo-button--primary" to="/checkout">
              Passer la commande
            </Link>
          ) : null}
          <Button variant="link" onClick={clear}>
            Vider le panier
          </Button>
        </div>
      </Card>
    </section>
  )
}