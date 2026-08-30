import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isValidEmail, isValidPassword, sanitizeText } from '../lib/validators'

export function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    const cleanedFullName = sanitizeText(fullName)
    if (!cleanedFullName || !isValidEmail(email) || !isValidPassword(password)) {
      setError('Veuillez vérifier le nom, l’email et le mot de passe.')
      return
    }

    try {
      setLoading(true)
      setError('')
      await signUp(email, password, cleanedFullName)
      navigate('/dashboard')
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Erreur d’inscription.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-block">
          <span className="brand-mark">TAGGO</span>
          <h1>Créer un compte</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Nom complet
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Alex Martin"
            />
          </label>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="hello@taggo.com"
            />
          </label>

          <label>
            Mot de passe
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimum 8 caractères"
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Création...' : 'S’inscrire'}
          </button>
        </form>

        <p className="auth-link">
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </p>
      </section>
    </main>
  )
}
