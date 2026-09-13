import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './DashboardPreviewSection.css'

/**
 * TAGGO Dashboard Preview — realistic owner dashboard UI.
 */
export function DashboardPreviewSection() {
  return (
    <section
      id="dashboard"
      className="taggo-landing-section taggo-dash-section"
      aria-labelledby="dash-heading"
    >
      <Container size="lg">
        <div className="taggo-dash-header">
          <Reveal>
            <span className="taggo-eyebrow">Tableau de bord</span>
          </Reveal>
          <Reveal delay={100}>
            <h2 id="dash-heading" className="taggo-landing-heading">
              Un espace tout compris.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="taggo-landing-subheading taggo-landing-subheading--center">
              suis tes scans, modifie ta destination, gère tes paramètres —
              depuis un seul endroit.
            </p>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div className="taggo-dash-preview" aria-hidden="true">
            <div className="taggo-dash-preview__card">
              {/* Top bar */}
              <div className="taggo-dash-preview__topbar">
                <span className="taggo-dash-preview__brand">TAGGO</span>
                <Badge text="Premium" />
              </div>

              {/* Stats row */}
              <div className="taggo-dash-preview__stats">
                <StatCard value="127" label="Scans" />
                <StatCard value="89" label="Clicks" />
                <StatCard value="Actif" label="Statut" />
              </div>

              {/* TAGGO list */}
              <div className="taggo-dash-preview__taggos">
                <div className="taggo-dash-preview__taggo-row">
                  <div>
                    <p className="taggo-dash-preview__taggo-id">TGG-8K9L2R7</p>
                    <p className="taggo-dash-preview__taggo-url">
                      taggo.fr/alex
                    </p>
                  </div>
                  <span className="taggo-dash-preview__badge taggo-dash-preview__badge--active">
                    Actif
                  </span>
                  <span className="taggo-dash-preview__edit">Modifier</span>
                </div>
                <div className="taggo-dash-preview__taggo-row">
                  <div>
                    <p className="taggo-dash-preview__taggo-id">TGG-3M5N8P2</p>
                    <p className="taggo-dash-preview__taggo-url">
                      taggo.fr/event
                    </p>
                  </div>
                  <span className="taggo-dash-preview__badge taggo-dash-preview__badge--draft">
                    Brouillon
                  </span>
                  <span className="taggo-dash-preview__edit">Modifier</span>
                </div>
              </div>

              {/* Recent scans */}
              <div className="taggo-dash-preview__recent">
                <p className="taggo-dash-preview__recent-title">Scans récents</p>
                <div className="taggo-dash-preview__scan-bar" style={{ width: '85%' }} />
                <div className="taggo-dash-preview__scan-bar" style={{ width: '60%' }} />
                <div className="taggo-dash-preview__scan-bar" style={{ width: '45%' }} />
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}

function Badge({ text }: { text: string }) {
  return <span className="taggo-dash-preview__pill">{text}</span>
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="taggo-dash-preview__stat">
      <span className="taggo-dash-preview__stat-value">{value}</span>
      <span className="taggo-dash-preview__stat-label">{label}</span>
    </div>
  )
}
