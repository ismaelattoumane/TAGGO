import { EXPERIENCE_CONTENT } from './experience/experienceContent'
import './PhoneCard.css'

const { destination, dashboard } = EXPERIENCE_CONTENT.panels
const SELECTED_DESTINATION = 'WhatsApp'

/**
 * Carte « téléphone » des sections (aperçu décoratif). Elle reprend les mêmes données d’exemple
 * que la maquette du hero (experienceContent.ts) : une seule source de vérité pour les textes.
 */
export function PhoneCard({ variant }: { variant: 'destination' | 'dashboard' }) {
  const panel = variant === 'destination' ? destination : dashboard
  return (
    <div className="taggo-phone-card" aria-hidden="true">
      <header className="taggo-phone-card__head">
        <b>TAGGO</b>
        <span>{panel.badge}</span>
      </header>
      <h3>{panel.title}</h3>
      <p>{panel.intro}</p>
      {variant === 'destination' ? (
        <ul className="taggo-phone-card__list">
          {destination.options.map((label) => (
            <li key={label} data-selected={label === SELECTED_DESTINATION ? 'true' : undefined}>
              {label}
            </li>
          ))}
        </ul>
      ) : (
        <dl className="taggo-phone-card__stats">
          {dashboard.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd data-ok={label === 'Statut' ? 'true' : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
