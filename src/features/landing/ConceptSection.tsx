import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './ConceptSection.css'

const BASE_URL = (import.meta.env.BASE_URL ?? '').replace(/\/+$/, '')

/**
 * TAGGO Concept — explains the product in seconds.
 * Visual: le QR code réel (dos du T-shirt) scanned vers le profil TAGGO.
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
              <ul className="taggo-landing-ticks">
                <li>Un QR code unique, relié à ton profil</li>
                <li>Une page publique personnalisable à l'infini</li>
                <li>Aucune application à installer pour scanner</li>
              </ul>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <figure className="taggo-concept-qr">
              <img
                src={`${BASE_URL}/landing/product-back.png`}
                alt="QR code TAGGO imprimé au dos du T-shirt"
                width={442}
                height={442}
                loading="lazy"
              />
              <figcaption>Scan → Profil TAGGO</figcaption>
            </figure>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
