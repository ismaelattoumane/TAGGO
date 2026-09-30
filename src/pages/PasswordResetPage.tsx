import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isValidEmail } from '../lib/validators'

export function PasswordResetPage() {
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
      setMessage('Si ce compte existe, Supabase enverra un lien de récupération à cette adresse.')
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Impossible de demander la récupération.')
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

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="reset-email">
            Email
            <input
              id="reset-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="hello@taggo.com"
            />
          </label>

          {error ? <p role="alert" className="form-error">{error}</p> : null}
          {message ? <p role="status">{message}</p> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Envoi...' : 'Recevoir le lien'}
          </button>
        </form>

        <p className="auth-link">
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </section>
    </main>
  )
}
