import { useId } from 'react'
import type { ScanPoint } from './analyticsTypes'
import './ScanChart.css'

/**
 * ÉTAPE 11 — Graphique d'évolution des scans.
 *
 * AUCUNE dépendance ajoutée : le projet n'embarque pas de librairie de
 * graphiques, et un graphique à barres simple ne justifie pas d'en ajouter une
 * (recharts ≈ +100 kB au bundle). Le rendu est fait en SVG inline, donc
 * lisible au premier coup dans le dashboard existant.
 *
 * ACCESSIBILITÉ :
 * - l'information n'est jamais portée par la couleur seule : chaque barre a une
 *   étiquette de valeur, et un tableau de données complet est rendu sous le
 *   graphique pour les lecteurs d'écran ;
 * - `<figure>` + `<figcaption>` + `role="img"` + `<title>`/`desc` ;
 * - si tous les buckets sont à zéro, un état « aucun scan » explicite est
 *   affiché plutôt qu'un graphique vide sans explication.
 */

const VIEW_WIDTH = 720
const VIEW_HEIGHT = 200
const PADDING = { top: 16, right: 8, bottom: 8, left: 8 }
const MIN_BAR_WIDTH = 3

export type ScanChartProps = {
  series: ScanPoint[]
  /** Libellé du graphique, utilisé comme titre accessible. */
  label: string
  /** Formatteur de date pour les étiquettes d'axe. */
  formatBucket: (bucketStart: string) => string
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
}

export function ScanChart({ series, label, formatBucket }: ScanChartProps) {
  const titleId = useId()
  const descId = useId()

  const maxScans = series.reduce((max, point) => Math.max(max, point.scans), 0)
  const total = series.reduce((sum, point) => sum + point.scans, 0)

  if (series.length === 0 || total === 0) {
    return (
      <p className="taggo-scan-chart__empty" role="status">
        Pas encore de scans sur cette période.
      </p>
    )
  }

  const innerWidth = VIEW_WIDTH - PADDING.left - PADDING.right
  const innerHeight = VIEW_HEIGHT - PADDING.top - PADDING.bottom
  const slot = innerWidth / series.length
  const barWidth = Math.max(MIN_BAR_WIDTH, slot - 4)
  const baseline = PADDING.top + innerHeight

  const linePoints = series.map((point, index) => {
    const height = maxScans > 0 ? (point.scans / maxScans) * innerHeight : 0
    return {
      x: PADDING.left + slot * index + slot / 2,
      y: baseline - height,
      height,
      point,
    }
  })

  // Une étiquette d'axe tous les ~8 buckets : au-delà, le texte se chevauche.
  const labelStride = Math.max(1, Math.ceil(series.length / 8))
  const summary = `${formatCount(total)} scans au total sur la période, pic de ${formatCount(maxScans)} scans sur un intervalle.`

  return (
    <figure className="taggo-scan-chart">
      <svg
        className="taggo-scan-chart__svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>{label}</title>

        <line
          className="taggo-scan-chart__baseline"
          x1={PADDING.left}
          y1={baseline}
          x2={VIEW_WIDTH - PADDING.right}
          y2={baseline}
        />

        <path
          className="taggo-scan-chart__line"
          d={buildPath(linePoints.map(({ x, y }) => ({ x, y })))}
          fill="none"
        />

        {linePoints.map(({ x, y, height, point }, index) => (
          <g key={point.bucketStart}>
            <rect
              className="taggo-scan-chart__bar"
              x={x - barWidth / 2}
              y={y}
              width={barWidth}
              height={Math.max(height, height > 0 ? 2 : 0)}
              rx={2}
            />
            <title>
              {`${formatBucket(point.bucketStart)} : ${formatCount(point.scans)} scan${point.scans > 1 ? 's' : ''}`}
            </title>
            {index % labelStride === 0 ? (
              <text className="taggo-scan-chart__tick" x={x} y={VIEW_HEIGHT - 1} textAnchor="middle">
                {formatBucket(point.bucketStart)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>

      {/* Légende visible ET description du graphique pour les lecteurs d'écran. */}
      <figcaption className="taggo-scan-chart__summary" id={descId}>
        {summary}
      </figcaption>

      {/* Équivalent textuel complet : l'information ne repose jamais sur la
          couleur ni sur la seule lecture du graphique. */}
      <details className="taggo-scan-chart__table">
        <summary>Voir les valeurs</summary>
        <table>
          <caption className="taggo-scan-chart__caption">{label}</caption>
          <thead>
            <tr>
              <th scope="col">Période</th>
              <th scope="col">Scans</th>
            </tr>
          </thead>
          <tbody>
            {series.map((point) => (
              <tr key={point.bucketStart}>
                <th scope="row">{formatBucket(point.bucketStart)}</th>
                <td>{formatCount(point.scans)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
