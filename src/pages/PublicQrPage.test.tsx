import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicQrPage } from './PublicQrPage'

/**
 * ÉTAPE 11 — La page publique `/t/:tag` enregistre un scan sans jamais
 * bloquer l'affichage ni exposer une panne analytics au visiteur.
 *
 * C'est la contrainte de confidentialité ET de robustesse centrale de l'étape :
 * `recordTaggoScan` est fire-and-forget et absorbe ses propres erreurs.
 */

const recordTaggoScan = vi.fn()
const getPublicTaggoProfile = vi.fn()
const getPublicTaggoStatus = vi.fn()
const getPublicTaggoState = vi.fn()

vi.mock('../features/analytics/scanClient', () => ({
  recordTaggoScan: (code: string) => recordTaggoScan(code),
}))

vi.mock('../features/qr/repository', () => ({
  qrRepository: {
    getPublicTaggoProfile: (code: string) => getPublicTaggoProfile(code),
    getPublicTaggoStatus: (code: string) => getPublicTaggoStatus(code),
    getPublicTaggoState: (code: string) => getPublicTaggoState(code),
  },
}))

const PROFILE = {
  publicId: 'TGG-ABCD234',
  name: 'Carte de visite',
  destinationUrl: 'https://example.org',
}

function renderPublicPage(path = '/t/TGG-ABCD234') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:tag" element={<PublicQrPage />} />
        <Route path="/p/:publicId" element={<PublicQrPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  recordTaggoScan.mockResolvedValue(true)
  getPublicTaggoProfile.mockResolvedValue(PROFILE)
  getPublicTaggoStatus.mockResolvedValue('active')
  getPublicTaggoState.mockResolvedValue('active')
})

describe('scan public', () => {
  it('enregistre un scan pour le code de l’URL', async () => {
    renderPublicPage()

    await waitFor(() => expect(recordTaggoScan).toHaveBeenCalledWith('TGG-ABCD234'))
  })

  it('fonctionne aussi sur l’ancienne route /p/:publicId', async () => {
    renderPublicPage('/p/TGG-ABCD234')

    await waitFor(() => expect(recordTaggoScan).toHaveBeenCalledWith('TGG-ABCD234'))
  })

  it('n’enregistre qu’un seul scan par code', async () => {
    const { rerender } = renderPublicPage()

    await waitFor(() => expect(recordTaggoScan).toHaveBeenCalledTimes(1))
    rerender(
      <MemoryRouter initialEntries={['/t/TGG-ABCD234']}>
        <Routes>
          <Route path="/t/:tag" element={<PublicQrPage />} />
        </Routes>
      </MemoryRouter>,
    )
    await waitFor(() => expect(recordTaggoScan).toHaveBeenCalledTimes(1))
  })

  it('affiche la page même si l’enregistrement du scan échoue', async () => {
    recordTaggoScan.mockRejectedValue(new Error('analytics down'))

    renderPublicPage()

    // Le contenu public reste rendu : le visiteur ne voit jamais une erreur
    // analytics, et le scan raté n'empêche pas l'ouverture du TAGGO.
    const cta = await screen.findByRole('link', { name: 'Accéder' })
    expect(cta).toHaveAttribute('href', 'https://example.org')
    expect(recordTaggoScan).toHaveBeenCalled()
  })

  it('affiche la page même si le réseau du scan échoue', async () => {
    recordTaggoScan.mockResolvedValue(false)

    renderPublicPage()

    expect(await screen.findByRole('link', { name: 'Accéder' })).toBeInTheDocument()
  })

  it('n’affiche jamais de message d’erreur analytics', async () => {
    recordTaggoScan.mockRejectedValue(new Error('boom'))

    const { container } = renderPublicPage()

    await waitFor(() => expect(recordTaggoScan).toHaveBeenCalled())
    expect(container.textContent).not.toMatch(/analytic/i)
  })

  it('n’enregistre aucun scan si aucun code n’est fourni', async () => {
    renderPublicPage('/t/')

    await waitFor(() => expect(getPublicTaggoProfile).not.toHaveBeenCalled())
    expect(recordTaggoScan).not.toHaveBeenCalled()
  })
})
/**
 * ÉTAPE 12 — Page publique d'un TAGGO expiré.
 *
 * Contraintes vérifiées :
 * - la destination n'est plus affichée ;
 * - AUCUNE donnée privée n'est révélée (ni propriétaire, ni email, ni date
 *   d'expiration, ni information de facturation, ni détail Stripe) ;
 * - l'état 'expired' reste DISTINCT de 'unavailable' (suspendu / remplacé) et de
 *   'not_found' (supprimé) ;
 * - un TAGGO actif et un TAGGO non expiré sont inchangés — aucune régression.
 */

const DESTINATION = 'https://example.org'

describe('page publique — TAGGO actif', () => {
  it('affiche normalement sa destination', async () => {
    getPublicTaggoProfile.mockResolvedValue(PROFILE)
    getPublicTaggoStatus.mockResolvedValue('active')
    getPublicTaggoState.mockResolvedValue('active')

    renderPublicPage()

    const cta = await screen.findByRole('link', { name: 'Accéder' })
    expect(cta).toHaveAttribute('href', DESTINATION)
  })

  it('ne dit rien à propos d’un abonnement', async () => {
    getPublicTaggoProfile.mockResolvedValue(PROFILE)
    getPublicTaggoStatus.mockResolvedValue('active')
    getPublicTaggoState.mockResolvedValue('active')

    const { container } = renderPublicPage()

    await screen.findByRole('link', { name: 'Accéder' })
    expect(container.textContent).not.toMatch(/abonnement|expir|renouvel/i)
  })
})

