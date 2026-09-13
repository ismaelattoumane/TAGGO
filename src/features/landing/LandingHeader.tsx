import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingHeader.css'

const NAV_LINKS = [
  { label: 'Concept', href: '#concept' },
  { label: 'Comment ça marche', href: '#how-it-works' },
  { label: 'Personnalisation', href: '#customization' },
  { label: 'Sécurité', href: '#security' },
  { label: 'FAQ', href: '#faq' },
]

/**
 * TAGGO Landing Header — sticky, minimal, premium.
 * Collapses to a hamburger menu on mobile.
 */
export function LandingHeader() {
  const [open, setOpen] = useState(false)

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const closeMenu = () => setOpen(false)

  return (
    <header className="taggo-landing-header">
      <div className="taggo-landing-header__inner">
        <Link to="/" className="taggo-landing-header__logo" aria-label="TAGGO — Accueil">
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            className="taggo-landing-header__logo-img taggo-landing-header__logo-img--mobile"
            width="40"
            height="40"
          />
          <img
            src={`${import.meta.env.BASE_URL}favicon.svg`}
            alt=""
            className="taggo-landing-header__logo-img taggo-landing-header__logo-img--desktop"
            width="32"
            height="31"
          />
          <span className="taggo-landing-header__logo-name">TAGGO</span>
        </Link>

        <nav
          className="taggo-landing-header__nav"
          aria-label="Navigation principale"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="taggo-landing-header__nav-link"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="taggo-landing-header__actions">
          <Link
            to="/register"
            className="taggo-button taggo-button--primary taggo-landing-header__cta"
          >
            Créer mon TAGGO
          </Link>
        </div>

        <button
          type="button"
          className="taggo-landing-header__burger"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          aria-controls="taggo-mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="taggo-landing-header__burger-bar" aria-hidden="true" />
          <span className="taggo-landing-header__burger-bar" aria-hidden="true" />
          <span className="taggo-landing-header__burger-bar" aria-hidden="true" />
        </button>
      </div>

      {/* Mobile nav panel */}
      <div
        id="taggo-mobile-nav"
        className={`taggo-landing-header__mobile${open ? ' taggo-landing-header__mobile--open' : ''}`}
        aria-hidden={!open}
      >
        <nav aria-label="Navigation mobile">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="taggo-landing-header__mobile-link"
              onClick={closeMenu}
            >
              {link.label}
            </a>
          ))}
          <Link
            to="/register"
            className="taggo-button taggo-button--primary taggo-landing-header__mobile-cta"
            onClick={closeMenu}
          >
            Créer mon TAGGO
          </Link>
        </nav>
      </div>
    </header>
  )
}
