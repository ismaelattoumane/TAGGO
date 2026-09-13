import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isValidDestinationUrl, sanitizeText } from '../lib/validators'
import { qrRepository } from '../features/qr/LocalQrRepository'

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
      const newQr = await qrRepository.create({
        title: cleanedTitle,
        destinationUrl,
      })
      setMessage('QR créé avec succès.')
      setTimeout(() => {
        navigate(`/dashboard/qr/${newQr.id}`)
      }, 500)
    } catch {
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
          <label htmlFor="qr-create-title">
            Nom du QR
            <input
              id="qr-create-title"
              name="qrTitle"
              placeholder="ex: Collection Print"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label htmlFor="qr-create-destination">
            Destination publique
            <input
              id="qr-create-destination"
              name="qrDestination"
              type="url"
              inputMode="url"
              placeholder="ex: https://taggo.example/collection"
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
            />
          </label>

          {message ? (
            <p role="status" className="form-error">
              {message}
            </p>
          ) : null}

          <button type="button" className="primary-button" onClick={() => void handleCreate()} disabled={isLoading}>
            {isLoading ? 'Création...' : 'Créer le QR'}
          </button>
        </div>
      </section>
    </main>
  )
}
