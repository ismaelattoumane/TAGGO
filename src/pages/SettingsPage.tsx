import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { goBackSafely } from '../lib/navigation'
import { isValidEmail, sanitizeText } from '../lib/validators'
import { usePageSeo } from '../lib/usePageSeo'

export function SettingsPage() {
  usePageSeo({ title: 'Paramètres du compte — TAGGO', description: 'Paramètres de votre compte TAGGO.', noindex: true })
  const { profile, profileLoading, updateProfile, requestEmailChange, mode, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [newEmail, setNewEmail] = useState('')

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.firstName)
    setLastName(profile.lastName)
    setDisplayName(profile.displayName)
  }, [profile])

  const handleBack = () => {
    goBackSafely(navigate, '/dashboard')
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const handleSaveProfile = async () => {
    const values = {
      firstName: sanitizeText(firstName).slice(0, 80),
      lastName: sanitizeText(lastName).slice(0, 80),
      displayName: sanitizeText(displayName).slice(0, 120),
    }
    if (!values.firstName || !values.lastName || !values.displayName) {
      setMessage('Veuillez renseigner le prénom, le nom et le nom d’affichage.')
      return
    }

    try {
      setSaving(true)
      setMessage('')
      await updateProfile(values)
      setMessage('Profil enregistré.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer le profil.')
    } finally {
      setSaving(false)
    }
  }

  const handleRequestEmailChange = async () => {
    const email = newEmail.trim()
    if (!isValidEmail(email)) {
      setMessage('Veuillez saisir une adresse email valide.')
      return
    }

    try {
      setSaving(true)
      setMessage('')
      await requestEmailChange(email)
      setNewEmail('')
      setMessage('Demande envoyée. Confirmez le changement avec les emails transmis par Supabase Auth.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de demander le changement d’adresse email.')
    } finally {
      setSaving(false)
    }
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
                <p style={{ color: '#6d597a', marginBottom: '0.25rem' }}>Nom d’affichage</p>
                <strong>{profile?.displayName || user?.fullName || 'Non renseigné'}</strong>
              </div>
              <div>
                <p style={{ color: '#6d597a', marginBottom: '0.25rem' }}>Email</p>
                <strong>{user?.email || 'Non disponible'}</strong>
              </div>
            </div>
          </section>

          <section style={{ border: '1px solid rgba(43,45,66,0.12)', borderRadius: '18px', padding: '1.25rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Profil</h2>
            <div className="auth-form">
              <label htmlFor="profile-first-name">
                Prénom
                <input id="profile-first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={profileLoading || saving} />
              </label>
              <label htmlFor="profile-last-name">
                Nom
                <input id="profile-last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={profileLoading || saving} />
              </label>
              <label htmlFor="profile-display-name">
                Nom d’affichage
                <input id="profile-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={profileLoading || saving} />
              </label>
              {message ? <p role="status" className="form-error">{message}</p> : null}
              <button type="button" className="primary-button" onClick={() => void handleSaveProfile()} disabled={profileLoading || saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
              </button>
            </div>
          </section>

          <section style={{ border: '1px solid rgba(43,45,66,0.12)', borderRadius: '18px', padding: '1.25rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Sécurité</h2>
            <p style={{ marginBottom: '1rem', color: '#6d597a' }}>Les changements d’adresse email sont confirmés par Supabase Auth avant leur prise en compte.</p>
            {mode === 'supabase' ? (
              <div className="auth-form" style={{ marginBottom: '1rem' }}>
                <label htmlFor="account-new-email">
                  Nouvelle adresse email
                  <input
                    id="account-new-email"
                    type="email"
                    autoComplete="email"
                    value={newEmail}
                    onChange={(event) => setNewEmail(event.target.value)}
                    disabled={saving}
                  />
                </label>
                <button type="button" className="ghost-button" onClick={() => void handleRequestEmailChange()} disabled={saving}>
                  {saving ? 'Envoi...' : 'Demander le changement'}
                </button>
              </div>
            ) : null}
            <p style={{ marginBottom: '1rem', color: '#6d597a' }}>Le changement de mot de passe est géré par Supabase lorsque le flux est activé côté back-office.</p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="ghost-button" onClick={handleSignOut}>Déconnexion</button>
            </div>
          </section>

          <section style={{ border: '1px solid rgba(43,45,66,0.12)', borderRadius: '18px', padding: '1.25rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>Abonnement</h2>
            <p style={{ color: '#6d597a' }}>
              L’abonnement(TAGGO est rattaché à chaque TAGGO, pas au compte : la
              première année est incluse avec l’achat, puis un renouvellement annuel
              est nécessaire. Le statut, les dates et le renouvellement automatique de
              chaque TAGGO sont affichés sur la page de ce TAGGO, dans votre tableau de
              bord.
            </p>
            <p style={{ color: '#6d597a', marginTop: '0.75rem' }}>
              Le tarif de renouvellement n’est pas encore défini : aucun renouvellement
              ne peut être effectué pour le moment.
            </p>
          </section>
        </div>
      </section>
    </main>
  )
}
