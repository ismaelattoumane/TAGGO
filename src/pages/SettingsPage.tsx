import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/dashboard')
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
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div>
                <p style={{ color: '#6d597a', marginBottom: '0.25rem' }}>Nom affiché</p>
                <div className="auth-form">
                  <input value={user?.fullName || ''} readOnly placeholder="Nom visible sur la page publique" />
                </div>
              </div>
              <div>
                <p style={{ color: '#6d597a', marginBottom: '0.25rem' }}>Headline</p>
                <input value="Collection TAGGO" readOnly />
              </div>
              <div>
                <p style={{ color: '#6d597a', marginBottom: '0.25rem' }}>Bio</p>
                <input value="Page publique de marque connectée." readOnly />
              </div>
            </div>
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
            <p style={{ color: '#6d597a' }}>La gestion complète de l’abonnement arrive dans la prochaine étape du MVP. Le statut actuel reste visible côté Supabase selon le schéma existant.</p>
            <div style={{ marginTop: '1rem', display: 'inline-flex', padding: '0.55rem 0.9rem', borderRadius: '999px', background: 'rgba(76, 201, 240, 0.12)', color: '#0b1320', fontWeight: 700 }}>
              Statut : à venir
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
