import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { qrRepository } from '../features/qr/LocalQrRepository'
import type { QrRecord } from '../features/qr/qrTypes'
import { Alert } from '../components/Alert'

export function PublicQrPage() {
  const { publicId, tag } = useParams()
  const code = tag ?? publicId
  const [qr, setQr] = useState<QrRecord | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!code) {
        setLoaded(true)
        return
      }
      setQr(await qrRepository.getByPublicId(code))
      setLoaded(true)
    }
    void load()
  }, [code])

  if (!loaded) {
    return (
      <main className="public-page">
        <section className="public-card">
          <p className="eyebrow">QR public</p>
          <h1>Chargement…</h1>
        </section>
      </main>
    )
  }

  if (!qr) {
    return (
      <main className="public-page">
        <section className="public-card">
          <p className="eyebrow">QR public</p>
          <h1>QR introuvable</h1>
          <Alert type="error">
            Ce code n'existe pas ou n'est plus actif. Vérifiez que l'identifiant public est correct.
          </Alert>
          <a href="/login" className="primary-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Retourner à l'accueil
          </a>
        </section>
      </main>
    )
  }

  return (
    <main className="public-page">
      <section className="public-card">
        <p className="eyebrow">QR public</p>
        <h1>{qr.title}</h1>
        <p className="headline">Vêtements connectés avec une narration derrière chaque pièce.</p>
        <p className="bio">Accès public vers la destination associée au QR. Cette page est conçue pour rester ouverte à un visiteur sans authentification.</p>

        <div className="public-meta">
          <span>Identifiant public</span>
          <strong>{qr.publicId}</strong>
        </div>

        <a className="primary-button" href={qr.destinationUrl} target="_blank" rel="noreferrer">
          Découvrir la marque
        </a>
      </section>
    </main>
  )
}
