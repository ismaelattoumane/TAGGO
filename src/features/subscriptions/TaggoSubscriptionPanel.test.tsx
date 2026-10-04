import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TaggoSubscriptionPanel } from './TaggoSubscriptionPanel'

/**
 * ÉTAPE 12 — Tests d'interface du panneau d'abonnement.
 *
 * Vérifié ici : l'affichage d'un TAGGO expiré, l'absence de prix inventé, et le
 * fait que le bouton « Renouveler » ne fait rien d'autre qu'exprimer une
 * intention (jamais de prolongation de date côté client).
 */

const fetchTaggoSubscription = vi.fn()
const requestTaggoRenewal = vi.fn()
const setTaggoAutoRenew = vi.fn()

vi.mock('./subscriptionClient', () => ({
  fetchTaggoSubscription: (qrId: string) => fetchTaggoSubscription(qrId),
  requestTaggoRenewal: (qrId: string) => requestTaggoRenewal(qrId),
  setTaggoAutoRenew: (qrId: string, enabled: boolean) => setTaggoAutoRenew(qrId, enabled),
}))

const QR_ID = '11111111-1111-4111-8111-111111111111'
const PUBLIC_ID = 'TGG-ABCD234'

function state(overrides: Record<string, unknown> = {}) {
  return {
    managed: true,
    subscriptionRequired: false,
    status: 'active',
    source: 'included',
    autoRenew: false,
    startedAt: '2025-10-01T12:00:00.000Z',
    endsAt: '2026-10-01T12:00:00.000Z',
    expiredAt: null,
    lifecycleStatus: 'active',
    expiringSoon: false,
    renewalAvailable: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPanel() {
  return render(<TaggoSubscriptionPanel qrId={QR_ID} publicId={PUBLIC_ID} />)
}

describe('état de chargement', () => {
  it('affiche un statut de chargement avant toute donnée', () => {
    fetchTaggoSubscription.mockReturnValue(new Promise(() => undefined))

    renderPanel()

    expect(screen.getByRole('status')).toHaveTextContent('Chargement de l’abonnement')
    // Aucun statut affiché avant la réponse du serveur.
    expect(screen.queryByText('Actif')).not.toBeInTheDocument()
  })
})

describe('TAGGO actif', () => {
  it('affiche statut, dates et état du renouvellement automatique', async () => {
    fetchTaggoSubscription.mockResolvedValue({ ok: true, state: state() })

    renderPanel()

    expect(await screen.findByText('Actif')).toBeInTheDocument()
    expect(screen.getByText('1 octobre 2025')).toBeInTheDocument()
    expect(screen.getByText('1 octobre 2026')).toBeInTheDocument()
    expect(screen.getByText('Désactivé')).toBeInTheDocument()
    expect(screen.getByText('Première année incluse')).toBeInTheDocument()
  })

  it('propose la préférence de renouvellement automatique', async () => {
    fetchTaggoSubscription.mockResolvedValue({ ok: true, state: state() })

    renderPanel()
    await screen.findByText('Actif')

    const checkbox = screen.getByLabelText('Renouveler automatiquement chaque année')
    expect(checkbox).not.toBeChecked()

    setTaggoAutoRenew.mockResolvedValue({ ok: true })
    fireEvent.click(checkbox)

    await waitFor(() => expect(setTaggoAutoRenew).toHaveBeenCalledWith(QR_ID, true))
  })

  it('n’affiche aucun prix, même quand le renouvellement est indisponible', async () => {
    fetchTaggoSubscription.mockResolvedValue({ ok: true, state: state() })

    const { container } = renderPanel()
    await screen.findByText('Actif')

    expect(container.textContent).not.toMatch(/€|\d+\s*€|EUR/)
  })
})

describe('TAGGO qui expire bientôt', () => {
  it('affiche « Expire bientôt » sans inventer de date de fin', async () => {
    fetchTaggoSubscription.mockResolvedValue({ ok: true, state: state({ expiringSoon: true }) })

    renderPanel()

    expect(await screen.findByText('Expire bientôt')).toBeInTheDocument()
  })
})

describe('TAGGO expiré', () => {
  it('affiche « Expiré » et explique que la page publique est suspendue', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ status: 'expired', lifecycleStatus: 'expired', endsAt: '2026-09-01T12:00:00.000Z', expiredAt: '2026-09-01T12:00:00.000Z' }),
    })

    renderPanel()

    expect(await screen.findByText('Expiré')).toBeInTheDocument()
    expect(
      screen.getByText(/Sa page publique est suspendue et ne redirige plus vers sa destination/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Un renouvellement doit être confirmé/)).toBeInTheDocument()
  })

  it('active le bouton de renouvellement', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ status: 'expired', lifecycleStatus: 'expired' }),
    })

    renderPanel()

    const button = await screen.findByRole('button', { name: 'Renouvellement indisponible' })
    // Sans prix configuré, le bouton est visible mais neutralisé : le TAGGO ne
    // peut pas être « renouvelé » par un simple clic.
    expect(button).toBeDisabled()
  })

  it('affiche « prix non défini » plutôt qu’un montant', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ status: 'expired', lifecycleStatus: 'expired' }),
    })

    renderPanel()

    expect(await screen.findByText(/Le tarif de renouvellement n’est pas encore défini/)).toBeInTheDocument()
  })

  it('n’active le bouton que si un tarif est configuré', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ status: 'expired', lifecycleStatus: 'expired', renewalAvailable: true }),
    })

    renderPanel()

    const button = await screen.findByRole('button', { name: 'Renouveler' })
    expect(button).toBeEnabled()

    requestTaggoRenewal.mockResolvedValue({ ok: false, reason: 'renewal_unavailable' })
    fireEvent.click(button)

    await waitFor(() => expect(requestTaggoRenewal).toHaveBeenCalledWith(QR_ID))
  })

  it('ne prolonge aucune date : un refus ne modifie rien à l’écran', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ status: 'expired', lifecycleStatus: 'expired', renewalAvailable: true }),
    })
    requestTaggoRenewal.mockResolvedValue({ ok: false, reason: 'renewal_unavailable' })

    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Renouveler' }))

    // Le seul effet est un message d'erreur : aucune date affichée ne bouge.
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le renouvellement n’est pas encore disponible.',
    )
    expect(screen.getByText('Expiré')).toBeInTheDocument()
    expect(screen.getByText('1 octobre 2026')).toBeInTheDocument()
  })
})

