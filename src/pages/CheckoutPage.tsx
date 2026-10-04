import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Button } from '../components/ui/Button/Button'
import { Card } from '../components/ui/Card/Card'
import { Container, Section } from '../components/ui/Layout/Layout'
import { TextField } from '../components/ui/Field/Field'
import { EmptyState } from '../components/ui/State/State'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { usePageSeo } from '../lib/usePageSeo'
import { hasCompletePricing } from '../features/shop/cart'
import {
  CHECKOUT_EMPTY_CART_MESSAGE,
  CHECKOUT_PRICING_PENDING_MESSAGE,
  hasCustomerInfoErrors,
  prepareCheckoutDraft,
  validateCustomerInfo,
  type CustomerInfoErrors,
} from '../features/shop/checkout'
import { fetchPaymentConfig } from '../features/payments/checkoutClient'
import { isCheckoutAvailable, startStripeCheckout } from '../features/payments/checkoutFlow'
import type { PaymentConfigResponse } from '../features/payments/paymentTypes'
import { formatPriceCents, PRICE_NOT_ANNOUNCED } from '../features/shop/price'
import { getVariantAttributes } from '../features/shop/productTypes'
import { ShopFooter, ShopHeader } from '../features/shop/components/ShopShell'
import '../features/shop/shop.css'

const TITLE = 'Commande — Boutique TAGGO'
const DESCRIPTION = 'Récapitulatif de votre commande TAGGO avant paiement.'

/**
 * Checkout AVANT REDIRECTION STRIPE (étape 9).
 *
 * Le bouton n'appelle aucun fournisseur de paiement depuis le navigateur : il
 * demande au serveur une Checkout Session et suit l'URL renvoyée par Stripe.
 * Le panier ne transite QUE sous forme de `variantId` + `quantity` : le prix,
 * le sous-total et la commande sont calculés côté serveur.
 *
 * Tant qu'aucun prix officiel n'est publié, le serveur déclare le paiement
 * indisponible : aucun montant n'est inventé et le bouton reste bloqué.
 */