describe('page publique — TAGGO expiré', () => {
  beforeEach(() => {
    getPublicTaggoProfile.mockResolvedValue(null)
    getPublicTaggoStatus.mockResolvedValue('inactive')
    getPublicTaggoState.mockResolvedValue('expired')
  })

  it('affiche un état d’indisponibilité', async () => {
    renderPublicPage()

    expect(await screen.findByRole('heading', { name: /temporairement indisponible/i })).toBeInTheDocument()
  })

  it('n’affiche plus la destination', async () => {
    renderPublicPage()

    await screen.findByRole('heading', { name: /temporairement indisponible/i })
    expect(screen.queryByRole('link', { name: 'Accéder' })).not.toBeInTheDocument()
  })

  it('ne révèle aucune donnée privée ni commerciale', async () => {
    const { container } = renderPublicPage()

    await screen.findByRole('heading', { name: /temporairement indisponible/i })
    const text = container.textContent ?? ''

    // Aucune identité : ni email, ni nom de propriétaire.
    expect(text).not.toMatch(/@/)
    expect(text).not.toMatch(/CONTACT|contact@|hello@/)

    // Aucune information financière ou de facturation.
    expect(text).not.toMatch(/facture|paiement|abonnement|renouvel/i)
    expect(text).not.toMatch(/stripe/i)
    expect(text).not.toMatch(/€|EUR|\d+\s*€/)

    // Aucune date : le visiteur n'a rien à savoir du calendrier commercial.
    expect(text).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/)
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('ne redirige pas vers la page d’activation (c’est un expiré, pas un non activé)', async () => {
    renderPublicPage()

    await screen.findByRole('heading', { name: /temporairement indisponible/i })
    expect(screen.queryByRole('link', { name: /Activer mon TAGGO/ })).not.toBeInTheDocument()
  })

  it('invite à contacter le propriétaire sans jamais l’identifier', async () => {
    renderPublicPage()

    await screen.findByRole('heading', { name: /temporairement indisponible/i })
    expect(screen.getByText(/Contactez son propriétaire/i)).toBeInTheDocument()
  })

  it('reste distinguishable d’un TAGGO introuvable', async () => {
    getPublicTaggoState.mockResolvedValue('not_found')
    getPublicTaggoProfile.mockResolvedValue(null)
    getPublicTaggoStatus.mockResolvedValue(null)

    renderPublicPage()

    expect(await screen.findByRole('heading', { name: 'QR introuvable' })).toBeInTheDocument()
  })
})

describe('page publique — TAGGO suspendu ou remplacé', () => {
  it('affiche un état d’indisponibilité distinct de l’expiration', async () => {
    getPublicTaggoProfile.mockResolvedValue(null)
    getPublicTaggoStatus.mockResolvedValue('inactive')
    getPublicTaggoState.mockResolvedValue('unavailable')

    renderPublicPage()

    // Un TAGGO suspendu n'est PAS un TAGGO expiré : la page ne doit pas
    // suggérer qu'un renouvellement le remit en service.
    expect(await screen.findByText("Ce TAGGO n'est pas actif pour le moment.")).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Accéder' })).not.toBeInTheDocument()
  })
})

/**
 * ÉTAPE 12 — Page publique d'un TAGGO SANS abonnement.
 *
 * `subscription_required` est un état NEUTRE : côté visiteur il produit exactement
 * le même écran que `expired` (rien ne s'ouvre), et il ne doit surtout pas
 * révéler que ce TAGGO n'a JAMAIS eu d'abonnement. La distinction n'est visible
 * que du côté du propriétaire, dans son tableau de bord.
 */
describe('page publique — TAGGO sans abonnement', () => {
  beforeEach(() => {
    getPublicTaggoProfile.mockResolvedValue(null)
    getPublicTaggoStatus.mockResolvedValue('active')
    getPublicTaggoState.mockResolvedValue('subscription_required')
  })

  it('affiche le même état d’indisponibilité qu’un TAGGO expiré', async () => {
    renderPublicPage()

    expect(await screen.findByRole('heading', { name: /temporairement indisponible/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Accéder' })).not.toBeInTheDocument()
  })

  it('ne dit jamais au visiteur que l’abonnement est manquant', async () => {
    // Révéler « aucun abonnement » au visiteur serait lui donner la situation
    // commerciale d'un TAGGO qui n'est pas le sien.
    const { container } = renderPublicPage()

    await screen.findByRole('heading', { name: /temporairement indisponible/i })
    const text = container.textContent ?? ''

    expect(text).not.toMatch(/abonnement|renouvel|paiement|facture/i)
    expect(text).not.toMatch(/jamais|aucun abonnement|sans abonnement/i)
  })

  it('ne redirige pas vers l’activation', async () => {
    renderPublicPage()

    await screen.findByRole('heading', { name: /temporairement indisponible/i })
    expect(screen.queryByRole('link', { name: /Activer mon TAGGO/ })).not.toBeInTheDocument()
  })

  it('reste distinct d’un TAGGO introuvable', async () => {
    getPublicTaggoState.mockResolvedValue('not_found')

    renderPublicPage()

    expect(await screen.findByRole('heading', { name: 'QR introuvable' })).toBeInTheDocument()
  })
})
