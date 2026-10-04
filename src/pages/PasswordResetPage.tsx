import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { passwordResetRequestMessage } from '../features/auth/authErrors'
import { isValidEmail } from '../lib/validators'
import { usePageSeo } from '../lib/usePageSeo'

/**
 * ÉTAPE 10.1 — `/forgot-password`
 *
 * Le formulaire ne fait qu'appeler `resetPasswordForEmail()` via le
 * AuthRepository : aucun token n'est créé, stocké ou journalisé par TAGGO.
 * Le message affiché est IDENTIQUE que l'adresse corresponde ou non à un
 * compte, ce qui empêche l'énumération de comptes.
 */
export function PasswordResetPage() {
  usePageSeo({ title: 'Mot de passe oublié — TAGGO', description: 'Demandez la réinitialisation du mot de passe de votre compte TAGGO.', noindex: true })
  const { mode, requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode !== 'supabase') {
      setError('La récupération du mot de passe est disponible avec Supabase Auth.')
      return
    }
    if (!isValidEmail(email)) {
      setError('Saisissez une adresse email valide.')
      return
    }

    try {
      setLoading(true)
      setError('')
      await requestPasswordReset(email.trim())
      setMessage(passwordResetRequestMessage(null))
    } catch (resetError) {
      // Le message reste volontairement indépendant du compte visé.
      setMessage(passwordResetRequestMessage(resetError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-block">
          <span className="brand-mark">TAGGO</span>
          <h1>Mot de passe oublié</h1>
        </div>

        {/* `noValidate` : la validation native du navigateur est remplacée par
            le message accessible rendu ci-dessous, seul à informer
            l'utilisateur. */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label htmlFor="reset-email">
            Email
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'reset-error' : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="hello@taggo.com"
            />
          </label>

          {error ? (
            <p id="reset-error" role="alert" className="form-error">
              {error}
            </p>
          ) : null}
          {message ? <p role="status">{message}</p> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Envoi...' : 'Recevoir le lien'}
          </button>
        </form>

        <p className="auth-link">
          Le lien reçu par email ouvre la page de choix du nouveau mot de passe. Il
          est temporaire et à usage unique.
        </p>

        <p className="auth-link">
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </section>
    </main>
  )
}
