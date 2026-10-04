import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext'
import { CartProvider } from '../context/CartContext'
import { DEMO_USER_IDS, clearLocalAuthSession, saveLocalAuthSession } from '../lib/demoAuth'
import { addToCart, EMPTY_CART } from '../features/shop/cart'
import { writeCartState } from '../features/shop/cartStorage'
import { PRICE_NOT_ANNOUNCED } from '../features/shop/price'
import { ShopPage } from './ShopPage'
import { ProductPage } from './ProductPage'
import { CartPage } from './CartPage'
import { CheckoutPage } from './CheckoutPage'
import { CheckoutSuccessPage } from './CheckoutSuccessPage'
import { CheckoutCancelPage } from './CheckoutCancelPage'

const TSHIRT_VARIANT = 'tshirt-taggo--default'

/** Renders the requested shop route inside the real app providers. */
function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/shop" element={<ShopPage />} />
      <Route path="/shop/:slug" element={<ProductPage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
      <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />
    </Routes>
  )
}

function setQuantityField(value: number) {
  fireEvent.change(screen.getByLabelText('Quantité'), { target: { value: String(value) } })
}

function fillCustomerForm() {
  fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Alex' } })
  fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Martin' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } })
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ShopPage', () => {
  it('lists the TAGGO products with price and CTA, without authentication', async () => {
    renderApp('/shop')

    expect(await screen.findByRole('heading', { name: 'Les vêtements TAGGO' })).toBeInTheDocument()
    expect(screen.getByText('T-shirt TAGGO')).toBeInTheDocument()
    expect(screen.getByText('Hoodie TAGGO')).toBeInTheDocument()
    expect(screen.getAllByText(PRICE_NOT_ANNOUNCED).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\d+,\d\d\s*€/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Voir le produit/ }).length).toBeGreaterThan(0)
  })

  it('exposes an indexable page title and canonical URL', async () => {
    renderApp('/shop')

    await screen.findByRole('heading', { name: 'Les vêtements TAGGO' })
    expect(document.title).toBe('Boutique TAGGO — T-shirt et hoodie connectés')
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow')
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      `${window.location.origin}/shop`,
    )
  })
})

describe('ProductPage', () => {
  it('presents the product, its price and the TAGGO explanation', async () => {
    renderApp('/shop/tshirt-taggo')

    expect(await screen.findByRole('heading', { level: 1, name: 'T-shirt TAGGO' })).toBeInTheDocument()
    expect(screen.getByText(PRICE_NOT_ANNOUNCED)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Le TAGGO inclus' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter au panier' })).toBeEnabled()
  })

  it('adds the selected quantity to the cart and opens the cart page', async () => {
    renderApp('/shop/tshirt-taggo')

    setQuantityField(2)
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au panier' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Panier' })).toBeInTheDocument()
    expect(screen.getByText('2 articles')).toBeInTheDocument()
    expect(screen.getByText('Prix non encore publié')).toBeInTheDocument()
  })

  it('shows a not-found state for an unknown slug', async () => {
    renderApp('/shop/casquette-taggo')
    expect(await screen.findByText('Produit introuvable')).toBeInTheDocument()
  })

  it('does not offer to order a product that is not produced yet', async () => {
    renderApp('/shop/hoodie-taggo')
    expect(await screen.findByRole('button', { name: 'Bientôt disponible' })).toBeDisabled()
  })
})

describe('CartPage', () => {
  it('shows an empty state when the cart is empty', async () => {
    renderApp('/cart')
    expect(await screen.findByText('Votre panier est vide')).toBeInTheDocument()
  })

  it('renders the lines, the subtotal and the actions', async () => {
    writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 2))
    renderApp('/cart')

    expect(await screen.findByRole('heading', { level: 1, name: 'Panier' })).toBeInTheDocument()
    const line = screen.getByRole('link', { name: 'T-shirt TAGGO' }).closest('li')
    expect(line).not.toBeNull()
    expect(within(line as HTMLElement).getByLabelText('Quantité')).toHaveValue(2)
    expect(screen.getByText('Sous-total')).toBeInTheDocument()
    expect(screen.getAllByText(PRICE_NOT_ANNOUNCED).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\d+,\d\d\s*€/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Passer la commande' })).toHaveAttribute('href', '/checkout')
    expect(screen.getByRole('link', { name: 'Continuer mes achats' })).toHaveAttribute('href', '/shop')
  })

  it('removes a line from the cart', async () => {
    writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
    renderApp('/cart')

    fireEvent.click(await screen.findByRole('button', { name: /Supprimer T-shirt TAGGO/ }))
    expect(await screen.findByText('Votre panier est vide')).toBeInTheDocument()
  })

  it('updates a line quantity from the cart', async () => {
    writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
    renderApp('/cart')

    setQuantityField(3)
    await waitFor(() => {
      expect(screen.getByText('3 articles')).toBeInTheDocument()
    })
  })

  it('keeps the cart out of the index', async () => {
    writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
    renderApp('/cart')
    await screen.findByRole('heading', { level: 1, name: 'Panier' })
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    )
  })
})

