import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './ProductSection.css'

const BASE_URL = (import.meta.env.BASE_URL ?? '').replace(/\/+$/, '')

/** Devant / dos du T-shirt : logo et QR code issus de la texture du modèle 3D. */
export function ProductSection() {
  return (
    <section
      id="product"
      className="taggo-landing-section taggo-product-section"
      aria-labelledby="product-heading"
    >
      <Container size="md">
        <Reveal>
          <h2 id="product-heading" className="taggo-landing-heading">
            Un vêtement. Une identité numérique.
          </h2>
        </Reveal>
        <div className="taggo-product-faces">
          <Reveal>
            <figure className="taggo-product-face">
              <figcaption>Devant</figcaption>
              <img
                src={`${BASE_URL}/landing/product-front.png`}
                alt="Logo TAGGO imprimé sur le devant du T-shirt"
                width={132}
                height={128}
                loading="lazy"
              />
              <span>Logo TAGGO.</span>
            </figure>
          </Reveal>
          <Reveal delay={120}>
            <figure className="taggo-product-face">
              <figcaption>Dos</figcaption>
              <img
                src={`${BASE_URL}/landing/product-back.png`}
                alt="QR code TAGGO imprimé au dos du T-shirt"
                width={442}
                height={442}
                loading="lazy"
              />
              <span>QR code.</span>
            </figure>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
