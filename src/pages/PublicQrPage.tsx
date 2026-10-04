import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { qrRepository } from '../features/qr/repository'
import { recordTaggoScan } from '../features/analytics/scanClient'
import type { PublicTaggoProfile } from '../features/qr/publicProfile'
import type { QrStatus } from '../features/qr/qrTypes'
import type { PublicTaggoState } from '../features/qr/qrTypes'
import { Alert } from '../components/Alert'
import { isValidDestinationUrl } from '../lib/validators'

/**
 * ÉTAPE 11 — Scan enregistré côté serveur.
 *
 * L'enregistrement est déclenché en parallèle de la résolution du TAGGO et
 * N'EST JAMAIS attendu avant l'affichage : `recordTaggoScan` absorbe ses
 * propres erreurs. Une panne analytics, un 404, un 500 ou une coupure réseau
 * n'affichent rien au visiteur et n'empêchent pas l'ouverture de la page.
 *
 * Un seul enregistrement par code par montage du composant : un rechargement de
 * la page compte un nouveau scan (comportement attendu), un double rendu React
 * en mode strict n'en compte qu'un.
 */
export function PublicQrPage() {
  const { publicId, tag } = useParams()
  const code = tag ?? publicId
  const [profile, setProfile] = useState<PublicTaggoProfile | null>(null)
  const [publicStatus, setPublicStatus] = useState<QrStatus | null>(null)
  const [publicState, setPublicState] = useState<PublicTaggoState>('not_found')
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const scanRequestedFor = useRef<string | null>(null)

  useEffect(() => {
    const load = async () => {
      if (!code) {
        setLoaded(true)
        return
      }
      try {
        const [publicProfile, status, state] = await Promise.all([
          qrRepository.getPublicTaggoProfile(code),
          qrRepository.getPublicTaggoStatus(code),
          qrRepository.getPublicTaggoState(code),
        ])
        setProfile(publicProfile)
        setPublicStatus(status)
        setPublicState(state)
      } catch {
        setLoadError(true)
      }
      setLoaded(true)
    }
    void load()
  }, [code])

  // Analytics : déclenché, jamais attendu, jamais affiché au visiteur.
  useEffect(() => {
    if (!code) return
    if (scanRequestedFor.current === code) return

    scanRequestedFor.current = code
    void recordTaggoScan(code)
  }, [code])

  useEffect(() => {
    if (!profile) return
    document.title = `${profile.displayName ?? 'TAGGO'} — TAGGO`
    const robots = document.querySelector('meta[name="robots"]')
    const previousRobots = robots?.getAttribute('content')
    robots?.setAttribute('content', 'index, follow')
    return () => {
      document.title = 'TAGGO — Gestion des QR codes'
      if (previousRobots) robots?.setAttribute('content', previousRobots)
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

  if (publicState === 'expired' || publicState === 'subscription_required') {
    // ETAPE 12 — TAGGO dont la periode est terminee, ou TAGGO SANS abonnement.
    //
    // Les DEUX etats sont rendus par le meme écran volontairement : du point de
    // vue du visiteur la situation est identique (rien ne s'ouvre) et surtout la
    // distinction exacte (« votre abonnement a expiré » vs « aucun abonnement
    // n'existe pour ce TAGGO ») n'est visible que du PROPRIETAIRE, dans son
    // tableau de bord. L'afficher ici révélerait au visiteur la situation
    // commerciale d'un TAGGO qui n'est pas le sien.
    //
    // Message minimal : ni propriétaire, ni email, ni date d'expiration, ni
    // information de facturation. Rien de ce qui est en base n'est révélé.
    return (
      <main className="public-page">
        <section className="public-card public-state-card">
          <p className="public-kicker">TAGGO / PAGE PUBLIQUE</p>
          <h1>TAGGO temporairement indisponible</h1>
          <Alert type="error">
            Ce TAGGO n’est plus utilisable pour le moment. Contactez son propriétaire pour plus
            d’informations.
          </Alert>
        </section>
      </main>
    )
  }

  if (!profile && publicState === 'unactivated' && code) {
    const returnTo = `/activate/${encodeURIComponent(code)}`
    return (
      <main className="public-page">
        <section className="public-card public-state-card">
          <p className="public-kicker">TAGGO / ACTIVATION</p>
          <h1>TAGGO non activé</h1>
          <Alert type="error">Ce TAGGO n'a pas encore été activé.</Alert>
          <a href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="primary-button" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Activer mon TAGGO
          </a>
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
