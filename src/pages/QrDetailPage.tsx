import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isValidDestinationUrl, sanitizeText } from '../lib/validators'
import { qrRepository } from '../features/qr/repository'

export function QrDetailPage() {
  const { qrId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [status, setStatus] = useState<'draft' | 'active' | 'inactive' | 'archived'>('draft')
  const [publicId, setPublicId] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!qrId) {
        setMessage('QR non trouvé.')
        setLoading(false)
        return
      }

      const qr = await qrRepository.getById(qrId, user?.id)
      if (!qr) {
        setMessage('QR non trouvé.')
        setLoading(false)
        return
      }

      setTitle(qr.title)
      setDestinationUrl(qr.destinationUrl)
      setStatus(qr.status)
      setPublicId(qr.publicId)
      setLoading(false)
    }
    if (user) void load()
  }, [qrId, user])

  const handleSave = async () => {
    if (!qrId) return

    const cleanedTitle = sanitizeText(title)
    const valid = cleanedTitle && isValidDestinationUrl(destinationUrl)

    if (!valid) {
      setMessage('Titre ou destination invalide.')
      return
    }

    const updated = await qrRepository.update(qrId, {
      title: cleanedTitle,
      destinationUrl,
      status,
    }, user?.id)

    if (updated) {
      setMessage('QR mis à jour avec succès.')
      setTimeout(() => {
        navigate('/dashboard')
      }, 1000)
    } else {
      setMessage('Erreur lors de la sauvegarde.')
    }
  }

  const handleDelete = async () => {
    if (!qrId) return

    if (await qrRepository.remove(qrId, user?.id)) {
      setMessage('QR supprimé avec succès.')
      setTimeout(() => {
        navigate('/dashboard')
      }, 1000)
    } else {
      setMessage('Erreur lors de la suppression.')
    }
  }

  if (loading) {
    return (
      <main className="settings-shell">
        <section className="settings-card" style={{ maxWidth: 700 }}>
          <p>Chargement...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="settings-shell">
      <section className="settings-card" style={{ maxWidth: 700 }}>
        <p className="eyebrow">QR detail</p>
        <h1>{publicId}</h1>

        <div className="auth-form" style={{ marginTop: '1.5rem' }}>
          <label htmlFor="qr-title">
            Nom du QR
            <input
              id="qr-title"
              name="qrTitle"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label htmlFor="qr-destination">
            Destination publique
            <input
              id="qr-destination"
              name="qrDestination"
              type="url"
              inputMode="url"
              value={destinationUrl}
              onChange={(event) => setDestinationUrl(event.target.value)}
            />
          </label>

          <label htmlFor="qr-status">
            Statut
            <select
              id="qr-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="archived">archived</option>
            </select>
          </label>

          {message ? (
            <p role="status" className="form-error">
              {message}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="primary-button" onClick={() => void handleSave()}>
              Enregistrer
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
              style={{ color: '#d32f2f' }}
            >
              Supprimer
            </button>
          </div>

          {showDeleteConfirm && (
            <div style={{ padding: '1rem', backgroundColor: '#fff3e0', borderRadius: '4px', marginTop: '1rem' }}>
              <p style={{ marginBottom: '0.75rem', fontWeight: 'bold', color: '#d32f2f' }}>
                Confirmer la suppression?
              </p>
              <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
                Cette action est irréversible.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => void handleDelete()}
                  style={{ color: '#d32f2f' }}
                >
                  Supprimer définitivement
                </button>
                <button type="button" className="ghost-button" onClick={() => setShowDeleteConfirm(false)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
