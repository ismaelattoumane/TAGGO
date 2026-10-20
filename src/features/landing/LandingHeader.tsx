import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { TaggoWordmark } from './TaggoWordmark'
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

/** Distance (px) sous laquelle la section témoin déclenche l'apparition de l'en-tête. */
const REVEAL_OFFSET = 72

type LandingHeaderProps = {
  links?: HeaderLink[]
  cta?: HeaderLink
  /** Optional cart badge (shop pages). */
  cartCount?: number
  /**
   * `overlay` : en-tête fixe et sombre, posé sur le hero marine de la landing.
   * `default` : en-tête crème collant, utilisé par la boutique et les pages de contenu.
   */
  variant?: 'default' | 'overlay'
  /**
   * Identifiant de la section à partir de laquelle l'en-tête devient visible.
   * Sans valeur, l'en-tête est toujours visible (boutique, pages de contenu).
   */
  revealFromId?: string
  /**
   * Identifiant de la section qui masque l'en-tête tant qu'elle est affichée
   * (par défaut le hero de la landing).
   */
  hideWhileId?: string
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
export function LandingHeader({
  links = NAV_LINKS,
  cta = DEFAULT_CTA,
  cartCount,
  variant = 'default',
  revealFromId,
  hideWhileId,
}: LandingHeaderProps) {
  const [open, setOpen] = useState(false)
  const [reached, setReached] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const overlay = variant === 'overlay'

  // L'en-tête de la landing reste masqué tant que la section témoin n'est pas
  // atteinte : le hero marine reste dégagé, la navigation apparaît ensuite.
  // La position est lue au scroll (et non via un seuil d'intersection) pour
  // qu'un saut d'ancre vers une section plus basse affiche aussi la barre.
  useEffect(() => {
    if (!revealFromId) return
    const target = document.getElementById(revealFromId) ?? document.body
    const blocker = hideWhileId ? document.getElementById(hideWhileId) : null

    let frame = 0
    const update = (): void => {
      frame = 0
      setReached(target.getBoundingClientRect().top <= REVEAL_OFFSET)
      if (blocker) setBlocked(blocker.getBoundingClientRect().bottom > 0)
    }
    const schedule = (): void => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [revealFromId, hideWhileId])

  const hidden = Boolean(revealFromId) && (!reached || blocked)

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
    <header
      className={`taggo-landing-header${overlay ? ' taggo-landing-header--overlay' : ''}${
        hidden ? ' taggo-landing-header--hidden' : ''
      }`}
      inert={hidden || undefined}
    >
      <div className="taggo-landing-header__inner">
        <Link to="/" className="taggo-landing-header__logo" aria-label="TAGGO — Accueil">
          <TaggoWordmark className="taggo-landing-header__logo-mark" />
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
