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
              Tout contrôler depuis un seul endroit.
            </h2>
          </Reveal>
          <Reveal delay={200}>
            <p className="taggo-landing-subheading taggo-landing-subheading--center">
              Suis tes scans, modifie ta destination, gère tes paramètres et ton QR,
              depuis un seul endroit.
            </p>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <PhoneCard variant="dashboard" />
        </Reveal>
      </Container>
    </section>
  )
}