describe('CheckoutPage', () => {
  it('refuses an empty cart', async () => {
    renderApp('/checkout')
    expect(await screen.findByText('Votre panier est vide.')).toBeInTheDocument()
  })

  it('summarises the order and reports invalid customer data', async () => {
    writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
    renderApp('/checkout')

    expect(await screen.findByRole('heading', { name: 'Récapitulatif de commande' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'pas-un-email' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Informations client' }))

    expect(await screen.findByText('Le prénom est requis.')).toBeInTheDocument()
    expect(screen.getByText('Cette adresse email n’est pas valide.')).toBeInTheDocument()
  })

  it('never quotes an invented amount and blocks the order until prices exist', async () => {
    saveLocalAuthSession({ id: DEMO_USER_IDS.demo, email: 'demo@taggo.local', fullName: 'Demo User' })
    writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
    renderApp('/checkout')

    expect(await screen.findByText('Sous-total')).toBeInTheDocument()
    expect(screen.getAllByText(PRICE_NOT_ANNOUNCED).length).toBeGreaterThan(0)
    expect(screen.queryByText(/\d+,\d\d\s*€/)).not.toBeInTheDocument()

    // Étape 9 : sans prix officiels, le serveur déclare le paiement indisponible
    // et le bouton de redirection Stripe reste bloqué.
    const cta = screen.getByRole('button', { name: 'Payer avec Stripe (test)' })
    expect(cta).toBeDisabled()
    expect(screen.getByText(/Les prix des produits TAGGO ne sont pas encore publiés/)).toBeInTheDocument()

    fillCustomerForm()
    fireEvent.submit(screen.getByRole('form', { name: 'Informations client' }))

    expect(await screen.findByRole('heading', { name: 'Récapitulatif de commande' })).toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('taggo-demo-orders') ?? '[]')).toHaveLength(0)
    expect(JSON.parse(window.localStorage.getItem('taggo-demo-order-items') ?? '[]')).toHaveLength(0)
  })

  it('requires a TAGGO account to order, for a connected customer', async () => {
    clearLocalAuthSession()
    writeCartState(addToCart(EMPTY_CART, 'tshirt-taggo', TSHIRT_VARIANT, 1))
    renderApp('/checkout')

    expect(await screen.findByText(/nécessite un compte TAGGO/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'connexion' })).toHaveAttribute('href', '/login')
  })

  it('keeps the checkout out of the index', async () => {
    renderApp('/checkout')
    expect(await screen.findByText('Votre panier est vide.')).toBeInTheDocument()
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    )
  })
})

describe('retour de Stripe (étape 9)', () => {
  it('n’affiche aucun statut de commande payée après le retour Stripe', async () => {
    renderApp('/checkout/success?session_id=cs_test_123')

    expect(await screen.findByRole('heading', { name: 'Paiement envoyé à Stripe' })).toBeInTheDocument()
    expect(screen.getByText('cs_test_123')).toBeInTheDocument()
    expect(screen.queryByText(/commande payée/i)).not.toBeInTheDocument()
    expect(screen.queryByText('paid')).not.toBeInTheDocument()
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    )
  })

  it('reste muet sur le métier en cas d’annulation', async () => {
    renderApp('/checkout/cancel?session_id=cs_test_456')

    expect(await screen.findByRole('heading', { name: 'Paiement annulé' })).toBeInTheDocument()
    expect(screen.getByText('cs_test_456')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour au panier' })).toHaveAttribute('href', '/cart')
    expect(screen.queryByText('paid')).not.toBeInTheDocument()
  })
})