export function CheckoutPage() {
  const { user, loading: authLoading } = useAuth()
  const { lines, subtotalCents, clear } = useCart()
  const pricingComplete = hasCompletePricing(lines)

  usePageSeo({
    title: TITLE,
    description: DESCRIPTION,
    canonicalPath: '/checkout',
    noindex: true,
  })

  const [customer, setCustomer] = useState({ firstName: '', lastName: '', email: '' })
  const [errors, setErrors] = useState<CustomerInfoErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigResponse | null>(null)

  const checkoutAvailable = isCheckoutAvailable(paymentConfig)

  useEffect(() => {
    let active = true
    fetchPaymentConfig().then((config) => {
      if (active) setPaymentConfig(config)
    })
    return () => {
      active = false
    }
  }, [])

  if (lines.length === 0) {
    return (
      <div className="shop-page">
        <ShopHeader />
        <main className="shop-main">
          <Container size="sm">
            <Section spacing="md">
              <EmptyState
                title={CHECKOUT_EMPTY_CART_MESSAGE}
                description="Ajoutez un article à votre panier pour accéder au récapitulatif de commande."
                action={
                  <Link className="taggo-button taggo-button--primary" to="/shop">
                    Voir la boutique
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const validationErrors = validateCustomerInfo(customer)
    setErrors(validationErrors)
    if (hasCustomerInfoErrors(validationErrors)) {
      setFormError('Vérifiez les informations client avant de continuer.')
      return
    }

    const prepared = prepareCheckoutDraft(lines, customer)
    if ('error' in prepared) {
      setFormError(prepared.error)
      return
    }

    if (!user) {
      setFormError('Connectez-vous pour créer votre commande : votre panier est conservé.')
      return
    }

    setSubmitting(true)
    try {
      // Le serveur recrée la commande, la tarifie et crée la session Stripe.
      const result = await startStripeCheckout(lines)
      if (!result.ok) {
        setFormError(result.message)
        return
      }
      clear()
      window.location.assign(result.redirectUrl)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="shop-page">
      <ShopHeader />

      <main className="shop-main">
        <Container size="md">
          <Section spacing="md" className="shop-checkout">
            <h1>Récapitulatif de commande</h1>

            <div className="shop-checkout__layout">
              <Card as="section" className="shop-checkout__form-card" aria-labelledby="checkout-customer-heading">
                <h2 id="checkout-customer-heading">Informations client</h2>
                <p className="shop-checkout__hint">
                  Les informations de livraison seront demandées au moment de la livraison.
                </p>

                <form
                  className="shop-checkout__form"
                  aria-label="Informations client"
                  onSubmit={handleSubmit}
                  noValidate
                >
                  <TextField
                    id="checkout-first-name"
                    label="Prénom"
                    name="firstName"
                    autoComplete="given-name"
                    value={customer.firstName}
                    error={errors.firstName}
                    onChange={(event) =>
                      setCustomer((current) => ({ ...current, firstName: event.target.value }))
                    }
                  />
                  <TextField
                    id="checkout-last-name"
                    label="Nom"
                    name="lastName"
                    autoComplete="family-name"
                    value={customer.lastName}
                    error={errors.lastName}
                    onChange={(event) =>
                      setCustomer((current) => ({ ...current, lastName: event.target.value }))
                    }
                  />
                  <TextField
                    id="checkout-email"
                    label="Email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={customer.email}
                    error={errors.email}
                    onChange={(event) =>
                      setCustomer((current) => ({ ...current, email: event.target.value }))
                    }
                  />

                  {formError ? (
                    <p className="shop-checkout__error" role="alert">
                      {formError}
                    </p>
                  ) : null}

                  {!user && !authLoading ? (
                    <p className="shop-checkout__auth-hint">
                      La création d’une commande nécessite un compte TAGGO (
                      <Link to="/login">connexion</Link>). Votre panier reste enregistré sur cet
                      appareil.
                    </p>
                  ) : null}

                  {!pricingComplete ? (
                    <Alert type="info">{CHECKOUT_PRICING_PENDING_MESSAGE}</Alert>
                  ) : null}

                  <Button
                    type="submit"
                    loading={submitting}
                    disabled={submitting || !pricingComplete || !checkoutAvailable}
                  >
                    Payer avec Stripe (test)
                  </Button>
                  <p className="shop-checkout__note">
                    {checkoutAvailable
                      ? 'Vous allez être redirigé vers Stripe (mode test). Le montant est recalculé par nos serveurs avant tout débit.'
                      : 'Le paiement ouvrira dès la publication des prix officiels TAGGO.'}
                  </p>
                </form>
              </Card>

              <Card as="section" className="shop-checkout__summary" aria-labelledby="checkout-summary-heading">
                <h2 id="checkout-summary-heading">Votre commande</h2>
                <ul className="shop-checkout__lines">
                  {lines.map((line) => {
                    const attributes = getVariantAttributes(line.variant)
                    return (
                      <li key={line.lineId} className="shop-checkout__line">
                        <div>
                          <p className="shop-checkout__line-name">{line.product.name}</p>
                          <p className="shop-checkout__line-variant">
                            {attributes.length > 0 ? attributes.join(' · ') : 'Variante de référence'}
                          </p>
                          <p className="shop-checkout__line-quantity">
                            Quantité : {line.quantity}
                          </p>
                        </div>
                        <p className="shop-checkout__line-price">
                          {line.lineTotalCents === null
                            ? PRICE_NOT_ANNOUNCED
                            : formatPriceCents(line.lineTotalCents)}
                        </p>
                      </li>
                    )
                  })}
                </ul>

                <div className="shop-checkout__total">
                  <span>Sous-total</span>
                  <strong>{subtotalCents === null ? PRICE_NOT_ANNOUNCED : formatPriceCents(subtotalCents)}</strong>
                </div>
                <p className="shop-checkout__note">
                  {subtotalCents === null
                    ? 'Aucun montant n’est affiché tant que les prix officiels TAGGO ne sont pas publiés.'
                    : 'Livraison et taxes non définies à ce stade : aucun montant supplémentaire n’est facturé.'}
                </p>
                <Link className="taggo-button taggo-button--ghost" to="/cart">
                  Modifier le panier
                </Link>
              </Card>
            </div>
          </Section>
        </Container>
      </main>

      <ShopFooter />
    </div>
  )
}