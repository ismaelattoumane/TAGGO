import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import { FaqAccordion } from '../faq/FaqAccordion'
import './FaqSection.css'
import { FAQ_ITEMS } from './landingFaqItems'

/**
 * TAGGO FAQ — accordéon accessible partagé avec la page `/faq`.
 */
export function FaqSection() {
  return (
    <section
      id="faq"
      className="taggo-landing-section taggo-landing-section--solid taggo-faq-section"
      aria-labelledby="faq-heading"
    >
      <Container size="md">
        <div className="taggo-faq-header">
          <Reveal>
            <span className="taggo-eyebrow">FAQ</span>
          </Reveal>
          <Reveal delay={100}>
            <h2 id="faq-heading" className="taggo-landing-heading">
              Questions fréquentes
            </h2>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div className="taggo-faq-list">
            <FaqAccordion items={FAQ_ITEMS} idPrefix="landing-faq" headingLevel={3} />
          </div>
        </Reveal>

        <Reveal delay={300}>
          <p className="taggo-faq-header">
            <a className="taggo-button taggo-button--ghost" href="/faq">
              Voir toutes les questions
            </a>
          </p>
        </Reveal>
      </Container>
    </section>
  )
}