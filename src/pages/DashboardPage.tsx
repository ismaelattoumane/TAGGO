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

        <button type="button" className="ghost-button" onClick={handleSignOut} style={{ marginTop: '1.5rem' }}>
          Déconnexion
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <Eyebrow>Tableau de bord</Eyebrow>
            <h1>Mes QR TAGGO</h1>
            <p style={{ marginTop: '0.5rem', color: '#6d597a' }}>Connecté en tant que {user?.email ?? 'Utilisateur'}</p>
          </div>
          <Link to="/dashboard/qr/new" className="primary-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Créer un QR</Link>
        </header>

        <div className="stats-grid">
          <article className="stat-card">
            <span>QR actifs</span>
            <strong>{qrList.filter((qr) => qr.status === 'active').length}</strong>
          </article>
          <article className="stat-card">
            <span>QR total</span>
            <strong>{qrList.length}</strong>
          </article>
          <article className="stat-card">
            <span>Abonnement</span>
            <strong>Bientôt disponible</strong>
          </article>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h2 id="qr-list-title">Liste des QR</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                <article key={qr.id} role="listitem" className="qr-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p className="qr-id">{qr.publicId}</p>
                      <h3>{qr.title}</h3>
                    </div>
                    <div className="pill-row">
                      <Badge tone={qr.status}>{qr.status}</Badge>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.875rem' }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ color: '#999', display: 'block', marginBottom: '0.25rem' }}>Lien public</span>
                      <code style={{ color: '#333', backgroundColor: '#f5f5f5', padding: '0.25rem 0.5rem', borderRadius: '3px', display: 'block', wordBreak: 'break-all' }}>
                        {getPublicQrUrl(qr.publicId)}
                      </code>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to={`/dashboard/qr/${qr.id}`} className="link-button">
                      Éditer
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
