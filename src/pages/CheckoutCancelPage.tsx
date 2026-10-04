import { Link, useSearchParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Card } from '../components/ui/Card/Card'
import { Container, Section } from '../components/ui/Layout/Layout'
import { usePageSeo } from '../lib/usePageSeo'
import { ShopFooter, ShopHeader } from '../features/shop/components/ShopShell'
import '../features/shop/shop.css'

const TITLE = 'Paiement annulé — TAGGO'
const DESCRIPTION = 'Retour de Stripe après l’annulation d’un paiement TAGGO.'

/**
 * Annulation côté navigateur (étape 9).
 *
 * Aucune commande n'est marquée payée, aucun TAGGO n'est réservé : la commande
 * reste en attente de paiement et le panier est conservé pour être rejoué.
 */
export function CheckoutCancelPage() {
  usePageSeo({ title: TITLE, description: DESCRIPTION, canonicalPath: '/checkout/cancel', noindex: true })
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-main">
        <Container size="sm">
          <Section spacing="md">
            <Card as="section" className="shop-checkout__success">
              <h1>Paiement annulé</h1>
              <Alert type="warning">
                Aucun montant n’a été débité. Votre commande reste en attente de paiement et
                aucun TAGGO n’a été réservé.
              </Alert>
              <p className="shop-checkout__status">
                Session annulée : <strong>{sessionId ?? 'non renseignée'}</strong>
              </p>
              <div className="shop-checkout__actions">
                <Link className="taggo-button taggo-button--primary" to="/cart">
                  Retour au panier
                </Link>
                <Link className="taggo-button taggo-button--ghost" to="/shop">
                  Voir la boutique
                </Link>
              </div>
            </Card>
          </Section>
        </Container>
      </main>
      <ShopFooter />
    </div>
  )
}
