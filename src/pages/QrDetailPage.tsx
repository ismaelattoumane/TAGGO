import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { goBackSafely } from '../lib/navigation'
import { isValidDestinationUrl, sanitizeText } from '../lib/validators'
import { qrRepository } from '../features/qr/repository'
import { CopyButton } from '../components/CopyButton'
import { buildPublicTaggoUrl } from '../lib/publicUrl'
import { generateQrPng, generateQrSvg } from '../features/qr/qrCode'
import type { PublicProfileInput } from '../features/qr/publicProfile'

function downloadFile(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function downloadPng(dataUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = fileName
  link.click()
}

export function QrDetailPage() {
  const { qrId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [status, setStatus] = useState<'draft' | 'active' | 'inactive' | 'archived'>('draft')
  const [publicId, setPublicId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [headline, setHeadline] = useState('')
  const [bio, setBio] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [qrPng, setQrPng] = useState('')
  const [qrSvg, setQrSvg] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!qrId) {
        setMessage('QR non trouvé.')
        setLoading(false)
        return
      }

      try {
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
        const publicProfile = await qrRepository.getPublicProfile(qr.id, user?.id)
        setDisplayName(publicProfile?.displayName ?? qr.title)
        setHeadline(publicProfile?.headline ?? '')
        setBio(publicProfile?.bio ?? '')
        setProfileUrl(publicProfile?.profileUrl ?? '')
      } catch {
        setMessage('Impossible de charger ce QR pour le moment.')
      }
      setLoading(false)
    }
    if (user) void load()
  }, [qrId, user])

  useEffect(() => {
    if (!publicId) return
    void Promise.all([generateQrPng(publicId), generateQrSvg(publicId)]).then(([png, svg]) => {
      setQrPng(png)
      setQrSvg(svg)
    }).catch(() => {
      setMessage('Impossible de générer le QR code pour le moment.')
    })
  }, [publicId])

  const handleSave = async () => {
    if (!qrId) return

    const cleanedTitle = sanitizeText(title)
    const cleanedDisplayName = sanitizeText(displayName).slice(0, 80)
    const cleanedHeadline = sanitizeText(headline).slice(0, 120)
    const cleanedBio = sanitizeText(bio).slice(0, 500)
    const cleanedProfileUrl = profileUrl.trim()
    const valid = cleanedTitle && isValidDestinationUrl(destinationUrl)
      && cleanedDisplayName
      && (!cleanedProfileUrl || isValidDestinationUrl(cleanedProfileUrl))

    if (!valid) {
      setMessage('Vérifiez le titre, la destination et le lien du profil.')
      return
    }

    setSaving(true)
    try {
      const updated = await qrRepository.update(qrId, {
        title: cleanedTitle,
        destinationUrl,
        status,
      }, user?.id)

      if (updated) {
        const publicProfile: PublicProfileInput = {
          displayName: cleanedDisplayName,
          headline: cleanedHeadline,
          bio: cleanedBio,
          profileUrl: cleanedProfileUrl,
        }
        const savedProfile = await qrRepository.savePublicProfile(qrId, publicProfile, user?.id)
        if (!savedProfile) {
          setMessage('Le TAGGO a été enregistré, mais le profil public n’a pas pu être sauvegardé.')
          return
        }
        setMessage('QR mis à jour avec succès.')
        setTimeout(() => {
          navigate('/dashboard')
        }, 1000)
      } else {
        setMessage('Erreur lors de la sauvegarde.')
      }
    } catch {
      setMessage('Impossible de sauvegarder ce QR pour le moment.')
    } finally {
      setSaving(false)
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <p className="eyebrow">QR detail</p>
            <h1>{publicId}</h1>
          </div>
          <button type="button" className="ghost-button" onClick={() => goBackSafely(navigate, '/dashboard')}>Retour</button>
        </div>

        <section className="qr-code-panel" aria-labelledby="qr-code-title">
          <div>
            <p className="eyebrow">Ton QR TAGGO</p>
            <h2 id="qr-code-title">Scanne pour ouvrir ta page publique</h2>
          </div>
          {qrPng ? <img className="qr-code-image" src={qrPng} alt={`QR code de ${publicId}`} /> : <p role="status">Génération du QR code...</p>}
          <strong>{publicId}</strong>
          <p>Ce QR ouvre ta page TAGGO publique.</p>
          <div className="qr-code-actions">
            <button type="button" className="primary-button" onClick={() => downloadPng(qrPng, `TAGGO-${publicId}.png`)} disabled={!qrPng}>
              Télécharger PNG
            </button>
            <button type="button" className="ghost-button" onClick={() => downloadFile(qrSvg, `TAGGO-${publicId}.svg`, 'image/svg+xml')} disabled={!qrSvg}>
              Télécharger SVG
            </button>
            <CopyButton text={buildPublicTaggoUrl(publicId)} label="Copier le lien" />
            <a className="link-button" href={buildPublicTaggoUrl(publicId)} target="_blank" rel="noreferrer">
              Ouvrir la page
            </a>
          </div>
        </section>

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

          <fieldset className="profile-fields">
            <legend>Profil public</legend>
            <label htmlFor="profile-display-name">
              Nom affiché
              <input id="profile-display-name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label htmlFor="profile-headline">
              Phrase d’accroche
              <input id="profile-headline" maxLength={120} value={headline} onChange={(event) => setHeadline(event.target.value)} />
            </label>
            <label htmlFor="profile-bio">
              Bio
              <textarea id="profile-bio" maxLength={500} rows={4} value={bio} onChange={(event) => setBio(event.target.value)} />
            </label>
            <label htmlFor="profile-url">
              Lien de profil
              <input id="profile-url" type="url" inputMode="url" value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} />
            </label>
          </fieldset>

          {message ? (
            <p role="status" className="form-error">
              {message}
            </p>
          ) : null}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
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
