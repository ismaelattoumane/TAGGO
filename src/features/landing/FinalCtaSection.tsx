import { Link } from 'react-router-dom'
import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './FinalCtaSection.css'

/**
 * TAGGO Final CTA — strong visual presence, premium feel.
 */
export function FinalCtaSection() {
  return (
    <section
      id="final-cta"
      className="taggo-landing-section taggo-landing-section--solid taggo-finalcta-section"
      aria-labelledby="finalcta-heading"
    >
      <Container size="md">
        <div className="taggo-finalcta-card">
          <Reveal>
            <h2 id="finalcta-heading" className="taggo-finalcta-heading">
              Prêt à créer ton TAGGO ?
            </h2>
          </Reveal>
          <Reveal delay={150}>
            <p className="taggo-finalcta-text">
              Ton T-shirt. Ton identité. Ton monde. Commence en quelques minutes.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <Link
              to="/register"
              className="taggo-button taggo-button--primary taggo-finalcta-button"
            >
              Créer mon TAGGO
            </Link>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
