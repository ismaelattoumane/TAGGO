import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { TaggoAnalyticsPanel } from './TaggoAnalyticsPanel'
import { ScanChart } from './ScanChart'

/**
 * ÉTAPE 11 — Tests d'interface du panneau d'analytics.
 *
 * `fetchTaggoScanStats` est simulé : on vérifie les états affichés, la
 * cohérence des chiffres, et l'accessibilité du graphique. Les valeurs sont des
 * doubles de test (jamais des statistiques réelles).
 */

const fetchTaggoScanStats = vi.fn()

vi.mock('./scanClient', async () => {
  const actual = await vi.importActual<typeof import('./scanClient')>('./scanClient')
  return { ...actual, fetchTaggoScanStats: (qrId: string, days: number) => fetchTaggoScanStats(qrId, days) }
})

const QR_ID = '11111111-1111-4111-8111-111111111111'
const PUBLIC_ID = 'TGG-ABCD234'

const SAMPLE_STATS = {
  total: 12,
  today: 2,
  last7: 5,
  last30: 9,
  days: 30 as const,
  bucket: 'day' as const,
  series: [
    { bucketStart: '2026-09-29T00:00:00+00:00', scans: 1 },
    { bucketStart: '2026-09-30T00:00:00+00:00', scans: 3 },
    { bucketStart: '2026-10-01T00:00:00+00:00', scans: 0 },
  ],
  recent: [
    { scannedAt: '2026-10-01T12:00:00+00:00' },
    { scannedAt: '2026-10-01T11:00:00+00:00' },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
})

function renderPanel() {
  return render(<TaggoAnalyticsPanel qrId={QR_ID} publicId={PUBLIC_ID} />)
}

describe('état de chargement', () => {
  it('affiche un statut de chargement avant toute donnée', () => {
    fetchTaggoScanStats.mockReturnValue(new Promise(() => undefined))

    renderPanel()

    expect(screen.getByRole('status')).toHaveTextContent('Chargement des scans')
    // Aucun chiffre n'est affiché tant que le serveur n'a pas répondu.
    expect(screen.queryByText('Total des scans')).not.toBeInTheDocument()
  })
})

describe('TAGGO sans scan', () => {
  it('affiche « Pas encore de scans » plutôt que des zéros ambigus', async () => {
    fetchTaggoScanStats.mockResolvedValue({
      ok: true,
      stats: { total: 0, today: 0, last7: 0, last30: 0, days: 30, bucket: 'day', series: [], recent: [] },
    })

    renderPanel()

    expect(await screen.findByText('Pas encore de scans')).toBeInTheDocument()
    expect(screen.queryByText('Total des scans')).not.toBeInTheDocument()
  })
})

describe('statistiques disponibles', () => {
  beforeEach(() => {
    fetchTaggoScanStats.mockResolvedValue({ ok: true, stats: SAMPLE_STATS })
  })

  it('affiche total, aujourd’hui, 7 jours et 30 jours', async () => {
    renderPanel()

    const total = await screen.findByText('Total des scans')
    expect(total.parentElement).toHaveTextContent('12')
    expect(screen.getByText('Aujourd’hui (UTC)').parentElement).toHaveTextContent('2')
    expect(screen.getByText('7 derniers jours').parentElement).toHaveTextContent('5')
    expect(screen.getByText('30 derniers jours').parentElement).toHaveTextContent('9')
  })

  it('précise que « aujourd’hui » est calculé en UTC', async () => {
    renderPanel()
    expect(await screen.findByText('Aujourd’hui (UTC)')).toBeInTheDocument()
  })

  it('liste les scans récents avec leur horodatage', async () => {
    renderPanel()

    const heading = await screen.findByText('Scans récents')
    const list = heading.parentElement?.querySelector('ul')
    expect(list).not.toBeNull()
    expect(within(list as HTMLElement).getAllByRole('listitem')).toHaveLength(2)
  })

  it('rappelle les données volontairement non collectées', async () => {
    renderPanel()
    expect(
      await screen.findByText(/Aucune adresse IP, aucun appareil et aucun profil de visiteur/i),
    ).toBeInTheDocument()
  })

  it('résume le graphique en toutes lettres pour les lecteurs d’écran', async () => {
    renderPanel()

    expect(await screen.findByText(/4 scans au total sur la période/)).toBeInTheDocument()
  })

  it('a un titre de section et un titre de graphique accessibles', async () => {
    renderPanel()

    expect(await screen.findByRole('heading', { level: 2, name: `Scans de ${PUBLIC_ID}` })).toBeInTheDocument()
    const chart = screen.getByRole('img')
    expect(chart).toHaveAccessibleName(/Évolution des scans/i)
  })

  it('redemande les données quand la période change', async () => {
    renderPanel()
    await screen.findByText('Total des scans')

    fetchTaggoScanStats.mockClear()
    fireEvent.change(screen.getByLabelText('Période'), { target: { value: '90' } })

    await waitFor(() => expect(fetchTaggoScanStats).toHaveBeenCalledWith(QR_ID, 90))
  })

  it('propose exactement 7, 30 et 90 jours', async () => {
    renderPanel()
    await screen.findByText('Total des scans')

    const options = within(screen.getByLabelText('Période')).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual(['7 jours', '30 jours', '90 jours'])
  })
})

