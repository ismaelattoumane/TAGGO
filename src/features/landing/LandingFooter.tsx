import { Link } from 'react-router-dom'
import { CookieConsent } from '../cookies/CookieConsent'
import './LandingFooter.css'

export type FooterLink = {
  label: string
  /** `#anchor` renders an in-page link, anything else a router link. */
  href: string
}

const NAVIGATION: FooterLink[] = [
  { label: 'Concept', href: '#concept' },
  { label: 'Comment ça marche', href: '#how-it-works' },
  { label: 'Personnalisation', href: '#customization' },
  { label: 'Sécurité', href: '#security' },
  { label: 'FAQ', href: '#faq' },
]

const ACCOUNT: FooterLink[] = [
  { label: 'Créer mon TAGGO', href: '/register' },
  { label: 'Connexion', href: '/login' },
]

/**
 * Étape 10 — Liens publics de contenu et contacts.
 * Les réseaux sociaux ne sont volontairement pas listés : aucun compte officiel
 * TAGGO n'est encore défini, et aucun lien social n'est inventé.
 */
const TAGGO: FooterLink[] = [
  { label: 'À propos', href: '/about' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Livraison et retours', href: '/shipping' },
  { label: 'Contact', href: '/contact' },
]

const LEGAL: FooterLink[] = [
  { label: 'Mentions légales', href: '/legal/notice' },
  { label: 'CGV', href: '/legal/terms' },
  { label: 'Politique de confidentialité', href: '/legal/privacy' },
  { label: 'Cookies', href: '/legal/cookies' },
]

function isAnchorLink(href: string): boolean {
  return href.startsWith('#')
}

function FooterNavItem({ link }: { link: FooterLink }) {
  return isAnchorLink(link.href) ? (
    <a href={link.href} className="taggo-landing-footer__link">
      {link.label}
    </a>
  ) : (
    <Link to={link.href} className="taggo-landing-footer__link">
      {link.label}
    </Link>
  )
}

/**
 * TAGGO Landing Footer — premium, minimal, complete.
 * Shared with the shop so both surfaces keep the same visual identity.
 */
export function LandingFooter({ navigation = NAVIGATION }: { navigation?: FooterLink[] }) {
  return (
    <footer className="taggo-landing-footer">
      <div className="taggo-landing-footer__inner">
        <div className="taggo-landing-footer__brand">
          <img
            src={`${import.meta.env.BASE_URL}logo/logo.svg`}
            alt="TAGGO"
            className="taggo-landing-footer__logo-img"
            height="32"
          />
          <p className="taggo-landing-footer__tagline">
            Le T-shirt connecté. Ton identité. Ton monde.
          </p>
        </div>

        <div className="taggo-landing-footer__columns">
          <nav className="taggo-landing-footer__col" aria-label="Navigation">
            <p className="taggo-landing-footer__col-title">Navigation</p>
            {navigation.map((link) => (
              <FooterNavItem key={link.href + link.label} link={link} />
            ))}
          </nav>

          <nav className="taggo-landing-footer__col" aria-label="Compte">
            <p className="taggo-landing-footer__col-title">Compte</p>
            {ACCOUNT.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="taggo-landing-footer__link"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <nav className="taggo-landing-footer__col" aria-label="TAGGO">
            <p className="taggo-landing-footer__col-title">TAGGO</p>
            {TAGGO.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="taggo-landing-footer__link"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <nav className="taggo-landing-footer__col" aria-label="Légal">
            <p className="taggo-landing-footer__col-title">Légal</p>
            {LEGAL.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="taggo-landing-footer__link"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="taggo-landing-footer__bottom">
        <p className="taggo-landing-footer__copyright">
          © {new Date().getFullYear()} TAGGO. Tous droits réservés.
        </p>
        <CookieConsent />
      </div>
    </footer>
  )
}
