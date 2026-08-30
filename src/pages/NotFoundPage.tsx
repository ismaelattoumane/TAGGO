import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="auth-shell">
      <section className="auth-panel" style={{ textAlign: 'center' }}>
        <div className="brand-block">
          <span className="brand-mark">404</span>
          <h1>Page non trouvée</h1>
        </div>

        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          La page que vous cherchez n'existe pas ou a été supprimée.
        </p>

        <Link to="/dashboard" className="primary-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Retourner au dashboard
        </Link>
      </section>
    </main>
  )
}
