import { Link, useSearchParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { Card } from '../components/ui/Card/Card'
import { Container, Section } from '../components/ui/Layout/Layout'
import { usePageSeo } from '../lib/usePageSeo'
import { ShopFooter, ShopHeader } from '../features/shop/components/ShopShell'
import '../features/shop/shop.css'

const TITLE = 'Paiement TAGGO'
const DESCRIPTION = 'Retour de Stripe après votre paiement TAGGO.'

/**
 * Retour de Stripe Checkout (étape 9).
 *
 * Cette page ne DÉCLENCHE RIEN et ne DÉCLARE RIEN : elle n'affiche aucun
 * statut de commande. La validation du paiement, le passage à `paid` et
 * l'attribution des TAGGO sont des opérations STRICTEMENT serveur, déclenchées
 * par le webhook Stripe après vérification de la signature.
 *
 * Le navigateur ne peut donc pas faire semblant d'un paiement réussi : au
 * mieux il affiche un accusé de réception, jamais une confirmation métier.
 */
export function CheckoutSuccessPage() {
  usePageSeo({ title: TITLE, description: DESCRIPTION, canonicalPath: '/checkout/success', noindex: true })
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')

  return (
    <div className="shop-page">
      <ShopHeader />
      <main className="shop-main">
        <Container size="sm">
          <Section spacing="md">
            <Card as="section" className="shop-checkout__success">
              <h1>Paiement envoyé à Stripe</h1>
              <Alert type="info">
                La validation du paiement est en cours. Elle est confirmée par nos serveurs après
                vérification de la signature de l’événement Stripe : tant qu’elle n’est pas
                confirmée, aucune commande n’est marquée payée et aucun TAGGO n’est attribué.
              </Alert>
              <p className="shop-checkout__status">
                Référence de session : <strong>{sessionId ?? 'non renseignée'}</strong>
              </p>
              <p className="shop-checkout__note">
                Un TAGGO est attribué par exemplaire commandé, uniquement après confirmation du
                paiement côté serveur.
              </p>
              <Link className="taggo-button taggo-button--primary" to="/shop">
                Retour à la boutique
              </Link>
            </Card>
          </Section>
        </Container>
      </main>
      <ShopFooter />
    </div>
  )
}
