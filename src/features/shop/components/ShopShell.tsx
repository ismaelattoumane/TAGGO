import { LandingFooter } from '../../landing/LandingFooter'
import { LandingHeader } from '../../landing/LandingHeader'
import { useCart } from '../../../context/CartContext'

const SHOP_LINKS = [
  { label: 'Accueil', href: '/' },
  { label: 'Boutique', href: '/shop' },
  { label: 'Panier', href: '/cart' },
]

const SHOP_CTA = { label: 'Créer mon TAGGO', href: '/register' }

/** Shop navigation — the landing header with shop links and a cart badge. */
export function ShopHeader() {
  const { itemCount } = useCart()

  return <LandingHeader links={SHOP_LINKS} cta={SHOP_CTA} cartCount={itemCount} />
}

/** Shop footer — same component as the landing page, with working routes. */
export function ShopFooter() {
  return <LandingFooter navigation={SHOP_LINKS} />
}