import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './QrSection.css'

/**
 * TAGGO QR Section — dedicated to the QR code explanation.
 */
export function QrSection() {
  return (
    <section
      id="qr"
      className="taggo-landing-section taggo-qr-section"
      aria-labelledby="qr-heading"
    >
      <Container size="lg">
        <div className="taggo-landing-grid-2">
          <Reveal>
            <div className="taggo-qr-visual" aria-hidden="true">
              <div className="taggo-qr-frame">
                <img
                  src={`${import.meta.env.BASE_URL}qr-code.png`}
                  alt="QR Code TAGGO — scannez pour accéder à un profil public"
                  className="taggo-qr-frame__img"
                  width="180"
                  height="180"
                  loading="lazy"
                />
              </div>
              <p className="taggo-qr-caption">Scan → Profil TAGGO</p>
            </div>
          </Reveal>

          <div>
            <Reveal>
              <span className="taggo-eyebrow">QR Code</span>
            </Reveal>
            <Reveal delay={100}>
              <h2 id="qr-heading" className="taggo-landing-heading">
                Un scan suffit.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="taggo-landing-subheading">
                Pas d'application à télécharger. Pas de compte à créer pour le
                scanner. Un QR code unique, l'appareil photo du smartphone, et
                c'est tout. La destination est modifiable à tout moment depuis
                ton espace TAGGO.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <ul className="taggo-qr-list">
                <li className="taggo-qr-list__item">
                  QR unique, relié à ton profil
                </li>
                <li className="taggo-qr-list__item">
                  Accès instantané avec n'importe quel smartphone
                </li>
                <li className="taggo-qr-list__item">
                  Destination modifiable à tout moment
                </li>
                <li className="taggo-qr-list__item">
                  Aucune application nécessaire pour scanner
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  )
}
