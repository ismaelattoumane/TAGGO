import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { TaggoWordmark } from '../features/landing/TaggoWordmark'

type NavItem = { href: string; label: string; match?: (pathname: string) => boolean }

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Mes TAGGO', match: (p) => p === '/dashboard' || p.startsWith('/dashboard/qr') },
  { href: '/dashboard/orders', label: 'Mes commandes', match: (p) => p.startsWith('/dashboard/orders') },
  { href: '/activate', label: 'Activer un TAGGO', match: (p) => p.startsWith('/activate') },
  { href: '/shop', label: 'Boutique' },
  { href: '/cart', label: 'Panier' },
  { href: '/dashboard/settings', label: 'Paramètres', match: (p) => p.startsWith('/dashboard/settings') },
]

/**
 * Coquille commune des pages du dashboard (sidebar + zone principale).
 * Extrait de DashboardPage pour être réutilisé par les commandes, etc.
 * L'état actif est calculé item par item : /dashboard/settings n'active
 * plus « Mes TAGGO ».
 */
export function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (item: NavItem) => (item.match ? item.match(pathname) : pathname === item.href)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
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
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <button type="button" className="ghost-button sidebar-sign-out" onClick={handleSignOut}>
          Déconnexion
        </button>
      </aside>

      <section className="main-panel">{children}</section>
    </main>
  )
}
