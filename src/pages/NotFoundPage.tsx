import { Link } from 'react-router-dom'
import { usePageSeo } from '../lib/usePageSeo'

export function NotFoundPage() {
  // Unknown URLs are rewritten to index.html by the SPA host (HTTP 200), so
  // this page must never be indexed: otherwise soft-404s flood the index.
  usePageSeo({
    title: 'Page non trouvée — TAGGO',
    description: 'La page demandée n’existe pas ou a été supprimée.',
    noindex: true,
  })

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

        <Link to="/login" className="primary-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
          Retourner à la connexion
        </Link>
      </section>
    </main>
  )
}