import { EXPERIENCE_CONTENT } from './experienceContent'

const { profile, destination, dashboard, usages } = EXPERIENCE_CONTENT.panels

function PanelHeader({ badge }: { badge: string }) {
  return (
    <header className="tg-xp__panel-head">
      <b>TAGGO</b>
      <span>{badge}</span>
    </header>
  )
}

/**
 * Maquette de téléphone de l’expérience : un seul appareil, quatre écrans
 * (profil → destination → dashboard → usages) qui se succèdent sur la timeline.
 * Décoratif : le contenu équivalent est présent dans les sections de la page.
 */
export function DevicePanels() {
  return (
    <div data-xp="device" className="tg-xp__device" aria-hidden="true">
      <div data-xp="panel" className="tg-xp__panel">
        <PanelHeader badge={profile.badge} />
        <h3>{profile.handle}</h3>
        <p>{profile.intro}</p>
        <ul className="tg-xp__links">
          {profile.links.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
      </div>

      <div data-xp="panel" className="tg-xp__panel">
        <PanelHeader badge={destination.badge} />
        <h3>{destination.title}</h3>
        <p>{destination.intro}</p>
        <div className="tg-xp__dest">
          <span className="tg-xp__sel" />
          <ul className="tg-xp__links">
            {destination.options.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </div>
      </div>

      <div data-xp="panel" className="tg-xp__panel">
        <PanelHeader badge={dashboard.badge} />
        <h3>{dashboard.title}</h3>
        <p>{dashboard.intro}</p>
        <dl className="tg-xp__stats">
          {dashboard.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={label === 'Statut' ? 'tg-xp__ok' : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div data-xp="panel" className="tg-xp__panel">
        <PanelHeader badge={usages.badge} />
        <div className="tg-xp__uses">
          {usages.items.map(([title, text]) => (
            <div key={title}>
              <b>{title}</b>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