describe('état d’erreur', () => {
  it('affiche le message du serveur et permet de réessayer', async () => {
    fetchTaggoScanStats.mockResolvedValue({ ok: false, reason: 'analytics_unavailable' })

    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent('Les analytics sont temporairement indisponibles.')
    expect(screen.queryByText('Total des scans')).not.toBeInTheDocument()

    fetchTaggoScanStats.mockResolvedValue({ ok: true, stats: SAMPLE_STATS })
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Total des scans')).toBeInTheDocument()
  })

  it('distingue « pas votre TAGGO » d’une panne', async () => {
    fetchTaggoScanStats.mockResolvedValue({ ok: false, reason: 'not_owner' })

    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent('Ce TAGGO n’apparaît pas dans votre compte.')
  })

  it('indique une session expirée', async () => {
    fetchTaggoScanStats.mockResolvedValue({ ok: false, reason: 'unauthenticated' })

    renderPanel()

    expect(await screen.findByRole('alert')).toHaveTextContent(/Session expirée/i)
  })
})

describe('graphique', () => {
  it('affiche un état « pas encore de scans » si la série est vide', () => {
    render(<ScanChart series={[]} label="Évolution" formatBucket={() => '01 oct.'} />)

    expect(screen.getByRole('status')).toHaveTextContent('Pas encore de scans sur cette période.')
  })

  it('affiche un état vide si la série ne contient que des zéros', () => {
    render(
      <ScanChart
        series={[{ bucketStart: '2026-10-01T00:00:00+00:00', scans: 0 }]}
        label="Évolution"
        formatBucket={() => '01 oct.'}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Pas encore de scans sur cette période.')
  })

  it('propose un tableau de valeurs — l’information ne repose pas sur la couleur', () => {
    render(
      <ScanChart
        series={[
          { bucketStart: '2026-10-01T00:00:00+00:00', scans: 4 },
          { bucketStart: '2026-10-02T00:00:00+00:00', scans: 7 },
        ]}
        label="Évolution des scans"
        formatBucket={(value) => value.slice(0, 10)}
      />,
    )

    const table = screen.getByRole('table')
    expect(within(table).getByRole('rowheader', { name: '2026-10-01' })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: '2026-10-02' })).toBeInTheDocument()
  })

  it('décrit le graphique aux lecteurs d’écran', () => {
    render(
      <ScanChart
        series={[{ bucketStart: '2026-10-01T00:00:00+00:00', scans: 3 }]}
        label="Évolution des scans de TGG-ABCD234 sur les 30 derniers jours"
        formatBucket={() => '01 oct.'}
      />,
    )

    const chart = screen.getByRole('img')
    expect(chart).toHaveAccessibleName(/Évolution des scans de TGG-ABCD234/)
    expect(chart).toHaveAccessibleDescription(/3 scans au total/)
  })
})
