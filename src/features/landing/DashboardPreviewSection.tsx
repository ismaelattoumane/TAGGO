import { Container } from '../../components/ui/Layout/Layout'
import { PhoneCard } from './PhoneCard'
import { Reveal } from './Reveal'
import './DashboardPreviewSection.css'

/**
 * TAGGO Dashboard Preview — realistic owner dashboard UI.
 */
export function DashboardPreviewSection() {
  return (
    <section
      id="dashboard"
      className="taggo-landing-section taggo-landing-section--panel taggo-dash-section"
      aria-labelledby="dash-heading"
    >
      <Container size="lg">
        <div className="taggo-landing-grid-2">
          <Reveal delay={200}>
            <div className="taggo-dash-preview">
              <PhoneCard variant="dashboard" />
            </div>
          </Reveal>

          <div>
            <Reveal>
              <span className="taggo-eyebrow">Tableau de bord</span>
            </Reveal>
            <Reveal delay={100}>
              <h2 id="dash-heading" className="taggo-landing-heading">
                Tout contrôler depuis un seul endroit.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="taggo-landing-subheading">
                Suis tes scans, modifie ta destination, gère tes paramètres et ton
                QR, depuis un seul endroit. (Données d'exemple.)
              </p>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  )
}
