import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { goBackSafely } from '../lib/navigation'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleBack = () => {
    goBackSafely(navigate, '/dashboard')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="settings-shell">
      <section className="settings-card" style={{ maxWidth: 880, width: 'min(100%, 880px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <p className="eyebrow">Paramètres</p>
            <h1>Compte TAGGO</h1>
          </div>
          <button type="button" className="ghost-button" onClick={handleBack}>Retour</button>
        </div>

        <div style={{ display: 'grid', gap: '1.25rem' }}>
          <section style={{ border: '1px solid rgba(43,45,66,0.12)', borderRadius: '18px', padding: '1.25rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Compte</h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <p style={{ color: '#6d597a', marginBottom: '0.25rem' }}>Nom complet</p>
                <strong>{user?.fullName || 'Non renseigné'}</strong>
              </div>
              <div>
                <p style={{ color: '#6d597a', marginBottom: '0.25rem' }}>Email</p>
                <strong>{user?.email || 'Non disponible'}</strong>
              </div>
            </div>
          </section>

          <section style={{ border: '1px solid rgba(43,45,66,0.12)', borderRadius: '18px', padding: '1.25rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Profil</h2>
            <p style={{ color: '#6d597a' }}>La personnalisation du profil public sera disponible dans une prochaine étape.</p>
          </section>

          <section style={{ border: '1px solid rgba(43,45,66,0.12)', borderRadius: '18px', padding: '1.25rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Sécurité</h2>
            <p style={{ marginBottom: '1rem', color: '#6d597a' }}>Le changement de mot de passe est géré par Supabase lorsque le flux est activé côté back-office.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="ghost-button" onClick={handleSignOut}>Déconnexion</button>
            </div>
          </section>

          <section style={{ border: '1px solid rgba(43,45,66,0.12)', borderRadius: '18px', padding: '1.25rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Abonnement</h2>
            <p style={{ color: '#6d597a' }}>Aucune information d’abonnement n’est disponible pour le moment.</p>
          </section>
        </div>
      </section>
    </main>
  )
}
