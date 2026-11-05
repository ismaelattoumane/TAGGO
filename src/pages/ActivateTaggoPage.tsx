import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { useAuth } from '../context/AuthContext'
import { qrRepository } from '../features/qr/repository'
import { isValidTagCode, normalizeTagCode } from '../features/qr/tagCode'
import { usePageSeo } from '../lib/usePageSeo'

export function ActivateTaggoPage() {
  usePageSeo({ title: 'Activer mon TAGGO — TAGGO', description: 'Activez votre TAGGO et connectez-le à votre compte.', noindex: true })
  const { tag } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tagInput, setTagInput] = useState('')
  const [message, setMessage] = useState(tag ? 'Activation en cours...' : '')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!tag || !user) return
    const activate = async () => {
      try {
        const record = await qrRepository.activate(normalizeTagCode(tag), user.id)
        if (!record) {
          setError(true)
          setMessage('Ce TAGGO ne peut pas être activé avec ce compte.')
          return
        }
        navigate(`/dashboard/qr/${record.id}`, { replace: true })
      } catch {
        setError(true)
        setMessage('Ce TAGGO ne peut pas être activé pour le moment.')
      }
    }
    void activate()
  }, [navigate, tag, user])

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedTag = normalizeTagCode(tagInput)
    if (!isValidTagCode(normalizedTag)) {
      setError(true)
      setMessage('Saisissez un code TAGGO valide.')
      return
    }
    navigate(`/activate/${encodeURIComponent(normalizedTag)}`)
  }

  return (
    <main className="public-page">
      <section className="public-card public-state-card">
        <p className="public-kicker">TAGGO / ACTIVATION</p>
        <h1>Activation de votre TAGGO</h1>
        {tag ? (
          error ? <Alert type="error">{message}</Alert> : <p role="status">{message}</p>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="taggo-activation-code">
              Code TAGGO
              <input
                id="taggo-activation-code"
                value={tagInput}
                onChange={(event) => {
                  setTagInput(event.target.value)
                  setError(false)
                }}
                placeholder="ex. TGG-ABC1234"
                autoComplete="off"
              />
            </label>
            {error ? <Alert type="error">{message}</Alert> : null}
            <button type="submit" className="primary-button">Activer le TAGGO</button>
          </form>
        )}
      </section>
    </main>
  )
}