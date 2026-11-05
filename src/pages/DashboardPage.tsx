import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { qrRepository } from '../features/qr/repository'
import type { QrRecord } from '../features/qr/qrTypes'
import { CopyButton } from '../components/CopyButton'
import { Badge } from '../components/ui/Badge/Badge'
import { EmptyState } from '../components/ui/State/State'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { SelectField } from '../components/ui/Field/Field'
import { TaggoWordmark } from '../features/landing/TaggoWordmark'
import { usePageSeo } from '../lib/usePageSeo'

const statusLabels: Record<QrRecord['status'], string> = {
  active: 'Actif',
  inactive: 'Inactif',
  draft: 'Brouillon',
  archived: 'Archivé',
}

export function DashboardPage() {
  usePageSeo({ title: 'Tableau de bord — TAGGO', description: 'Tableau de bord de votre compte TAGGO : vos vêtements connectés et vos QR codes.', noindex: true })
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [qrList, setQrList] = useState<QrRecord[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'inactive' | 'archived'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setQrList(await qrRepository.list(user?.id))
      } catch {
        setLoadError('Impossible de charger vos TAGGO pour le moment.')
      } finally {
        setLoading(false)
      }
    }
    if (user) {
      void load()
    }
  }, [user])

  const normalizedSearch = search.trim().toLowerCase()
  const filteredQrList = qrList.filter((qr) => {
    const matchesFilter = filter === 'all' || qr.status === filter
    const matchesSearch = !normalizedSearch
      || [qr.title, qr.publicId, qr.destinationUrl].some((value) => value.toLowerCase().includes(normalizedSearch))
    return matchesFilter && matchesSearch
  })

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', exact: true },
    { href: '/dashboard/qr/new', label: 'QR Codes' },
    { href: '/activate', label: 'Activer un TAGGO' },
    { href: '/shop', label: 'Boutique' },
    { href: '/cart', label: 'Panier' },
    { href: '/dashboard/settings', label: 'Paramètres' },
  ]

  const isNavItemActive = (href: string, exact = false) => (
    exact ? location.pathname === href : location.pathname.startsWith(href)
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getPublicQrUrl = (publicId: string) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/t/${publicId}`
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
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`nav-item${isNavItemActive(item.href, item.exact) ? ' active' : ''}`}
              aria-current={isNavItemActive(item.href, item.exact) ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button type="button" className="ghost-button sidebar-sign-out" onClick={handleSignOut}>
          Déconnexion
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <Eyebrow>Tableau de bord</Eyebrow>
            <h1>Mes QR TAGGO</h1>
            <p className="topbar-subtitle">
              {profile?.displayName ? `${profile.displayName} · ` : ''}
              {user?.email ?? 'Utilisateur'}
            </p>
          </div>
          <Link to="/dashboard/qr/new" className="primary-button">Créer un TAGGO</Link>
        </header>

        <div className="stats-grid">
          <article className="stat-card">
            <span>TAGGO actifs</span>
            <strong>{qrList.filter((qr) => qr.status === 'active').length}</strong>
          </article>
          <article className="stat-card">
            <span>TAGGO inactifs</span>
            <strong>{qrList.filter((qr) => qr.status === 'inactive').length}</strong>
          </article>
          <article className="stat-card">
            <span>Brouillons</span>
            <strong>{qrList.filter((qr) => qr.status === 'draft').length}</strong>
          </article>
          <article className="stat-card">
            <span>Total TAGGO</span>
            <strong>{qrList.length}</strong>
          </article>
        </div>

        <section className="quick-actions" aria-labelledby="quick-actions-title">
          <div>
            <p className="eyebrow">Accès rapide</p>
            <h2 id="quick-actions-title">Gérer votre espace</h2>
          </div>
          <div className="quick-actions__links">
            <Link to="/dashboard/qr/new" className="quick-action">
              <strong>Créer un TAGGO</strong>
              <span>Ajouter un nouveau QR code</span>
            </Link>
            <Link to="/activate" className="quick-action">
              <strong>Activer un TAGGO</strong>
              <span>Lier un TAGGO à votre compte</span>
            </Link>
            <Link to="/shop" className="quick-action">
              <strong>Découvrir la boutique</strong>
              <span>Commander un nouveau produit</span>
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Votre collection</p>
              <h2 id="qr-list-title">Mes TAGGO</h2>
            </div>
            <div className="list-controls">
              <label className="search-control" htmlFor="qr-search">
                Rechercher
                <input
                  id="qr-search"
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nom, identifiant ou destination"
                />
              </label>
              <SelectField
                id="qr-status-filter"
                label="Filtrer par statut"
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
              >
                <option value="all">Tous</option>
                <option value="active">Actifs</option>
                <option value="draft">Brouillon</option>
                <option value="inactive">Inactifs</option>
                <option value="archived">Archivés</option>
              </SelectField>
            </div>
          </div>

          <div className="table-list" role="list" aria-labelledby="qr-list-title" aria-busy={loading}>
            {loading ? (
              <p role="status">Chargement de vos TAGGO...</p>
            ) : loadError ? (
              <p role="alert" className="form-error">{loadError}</p>
            ) : filteredQrList.length === 0 ? (
              <EmptyState
                title={search || filter !== 'all' ? 'Aucun résultat' : 'Aucun QR code trouvé'}
                description={search || filter !== 'all' ? 'Modifiez votre recherche ou votre filtre.' : 'Créez votre premier QR TAGGO pour commencer.'}
                action={
                  search || filter !== 'all' ? (
                    <button type="button" className="ghost-button" onClick={() => { setSearch(''); setFilter('all') }}>
                      Réinitialiser
                    </button>
                  ) : (
                    <Link to="/dashboard/qr/new" className="primary-button">
                      Créer le premier
                    </Link>
                  )
                }
              />
            ) : (
              filteredQrList.map((qr) => (
                <article key={qr.id} role="listitem" className="qr-row">
                  <div className="qr-row-header">
                    <div>
                      <p className="qr-id">{qr.publicId}</p>
                      <h3>{qr.title}</h3>
                    </div>
                    <div className="pill-row">
                      <Badge tone={qr.status}>{statusLabels[qr.status]}</Badge>
                    </div>
                  </div>

                  <div className="qr-destination">
                    <span>Destination</span>
                    <code>
                      {qr.destinationUrl || 'Destination non configurée'}
                    </code>
                  </div>

                  <div className="qr-row-actions">
                    <a
                      href={`/t/${qr.publicId}`}
                      className="link-button"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Voir la page
                    </a>
                    <Link to={`/dashboard/qr/${qr.id}`} className="link-button">
                      Configurer
                    </Link>
                    <CopyButton text={getPublicQrUrl(qr.publicId)} label="Copier lien" />
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </section>
    </main>
  )
}
