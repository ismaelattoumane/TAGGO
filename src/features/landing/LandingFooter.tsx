import { Link } from 'react-router-dom'
import './LandingFooter.css'

const NAVIGATION = [
  { label: 'Concept', href: '#concept' },
  { label: 'Comment ça marche', href: '#how-it-works' },
  { label: 'Personnalisation', href: '#customization' },
  { label: 'Sécurité', href: '#security' },
  { label: 'FAQ', href: '#faq' },
]

const ACCOUNT = [
  { label: 'Créer mon TAGGO', href: '/register' },
  { label: 'Connexion', href: '/login' },
]

const LEGAL = [
  { label: 'Confidentialité', href: '#' },
  { label: 'Conditions', href: '#' },
  { label: 'Mentions légales', href: '#' },
]

/**
 * TAGGO Landing Footer — premium, minimal, complete.
 */
export function LandingFooter() {
  return (
    <footer className="taggo-landing-footer">
      <div className="taggo-landing-footer__inner">
        <div className="taggo-landing-footer__brand">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            className="taggo-landing-footer__logo-img"
            width="34"
            height="33"
          />
          <span className="taggo-landing-footer__logo-name">TAGGO</span>
          <p className="taggo-landing-footer__tagline">
            Le T-shirt connecté. Ton identité. Ton monde.
          </p>
        </div>

        <div className="taggo-landing-footer__columns">
          <nav className="taggo-landing-footer__col" aria-label="Navigation">
            <p className="taggo-landing-footer__col-title">Navigation</p>
            {NAVIGATION.map((link) => (
              <a
                key={link.href + link.label}
                href={link.href}
                className="taggo-landing-footer__link"
              >
                {link.label}
              </a>
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

          <nav className="taggo-landing-footer__col" aria-label="Légal">
            <p className="taggo-landing-footer__col-title">Légal</p>
            {LEGAL.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="taggo-landing-footer__link"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </div>

      <div className="taggo-landing-footer__bottom">
        <p className="taggo-landing-footer__copyright">
          © {new Date().getFullYear()} TAGGO. Tous droits réservés.
        </p>
      </div>
    </footer>
  )
}
