import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DashboardLayout } from '../components/DashboardLayout'
import { Eyebrow } from '../components/ui/Typography/Typography'
import { useAuth } from '../context/AuthContext'
import { isValidDestinationUrl, sanitizeText } from '../lib/validators'
import { qrRepository } from '../features/qr/repository'
import { usePageSeo } from '../lib/usePageSeo'

export function CreateQrPage() {
  usePageSeo({ title: 'Créer un QR code — TAGGO', description: 'Créez un QR code TAGGO depuis votre espace personnel.', noindex: true })
  const navigate = useNavigate()
  const { user } = useAuth()
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
        ownerId: user?.id,
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
    <DashboardLayout>
      <header className="topbar">
        <div>
          <Eyebrow>Créer un TAGGO</Eyebrow>
          <h1>Nouveau QR</h1>
          <p className="topbar-subtitle">Ajoutez un nouveau QR code à votre espace.</p>
        </div>
        <Link to="/dashboard" className="ghost-button">Retour au tableau de bord</Link>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Configuration</p>
            <h2>Détails du QR</h2>
          </div>
        </div>

        <div className="auth-form" style={{ maxWidth: 700 }}>
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

          <div>
            <button type="button" className="primary-button" onClick={() => void handleCreate()} disabled={isLoading}>
              {isLoading ? 'Création...' : 'Créer le QR'}
            </button>
          </div>
        </div>
      </section>
    </DashboardLayout>
  )
}
