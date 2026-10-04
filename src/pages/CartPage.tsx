import { Container, Section } from '../components/ui/Layout/Layout'
import { usePageSeo } from '../lib/usePageSeo'
import { CartView } from '../features/shop/components/CartView'
import { ShopFooter, ShopHeader } from '../features/shop/components/ShopShell'
import '../features/shop/shop.css'

const TITLE = 'Mon panier — Boutique TAGGO'
const DESCRIPTION = 'Retrouvez les articles TAGGO sélectionnés dans votre panier.'

/** Cart page — public, localStorage backed, never reserved as an order. */
export function CartPage() {
  usePageSeo({
    title: TITLE,
    description: DESCRIPTION,
    canonicalPath: '/cart',
    noindex: true,
  })

  return (
    <div className="shop-page">
      <ShopHeader />

      <main className="shop-main">
        <Container size="md">
          <Section spacing="md">
            <CartView heading="Panier" />
          </Section>
        </Container>
      </main>

      <ShopFooter />
    </div>
  )
}