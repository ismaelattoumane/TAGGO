import { Link } from 'react-router-dom'
import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './FinalCtaSection.css'

/**
 * TAGGO Final CTA — bandeau sombre qui clôt la landing.
 */
export function FinalCtaSection() {
  return (
    <section
      id="final-cta"
      className="taggo-landing-section taggo-landing-section--dark taggo-finalcta-section"
      aria-labelledby="finalcta-heading"
    >
      <Container size="md">
        <div className="taggo-finalcta-inner">
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
            <div className="taggo-finalcta-actions">
              <Link
                to="/register"
                className="taggo-button taggo-button--primary taggo-finalcta-button"
              >
                Créer mon TAGGO
              </Link>
              <a className="taggo-button taggo-button--ghost" href="#concept">
                Découvrir TAGGO
              </a>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
