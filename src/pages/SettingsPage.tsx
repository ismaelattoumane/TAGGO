import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../components/DashboardLayout'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { useAuth } from '../context/AuthContext'
import { passwordUpdateErrorMessage } from '../features/auth/authErrors'
import { isValidEmail, isValidPassword, sanitizeText } from '../lib/validators'
import { usePageSeo } from '../lib/usePageSeo'

export function SettingsPage() {
  usePageSeo({ title: 'Paramètres du compte — TAGGO', description: 'Paramètres de votre compte TAGGO.', noindex: true })
  const { profile, profileLoading, updateProfile, requestEmailChange, updatePassword, mode, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  useEffect(() => {
    if (!profile) return
    setFirstName(profile.firstName)
    setLastName(profile.lastName)
    setDisplayName(profile.displayName)
  }, [profile])

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

  const handleChangePassword = async () => {
    if (!isValidPassword(newPassword) || newPassword !== confirmPassword) {
      setPasswordMessage('Les mots de passe doivent correspondre et respecter les règles de sécurité.')
      return
    }
    try {
      setPasswordSaving(true)
      setPasswordMessage('')
      await updatePassword(newPassword)
      setPasswordMessage('Mot de passe mis à jour.')
    } catch (error) {
      setPasswordMessage(passwordUpdateErrorMessage(error))
    } finally {
      setPasswordSaving(false)
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <DashboardLayout>
      <header className="topbar">
        <div>
          <Eyebrow>Paramètres</Eyebrow>
          <h1>Compte TAGGO</h1>
          <p className="topbar-subtitle">Gérez votre profil, la sécurité et votre abonnement.</p>
        </div>
        <Link to="/dashboard" className="ghost-button">Retour au tableau de bord</Link>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Compte</p>
            <h2>Informations</h2>
          </div>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <div>
            <p className="topbar-subtitle" style={{ marginBottom: '0.25rem' }}>Nom d’affichage</p>
            <strong>{profile?.displayName || user?.fullName || 'Non renseigné'}</strong>
          </div>
          <div>
            <p className="topbar-subtitle" style={{ marginBottom: '0.25rem' }}>Email</p>
            <strong>{user?.email || 'Non disponible'}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Profil</p>
            <h2>Vos informations</h2>
          </div>
        </div>
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
          <div>
            <button type="button" className="primary-button" onClick={() => void handleSaveProfile()} disabled={profileLoading || saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer le profil'}
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Sécurité</p>
            <h2>Accès au compte</h2>
          </div>
        </div>
        <p className="topbar-subtitle" style={{ marginBottom: '1rem' }}>Les changements d’adresse email sont confirmés par Supabase Auth avant leur prise en compte.</p>
        {mode === 'supabase' ? (
          <div className="auth-form" style={{ marginBottom: '1.25rem' }}>
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
            <div>
              <button type="button" className="ghost-button" onClick={() => void handleRequestEmailChange()} disabled={saving}>
                {saving ? 'Envoi...' : 'Demander le changement'}
              </button>
            </div>
          </div>
        ) : null}
        {mode === 'supabase' ? (
          <div className="auth-form" style={{ marginBottom: '1rem' }}>
            <label htmlFor="account-new-password">
              Nouveau mot de passe
              <input
                id="account-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={passwordSaving}
              />
            </label>
            <label htmlFor="account-confirm-password">
              Confirmer le mot de passe
              <input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={passwordSaving}
              />
            </label>
            {passwordMessage ? <p role="status" className="form-error">{passwordMessage}</p> : null}
            <div>
              <button type="button" className="ghost-button" onClick={() => void handleChangePassword()} disabled={passwordSaving}>
                {passwordSaving ? 'Mise à jour...' : 'Changer le mot de passe'}
              </button>
            </div>
          </div>
        ) : (
          <p className="topbar-subtitle" style={{ marginBottom: '1rem' }}>Le changement de mot de passe est disponible avec Supabase Auth.</p>
        )}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="ghost-button" onClick={handleSignOut}>Déconnexion</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Abonnement</p>
            <h2>Renouvellement</h2>
          </div>
        </div>
        <p className="topbar-subtitle">
          L’abonnement TAGGO est rattaché à chaque TAGGO, pas au compte : la première année est incluse avec l’achat, puis un renouvellement annuel est nécessaire. Le statut, les dates et le renouvellement automatique de chaque TAGGO sont affichés sur la page de ce TAGGO, dans votre tableau de bord.
        </p>
        <p className="topbar-subtitle" style={{ marginTop: '0.75rem' }}>
          Le tarif de renouvellement n’est pas encore défini : aucun renouvellement ne peut être effectué pour le moment.
        </p>
      </section>
    </DashboardLayout>
  )
}
