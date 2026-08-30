import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isValidDestinationUrl, sanitizeText } from '../lib/validators'
import { createDemoQr } from '../lib/demoData'

export function CreateQrPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleCreate = async () => {
    const cleanedTitle = sanitizeText(title)
    const valid = cleanedTitle && isValidDestinationUrl(destinationUrl)

    if (!valid) {
      setMessage('Titre ou destination invalide.')
      return
    }

    setIsLoading(true)
    try {
      const newQr = createDemoQr(cleanedTitle, destinationUrl)
      setMessage('QR créé avec succès.')
      setTimeout(() => {
        navigate(`/dashboard/qr/${newQr.id}`)
      }, 500)
    } catch (error) {
      setMessage('Erreur lors de la création du QR.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="settings-shell">
      <section className="settings-card" style={{ maxWidth: 700 }}>
        <p className="eyebrow">Créer un QR</p>
        <h1>Nouveau QR</h1>

        <div className="auth-form" style={{ marginTop: '1.5rem' }}>
          <label>
            Nom du QR
            <input
              placeholder="ex: Collection Print"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label>
            Destination publique
            <input
              placeholder="ex: https://taggo.example/collection"
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
            />
          </label>

          {message ? <p className="form-error">{message}</p> : null}

          <button type="button" className="primary-button" onClick={handleCreate} disabled={isLoading}>
            {isLoading ? 'Création...' : 'Créer le QR'}
          </button>
        </div>
      </section>
    </main>
  )
}
