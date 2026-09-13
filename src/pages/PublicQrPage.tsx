import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { qrRepository } from '../features/qr/repository'
import type { PublicTaggoProfile } from '../features/qr/publicProfile'
import type { QrStatus } from '../features/qr/qrTypes'
import { Alert } from '../components/Alert'
import { isValidDestinationUrl } from '../lib/validators'

export function PublicQrPage() {
  const { publicId, tag } = useParams()
  const code = tag ?? publicId
  const [profile, setProfile] = useState<PublicTaggoProfile | null>(null)
  const [publicStatus, setPublicStatus] = useState<QrStatus | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!code) {
        setLoaded(true)
        return
      }
      try {
        const [publicProfile, status] = await Promise.all([
          qrRepository.getPublicTaggoProfile(code),
          qrRepository.getPublicTaggoStatus(code),
        ])
        setProfile(publicProfile)
        setPublicStatus(status)
      } catch {
        setLoadError(true)
      }
      setLoaded(true)
    }
    void load()
  }, [code])

  useEffect(() => {
    if (!profile) return
    document.title = `${profile.displayName ?? 'TAGGO'} — TAGGO`
    const robots = document.querySelector('meta[name="robots"]')
    robots?.setAttribute('content', 'index, follow')
    return () => {
      document.title = 'TAGGO — Gestion des QR codes'
      robots?.setAttribute('content', 'noindex, nofollow')
    }
  }, [profile])

  if (!loaded) {
    return (
      <main className="public-page">
        <section className="public-card public-state-card">
          <p className="public-kicker">TAGGO / PAGE PUBLIQUE</p>
          <h1>Chargement…</h1>
        </section>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="public-page">
        <section className="public-card public-state-card">
          <p className="public-kicker">TAGGO / PAGE PUBLIQUE</p>
          <h1>Service temporairement indisponible</h1>
          <Alert type="error">Impossible de charger ce TAGGO pour le moment. Réessayez plus tard.</Alert>
        </section>
      </main>
    )
  }

  if (!profile && publicStatus && publicStatus !== 'active') {
    return (
      <main className="public-page">
        <section className="public-card public-state-card">
          <p className="public-kicker">TAGGO / PAGE PUBLIQUE</p>
          <h1>QR temporairement indisponible</h1>
          <Alert type="error">Ce TAGGO n'est pas actif pour le moment.</Alert>
        </section>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="public-page">
        <section className="public-card public-state-card">
          <p className="public-kicker">TAGGO / PAGE PUBLIQUE</p>
          <h1>QR introuvable</h1>
          <Alert type="error">
            Ce code n'existe pas ou n'est plus actif. Vérifiez que l'identifiant public est correct.
          </Alert>
          <a href={`${import.meta.env.BASE_URL}login`} className="primary-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Retourner à l'accueil
          </a>
        </section>
      </main>
    )
  }

  if (!isValidDestinationUrl(profile.destinationUrl)) {
    return (
      <main className="public-page">
        <section className="public-card">
          <p className="eyebrow">QR public</p>
          <h1>QR temporairement indisponible</h1>
          <Alert type="error">Ce TAGGO n'est pas actif pour le moment.</Alert>
        </section>
      </main>
    )
  }

  const safeProfileUrl = profile.profileUrl && isValidDestinationUrl(profile.profileUrl)
    ? profile.profileUrl
    : null

  return (
    <main className="public-page">
      <section className="public-card public-profile-card">
        <div className="public-brand">TAGGO</div>
        <p className="public-kicker">PAGE PUBLIQUE</p>
        <h1>{profile.displayName ?? 'TAGGO'}</h1>
        {profile.headline ? <p className="headline">{profile.headline}</p> : null}
        {profile.bio ? <p className="bio">{profile.bio}</p> : null}

        <a className="primary-button public-cta" href={profile.destinationUrl} target="_blank" rel="noreferrer">
          Accéder
        </a>
        {safeProfileUrl ? (
          <a className="public-profile-link" href={safeProfileUrl} target="_blank" rel="noreferrer">
            Voir le profil
          </a>
        ) : null}
        <p className="public-footer">Powered by TAGGO</p>
      </section>
    </main>
  )
}
