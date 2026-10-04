import { Link } from 'react-router-dom'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { Container, Section } from '../components/ui/Layout/Layout'
import { EmptyState } from '../components/ui/State/State'
import { usePageSeo } from '../lib/usePageSeo'
import { listShopProducts } from '../features/shop/catalog'
import { ProductCard } from '../features/shop/components/ProductCard'
import { ShopFooter, ShopHeader } from '../features/shop/components/ShopShell'
import '../features/shop/shop.css'

const TITLE = 'Boutique TAGGO — T-shirt et hoodie connectés'
const DESCRIPTION =
  'Découvrez les produits TAGGO : un T-shirt connecté avec QR code TAGGO qui ouvre votre profil public personnalisable.'

/** Public shop catalogue — no authentication required. */
export function ShopPage() {
  usePageSeo({ title: TITLE, description: DESCRIPTION, canonicalPath: '/shop' })

  const products = listShopProducts()

  return (
    <div className="shop-page">
      <ShopHeader />

      <main className="shop-main">
        <Container size="lg">
          <Section spacing="md" className="shop-intro">
            <Eyebrow>Boutique TAGGO</Eyebrow>
            <h1>Les vêtements TAGGO</h1>
            <p className="shop-intro__lead">
              Chaque vêtement TAGGO porte un QR code unique qui ouvre votre page TAGGO
              personnalisable : un vêtement, un profil.
            </p>
            <p className="shop-intro__note">
              Tailles, couleurs et visuels de production seront précisés à l’ouverture des
              commandes.
            </p>
          </Section>

          <Section spacing="md" aria-label="Catalogue produits">
            {products.length === 0 ? (
              <EmptyState
                title="Aucun produit disponible"
                description="Le catalogue est vide pour le moment."
                action={
                  <Link className="taggo-button taggo-button--primary" to="/">
                    Retour à l'accueil
                  </Link>
                }
              />
            ) : (
              <ul className="shop-grid">
                {products.map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </Container>
      </main>

      <ShopFooter />
    </div>
  )
}