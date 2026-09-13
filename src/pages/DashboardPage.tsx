import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { qrRepository } from '../features/qr/repository'
import type { QrRecord } from '../features/qr/qrTypes'
import { CopyButton } from '../components/CopyButton'
import { Badge } from '../components/ui/Badge/Badge'
import { EmptyState } from '../components/ui/State/State'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { SelectField } from '../components/ui/Field/Field'

const statusLabels: Record<QrRecord['status'], string> = {
  active: 'Actif',
  inactive: 'Inactif',
  draft: 'Brouillon',
  archived: 'Archivé',
}

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [qrList, setQrList] = useState<QrRecord[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'inactive' | 'archived'>('all')
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

  const filteredQrList = filter === 'all' ? qrList : qrList.filter((qr) => qr.status === filter)

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
          <span className="brand-mark">TAGGO</span>
        </div>

        <nav className="nav" aria-label="Navigation principale">
          <Link to="/dashboard" className="nav-item active" aria-current="page">Dashboard</Link>
          <Link to="/dashboard/qr/new" className="nav-item">QR Codes</Link>
          <Link to="/dashboard/settings" className="nav-item">Paramètres</Link>
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
            <p className="topbar-subtitle">Connecté en tant que {user?.email ?? 'Utilisateur'}</p>
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
            <span>Total TAGGO</span>
            <strong>{qrList.length}</strong>
          </article>
        </div>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Votre collection</p>
              <h2 id="qr-list-title">Mes TAGGO</h2>
            </div>
            <div className="filter-control">
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
                title="Aucun QR code trouvé"
                description="Créez votre premier QR TAGGO pour commencer."
                action={
                  <Link
                    to="/dashboard/qr/new"
                    className="primary-button"
                    style={{ textDecoration: 'none', display: 'inline-block' }}
                  >
                    Créer le premier
                  </Link>
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
