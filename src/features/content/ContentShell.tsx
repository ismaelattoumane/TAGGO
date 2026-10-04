import { LandingFooter } from '../landing/LandingFooter'
import { LandingHeader } from '../landing/LandingHeader'

const CONTENT_LINKS = [
  { label: 'Accueil', href: '/' },
  { label: 'Boutique', href: '/shop' },
  { label: 'FAQ', href: '/faq' },
  { label: 'À propos', href: '/about' },
]

const CONTENT_CTA = { label: 'Créer mon TAGGO', href: '/register' }

/**
 * ÉTAPE 10 — En-tête des pages de contenu public.
 * Réutilise exactement le header du landing et de la boutique : une seule
 * identité visuelle sur tout le site.
 */
export function ContentHeader() {
  return <LandingHeader links={CONTENT_LINKS} cta={CONTENT_CTA} />
}

/** Footer commun : liens de contenu, mentions légales et gestion des cookies. */
export function ContentFooter() {
  return <LandingFooter navigation={CONTENT_LINKS} />
}