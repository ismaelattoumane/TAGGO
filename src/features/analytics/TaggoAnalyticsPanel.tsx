import { useEffect, useState } from 'react'
import { Card } from '../../components/ui/Card/Card'
import { EmptyState } from '../../components/ui/State/State'
import { Eyebrow } from '../../components/ui/Typography/Typography'
import { SelectField } from '../../components/ui/Field/Field'
import { ScanChart } from './ScanChart'
import { formatBucketDay, formatBucketWeek, formatScanTimestamp } from './scanFormat'
import { fetchTaggoScanStats } from './scanClient'
import {
  SCAN_PERIODS,
  scanStatsErrorMessage,
  type ScanPeriodDays,
  type TaggoScanStats,
} from './analyticsTypes'

/**
 * ÉTAPE 11 — Panneau d'analytics d'un TAGGO, intégré au dashboard existant.
 *
 * Aucune application analytics séparée : ce panneau vit dans la page de
 * détail d'un TAGGO (`/dashboard/qr/:qrId`), à côté de sa configuration.
 *
 * États couverts : chargement, erreur, « pas encore de scans », données.
 * Aucune information n'est affichée avant que le serveur ait répondu : en cas
 * d'échec, l'utilisateur voit un message et un bouton pour réessayer, jamais un
 * chiffre à zéro qui pourrait être confondu avec « aucun scan ».
 */

export type TaggoAnalyticsPanelProps = {
  qrId: string
  publicId: string
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

export function TaggoAnalyticsPanel({ qrId, publicId }: TaggoAnalyticsPanelProps) {
  const [days, setDays] = useState<ScanPeriodDays>(30)
  const [stats, setStats] = useState<TaggoScanStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!qrId) return

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')

      const result = await fetchTaggoScanStats(qrId, days)
      if (cancelled) return

      if (result.ok) {
        setStats(result.stats)
      } else {
        // Le message vient du serveur, jamais d'une donnée technique.
        setError(scanStatsErrorMessage(result.reason))
        setStats(null)
      }
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [qrId, days, reloadToken])

  const formatBucket = stats?.bucket === 'week' ? formatBucketWeek : formatBucketDay
  const hasNoScanAtAll = stats !== null && stats.total === 0

  return (
    <Card as="section" className="taggo-analytics" aria-labelledby="taggo-analytics-title">
      <div className="panel-header">
        <div>
          <Eyebrow>Statistiques de scans</Eyebrow>
          <h2 id="taggo-analytics-title">Scans de {publicId}</h2>
        </div>
        <div className="filter-control">
          <SelectField
            id="taggo-analytics-period"
            label="Période"
            value={String(days)}
            onChange={(event) => setDays(Number(event.target.value) as ScanPeriodDays)}
          >
            {SCAN_PERIODS.map((period) => (
              <option key={period.days} value={period.days}>
                {period.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {loading ? (
        <p role="status" aria-busy="true">
          Chargement des scans...
        </p>
      ) : error ? (
        <div>
          <p role="alert" className="form-error">
            {error}
          </p>
          <button
            type="button"
            className="ghost-button"
            onClick={() => setReloadToken((token) => token + 1)}
          >
            Réessayer
          </button>
        </div>
      ) : hasNoScanAtAll ? (
        <EmptyState
          title="Pas encore de scans"
          description={`Aucune personne n'a encore scanné ce TAGGO depuis sa mise en service. Les statistiques apparaîtront ici dès le premier scan.`}
        />
      ) : stats ? (
        <>
          <div className="stats-grid">
            <article className="stat-card">
              <span>Total des scans</span>
              <strong>{formatCount(stats.total)}</strong>
            </article>
            <article className="stat-card">
              <span>Aujourd’hui (UTC)</span>
              <strong>{formatCount(stats.today)}</strong>
            </article>
            <article className="stat-card">
              <span>7 derniers jours</span>
              <strong>{formatCount(stats.last7)}</strong>
            </article>
            <article className="stat-card">
              <span>30 derniers jours</span>
              <strong>{formatCount(stats.last30)}</strong>
            </article>
          </div>

          <h3>Évolution sur {days} jours</h3>
          <ScanChart
            series={stats.series}
            label={`Évolution des scans de ${publicId} sur les ${days} derniers jours`}
            formatBucket={formatBucket}
          />

          <h3>Scans récents</h3>
          {stats.recent.length === 0 ? (
            <p>Aucun scan récent à afficher.</p>
          ) : (
            <ul className="taggo-analytics__recent">
              {stats.recent.map((scan) => (
                <li key={scan.scannedAt}>
                  <time dateTime={scan.scannedAt}>{formatScanTimestamp(scan.scannedAt)}</time>
                </li>
              ))}
            </ul>
          )}

          <p className="taggo-analytics__note">
            Seuls le TAGGO et la date du scan sont enregistrés. Aucune adresse IP,
            aucun appareil et aucun profil de visiteur n&apos;est conservé.
          </p>
        </>
      ) : null}
    </Card>
  )
}
