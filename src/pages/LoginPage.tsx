import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'
import { isValidEmail, isValidPassword } from '../lib/validators'

const DEMO_ACCOUNTS = [
  {
    email: 'demo@taggo.local',
    password: 'DemoPass123!',
    label: 'Compte démo',
  },
  {
    email: 'test@taggo.local',
    password: 'TestPass123!',
    label: 'Compte test',
  },
]

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const returnTo = new URLSearchParams(location.search).get('returnTo')
  const destination = returnTo?.startsWith('/') ? returnTo : '/dashboard'

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isValidEmail(email) || !isValidPassword(password)) {
      setError('Email ou mot de passe invalide.')
      return
    }

    try {
      setLoading(true)
      setError('')
      await signIn(email, password)
      navigate(destination)
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  const quickSignIn = async (demoEmail: string, demoPassword: string) => {
    try {
      setLoading(true)
      setError('')
      await signIn(demoEmail, demoPassword)
      navigate(destination)
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand-block">
          <span className="brand-mark">TAGGO</span>
          <h1>Connexion</h1>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate={false}>
          <label htmlFor="login-email">
            Email
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="hello@taggo.com"
            />
          </label>

          <label htmlFor="login-password">
            Mot de passe
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-required="true"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Votre mot de passe"
            />
          </label>

          {error ? (
            <p id="login-error" role="alert" className="form-error">
              {error}
            </p>
          ) : null}

          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {!isSupabaseConfigured ? (
          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
            <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>
              🧪 Comptes de démonstration :
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="ghost-button"
                  onClick={() => quickSignIn(account.email, account.password)}
                  disabled={loading}
                  style={{ fontSize: '0.875rem', textAlign: 'left' }}
                >
                  {account.label} ({account.email})
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <p className="auth-link">
          Pas encore inscrit ? <Link to="/register">Créer un compte</Link>
        </p>
      </section>
    </main>
  )
}

