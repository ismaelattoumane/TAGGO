import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDemoQrs } from '../lib/demoData'
import { CopyButton } from '../components/CopyButton'

export function DashboardPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [qrList, setQrList] = useState(getDemoQrs())
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'inactive' | 'archived'>('all')

  useEffect(() => {
    setQrList(getDemoQrs())
  }, [])

  const filteredQrList = filter === 'all' ? qrList : qrList.filter((qr) => qr.status === filter)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getPublicQrUrl = (publicId: string) => {
    const baseUrl = window.location.origin
    return `${baseUrl}/qr/${publicId}`
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">TAGGO</span>
        </div>

        <nav className="nav">
          <a href="/dashboard" className="nav-item active">Dashboard</a>
          <a href="/dashboard/qr" className="nav-item">QR Codes</a>
          <a href="/dashboard/settings" className="nav-item">Paramètres</a>
        </nav>

        <button type="button" className="ghost-button" onClick={handleSignOut} style={{ marginTop: '1.5rem' }}>
          Déconnexion
        </button>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Tableau de bord</p>
            <h1>Mes QR TAGGO</h1>
            <p style={{ marginTop: '0.5rem', color: '#6d597a' }}>Connecté en tant que {user?.email ?? 'Utilisateur'}</p>
          </div>
          <a href="/dashboard/qr/new" className="primary-button" style={{ textDecoration: 'none', display: 'inline-block' }}>Créer un QR</a>
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
            <strong>Essai</strong>
          </article>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h2>Liste des QR</h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="all">Tous</option>
                <option value="active">Actifs</option>
                <option value="draft">Brouillon</option>
                <option value="inactive">Inactifs</option>
                <option value="archived">Archivés</option>
              </select>
            </div>
          </div>

          <div className="table-list">
            {filteredQrList.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
                <p>Aucun QR code trouvé</p>
                <a href="/dashboard/qr/new" className="primary-button" style={{ marginTop: '1rem', textDecoration: 'none', display: 'inline-block' }}>
                  Créer le premier
                </a>
              </div>
            ) : (
              filteredQrList.map((qr) => (
                <article key={qr.id} className="qr-row" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p className="qr-id">{qr.id}</p>
                      <h3>{qr.title}</h3>
                    </div>
                    <div className="pill-row">
                      <span className={`status-pill ${qr.status}`}>{qr.status}</span>
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
                    <a href={`/dashboard/qr/${qr.id}`} className="link-button">
                      Éditer
                    </a>
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
