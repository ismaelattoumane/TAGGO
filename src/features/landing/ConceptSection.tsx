import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './ConceptSection.css'

/**
 * TAGGO Concept — explains the product in seconds.
 * Visual: QR → T-shirt → digital profile (static, no 3D).
 */
export function ConceptSection() {
  return (
    <section
      id="concept"
      className="taggo-landing-section taggo-concept-section"
      aria-labelledby="concept-heading"
    >
      <Container size="lg">
        <div className="taggo-landing-grid-2">
          <div>
            <Reveal>
              <span className="taggo-eyebrow">Le concept</span>
            </Reveal>
            <Reveal delay={100}>
              <h2 id="concept-heading" className="taggo-landing-heading">
                Ton vêtement devient ton identité digitale.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="taggo-landing-subheading">
                Un T-shirt TAGGO possède un QR code unique. Quelqu'un scanne le
                QR et accède instantanément à une page personnalisée. Tu peux
                modifier cette destination à tout moment depuis ton espace
                TAGGO.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <ul className="taggo-concept-list">
                <li className="taggo-concept-list__item">
                  <span className="taggo-concept-list__icon" aria-hidden="true">
                    ◈
                  </span>
                  Un QR code unique, relié à ton profil
                </li>
                <li className="taggo-concept-list__item">
                  <span className="taggo-concept-list__icon" aria-hidden="true">
                    ◈
                  </span>
                  Une page publique personnalisable à l'infini
                </li>
                <li className="taggo-concept-list__item">
                  <span className="taggo-concept-list__icon" aria-hidden="true">
                    ◈
                  </span>
                  Aucune application à installer pour scanner
                </li>
              </ul>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <div className="taggo-concept-visual" aria-hidden="true">
              <div className="taggo-concept-flow">
                <div className="taggo-concept-flow__step">
                  <div className="taggo-concept-flow__qr">
                    <div className="taggo-qr-grid">
                      <span /><span /><span /><span /><span />
                      <span /><span /><span /><span /><span />
                      <span /><span /><span /><span /><span />
                      <span /><span /><span /><span /><span />
                      <span /><span /><span /><span /><span />
                    </div>
                  </div>
                  <p className="taggo-concept-flow__label">QR code</p>
                </div>

                <span className="taggo-concept-flow__arrow" aria-hidden="true">→</span>

                <div className="taggo-concept-flow__step">
                  <div className="taggo-concept-flow__shirt">
                    <span className="taggo-concept-flow__shirt-icon">👕</span>
                  </div>
                  <p className="taggo-concept-flow__label">T-shirt</p>
                </div>

                <span className="taggo-concept-flow__arrow" aria-hidden="true">→</span>

                <div className="taggo-concept-flow__step">
                  <div className="taggo-concept-flow__profile">
                    <span className="taggo-concept-flow__avatar">👤</span>
                  </div>
                  <p className="taggo-concept-flow__label">Profil digital</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