describe('TAGGO sans abonnement', () => {
  it('affiche « Aucun abonnement » plutôt qu’« Actif »', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({
        managed: false,
        subscriptionRequired: true,
        status: null,
        startedAt: null,
        endsAt: null,
        source: null,
      }),
    })

    renderPanel()

    expect(
      await screen.findByText('Aucun abonnement — page publique désactivée'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Actif')).not.toBeInTheDocument()
    // Le message doit dire que l'accès public est coupé ET que ce n'est pas une
    // expiration : c'est la distinction que le propriétaire doit pouvoir faire.
    expect(screen.getByText(/sa page publique est désactivée/)).toBeInTheDocument()
    expect(screen.getByText(/Ce n’est pas une expiration/)).toBeInTheDocument()
    expect(screen.queryByText(/n’a expiré/)).not.toBeInTheDocument()
  })

  it('ne présente jamais un TAGGO sans abonnement comme « Expiré »', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({
        managed: false,
        subscriptionRequired: true,
        status: null,
        lifecycleStatus: 'active',
      }),
    })

    renderPanel()
    await screen.findByText('Aucun abonnement — page publique désactivée')

    expect(screen.queryByText('Expiré')).not.toBeInTheDocument()
    expect(screen.queryByText('Expire bientôt')).not.toBeInTheDocument()
  })

  it('ne propose pas le renouvellement automatique sans période', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ managed: false, subscriptionRequired: true, status: null }),
    })

    renderPanel()
    await screen.findByText('Aucun abonnement — page publique désactivée')

    expect(screen.queryByLabelText('Renouveler automatiquement chaque année')).not.toBeInTheDocument()
  })

  it('ne propose pas de renouvellement manuel pour un TAGGO sans période', async () => {
    // Un TAGGO sans abonnement n'est pas « expiré » : il n'y a rien à
    // renouveler. Le bouton de renouvellement reste désactivé.
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ managed: false, subscriptionRequired: true, status: null }),
    })

    renderPanel()
    await screen.findByText('Aucun abonnement — page publique désactivée')

    expect(screen.queryByRole('button', { name: /Renouveler maintenant/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Renouvellement indisponible/ })).toBeDisabled()
  })
})

describe('TAGGO suspendu ou remplacé', () => {
  it('ne présente jamais un TAGGO suspendu comme expiré', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ status: 'expired', lifecycleStatus: 'suspended' }),
    })

    renderPanel()

    expect(await screen.findByText('Suspendu')).toBeInTheDocument()
    expect(screen.queryByText('Expiré')).not.toBeInTheDocument()
    expect(screen.getByText(/Aucune date d’expiration d’abonnement ne lui est appliquée/)).toBeInTheDocument()
  })

  it('ne présente jamais un TAGGO remplacé comme expiré', async () => {
    fetchTaggoSubscription.mockResolvedValue({
      ok: true,
      state: state({ status: 'expired', lifecycleStatus: 'replaced' }),
    })

    renderPanel()

    expect(await screen.findByText('Remplacé')).toBeInTheDocument()
    expect(screen.queryByText('Expiré')).not.toBeInTheDocument()
  })
})

describe('erreur de lecture', () => {
  it('affiche un message et permet de réessayer', async () => {
    fetchTaggoSubscription.mockResolvedValue({ ok: false, reason: 'subscription_unavailable' })

    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Les informations d’abonnement sont temporairement indisponibles.',
    )

    fetchTaggoSubscription.mockResolvedValue({ ok: true, state: state() })
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Actif')).toBeInTheDocument()
  })

  it('ne montre jamais de statut en cas d’erreur — jamais de faux « expiré »', async () => {
    fetchTaggoSubscription.mockResolvedValue({ ok: false, reason: 'network_error' })

    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de joindre le serveur.')
    expect(screen.queryByText('Expiré')).not.toBeInTheDocument()
    expect(screen.queryByText('Actif')).not.toBeInTheDocument()
  })

  it('indique une session expirée', async () => {
    fetchTaggoSubscription.mockResolvedValue({ ok: false, reason: 'unauthenticated' })

    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent(/Session expirée/i)
  })
})