import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert } from '../components/Alert'
import { useAuth } from '../context/AuthContext'
import { qrRepository } from '../features/qr/repository'
import { normalizeTagCode } from '../features/qr/tagCode'

export function ActivateTaggoPage() {
  const { tag } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [message, setMessage] = useState('Activation en cours...')
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

  return (
    <main className="public-page">
      <section className="public-card public-state-card">
        <p className="public-kicker">TAGGO / ACTIVATION</p>
        <h1>Activation de votre TAGGO</h1>
        {error ? <Alert type="error">{message}</Alert> : <p role="status">{message}</p>}
      </section>
    </main>
  )
}