import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isValidPassword } from '../lib/validators'

export function PasswordUpdatePage() {
  const { mode, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      setLoading(true)
      setError('')
      await updatePassword(password)
      navigate('/login', { replace: true, state: { passwordUpdated: true } })
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Impossible de modifier le mot de passe.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-block">
          <span className="brand-mark">TAGGO</span>
          <h1>Nouveau mot de passe</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label htmlFor="new-password">
            Nouveau mot de passe
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
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
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>

          {error ? <p role="alert" className="form-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
          </button>
        </form>

        <p className="auth-link">
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </section>
    </main>
  )
}
