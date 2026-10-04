import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingHeader.css'

export type HeaderLink = {
  label: string
  /** `#anchor` renders an in-page link, anything else a router link. */
  href: string
}

const NAV_LINKS: HeaderLink[] = [
  { label: 'Concept', href: '#concept' },
  { label: 'Comment ça marche', href: '#how-it-works' },
  { label: 'Personnalisation', href: '#customization' },
  { label: 'Sécurité', href: '#security' },
  { label: 'FAQ', href: '#faq' },
]

const DEFAULT_CTA: HeaderLink = { label: 'Créer mon TAGGO', href: '/register' }

type LandingHeaderProps = {
  links?: HeaderLink[]
  cta?: HeaderLink
  /** Optional cart badge (shop pages). */
  cartCount?: number
}

function isAnchorLink(href: string): boolean {
  return href.startsWith('#')
}

function HeaderNavItem({
  link,
  className,
  onClick,
  badge,
}: {
  link: HeaderLink
  className: string
  onClick?: () => void
  badge?: number
}) {
  const content = (
    <>
      {link.label}
      {badge !== undefined && badge > 0 ? (
        <>
          <span className="taggo-landing-header__badge" aria-hidden="true">
            {badge}
          </span>
          <span className="visually-hidden">
            , {badge} {badge > 1 ? 'articles' : 'article'} au panier
          </span>
        </>
      ) : null}
    </>
  )

  return isAnchorLink(link.href) ? (
    <a href={link.href} className={className} onClick={onClick}>
      {content}
    </a>
  ) : (
    <Link to={link.href} className={className} onClick={onClick}>
      {content}
    </Link>
  )
}

/**
 * TAGGO Landing Header — sticky, minimal, premium.
 * Collapses to a hamburger menu on mobile.
 *
 * The shop reuses this component with its own links/CTA so both surfaces share
 * exactly the same navigation and visual identity.
 */
export function LandingHeader({ links = NAV_LINKS, cta = DEFAULT_CTA, cartCount }: LandingHeaderProps) {
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
            src={`${import.meta.env.BASE_URL}logo/monogram.svg`}
            alt=""
            className="taggo-landing-header__logo-img taggo-landing-header__logo-img--mobile"
            width="40"
            height="40"
          />
          <img
            src={`${import.meta.env.BASE_URL}logo/wordgram.svg`}
            alt=""
            className="taggo-landing-header__logo-img taggo-landing-header__logo-img--desktop"
            height="36"
          />
        </Link>

        <nav
          className="taggo-landing-header__nav"
          aria-label="Navigation principale"
        >
          {links.map((link) => (
            <HeaderNavItem
              key={link.href + link.label}
              link={link}
              className="taggo-landing-header__nav-link"
              badge={link.href === '/cart' ? cartCount : undefined}
            />
          ))}
        </nav>

        <div className="taggo-landing-header__actions">
          <Link
            to={cta.href}
            className="taggo-button taggo-button--primary taggo-landing-header__cta"
          >
            {cta.label}
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
          {links.map((link) => (
            <HeaderNavItem
              key={link.href + link.label}
              link={link}
              className="taggo-landing-header__mobile-link"
              onClick={closeMenu}
              badge={link.href === '/cart' ? cartCount : undefined}
            />
          ))}
          <Link
            to={cta.href}
            className="taggo-button taggo-button--primary taggo-landing-header__mobile-cta"
            onClick={closeMenu}
          >
            {cta.label}
          </Link>
        </nav>
      </div>
    </header>
  )
}
