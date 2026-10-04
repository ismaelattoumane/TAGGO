import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { passwordUpdateErrorMessage } from '../features/auth/authErrors'
import { isValidPassword } from '../lib/validators'
import { usePageSeo } from '../lib/usePageSeo'

/**
 * ÉTAPE 10.1 — `/reset-password`
 *
 * Le lien Supabase ouvre cette page avec une session de récupération déjà
 * établie (`detectSessionInUrl`). Sans session, aucun formulaire n'est affiché :
 * le visiteur est renvoyé vers `/forgot-password` plutôt que de voir une erreur
 * technique. Le nouveau mot de passe est appliqué par `updateUser()`.
 *
 * Aucun mot de passe n'est journalisé, affiché ni stocké : il ne quitte jamais
 * ce composant.
 */
export function PasswordUpdatePage() {
  usePageSeo({ title: 'Nouveau mot de passe — TAGGO', description: 'Choisissez un nouveau mot de passe pour votre compte TAGGO.', noindex: true })
  const { mode, user, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode !== 'supabase') {
      setError('La modification du mot de passe est disponible avec Supabase Auth.')
      return
    }
    if (!isValidPassword(password) || password !== confirmation) {
      setError('Les mots de passe doivent correspondre et respecter les règles de sécurité.')
      return
    }

    try {
      setSaving(true)
      setError('')
      await updatePassword(password)
      navigate('/login', { replace: true, state: { passwordUpdated: true } })
    } catch (updateError) {
      setError(passwordUpdateErrorMessage(updateError))
    } finally {
      setSaving(false)
      setPassword('')
      setConfirmation('')
    }
  }

  const showUnavailableNotice = mode !== 'supabase'
  // Tant que la session n'est pas restaurée, aucun verdict sur le lien : ni
  // formulaire (qui échouerait), ni message « lien expiré » (faux diagnostic).
  const showSessionLoading = mode === 'supabase' && loading
  const showExpiredLinkNotice = mode === 'supabase' && !loading && !user
  const showForm = mode === 'supabase' && !loading && Boolean(user)

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-block">
          <span className="brand-mark">TAGGO</span>
          <h1>Nouveau mot de passe</h1>
        </div>

        {showUnavailableNotice ? (
          <p role="status">
            La modification du mot de passe est disponible avec Supabase Auth.
          </p>
        ) : null}

        {showSessionLoading ? (
          <p role="status">Vérification du lien de réinitialisation…</p>
        ) : null}

        {showExpiredLinkNotice ? (
          <div>
            <p role="alert">
              Ce lien de réinitialisation est invalide ou a expiré. Demande-en un
              nouveau pour continuer.
            </p>
            <p className="auth-link">
              <Link to="/forgot-password">Recevoir un nouveau lien</Link>
            </p>
          </div>
        ) : null}

        {showForm ? (
          <>
            {user ? (
              <p className="auth-link">
                Tu es déjà connecté. Choisir un nouveau mot de passe met à jour
                ton compte TAGGO.
              </p>
            ) : null}

            {/* `noValidate` : idem, la règle affichée est celle réellement
                appliquée par `isValidPassword` (et documentée côté Supabase). */}
            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <label htmlFor="new-password">
                Nouveau mot de passe
                <input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  aria-required="true"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'password-update-error' : 'password-rules'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              <label htmlFor="new-password-confirmation">
                Confirmer le mot de passe
                <input
                  id="new-password-confirmation"
                  name="newPasswordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  required
                  aria-required="true"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'password-update-error' : undefined}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>

              <p id="password-rules" className="auth-link">
                Minimum 8 caractères, dont une majuscule et un chiffre.
              </p>

              {error ? (
                <p id="password-update-error" role="alert" className="form-error">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
              </button>
            </form>
          </>
        ) : null}

        <p className="auth-link">
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </section>
    </main>
  )
}
