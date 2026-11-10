import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TaggoWordmark } from '../features/landing/TaggoWordmark'
import '../styles/dashboard.css'

type NavItem = { href: string; label: string; match?: (pathname: string) => boolean }

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Mes TAGGO', match: (p) => p === '/dashboard' || p.startsWith('/dashboard/qr') },
  { href: '/dashboard/orders', label: 'Mes commandes', match: (p) => p.startsWith('/dashboard/orders') },
  { href: '/activate', label: 'Activer un TAGGO', match: (p) => p.startsWith('/activate') },
  { href: '/shop', label: 'Boutique' },
  { href: '/cart', label: 'Panier' },
  { href: '/dashboard/settings', label: 'Paramètres', match: (p) => p.startsWith('/dashboard/settings') },
]

function getInitials(displayName?: string | null, email?: string | null) {
  const name = (displayName ?? '').trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? ''
    return (first + last).toUpperCase() || '?'
  }
  return (email?.trim()?.[0] ?? '?').toUpperCase()
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (item: NavItem) => (item.match ? item.match(pathname) : pathname === item.href)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const displayName = profile?.displayName || user?.email || 'Utilisateur'
  const email = user?.email ?? ''

  return (
    <main className={`dashboard-shell${menuOpen ? ' dashboard-shell--menu-open' : ''}`}>
      <div className="dash-mobilebar">
        <Link to="/dashboard" className="dashboard-brand" aria-label="TAGGO — Tableau de bord">
          <TaggoWordmark className="dashboard-brand__logo" title="TAGGO" />
        </Link>
        <button
          type="button"
          className="dash-burger"
          aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <aside className="sidebar">
        <div className="brand-block dash-brand-desktop">
          <Link to="/dashboard" className="dashboard-brand" aria-label="TAGGO — Tableau de bord">
            <TaggoWordmark className="dashboard-brand__logo" title="TAGGO" />
          </Link>
        </div>

        <nav className="nav" aria-label="Navigation principale">
          {navItems.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="dash-user">
          <span className="dash-avatar" aria-hidden="true">{getInitials(profile?.displayName, user?.email)}</span>
          <span className="dash-user__text">
            <strong>{displayName}</strong>
            {email ? <small>{email}</small> : null}
          </span>
        </div>

        <button type="button" className="ghost-button sidebar-sign-out" onClick={handleSignOut}>
          Déconnexion
        </button>
      </aside>

      <section className="main-panel">{children}</section>
    </main>
  )
}
