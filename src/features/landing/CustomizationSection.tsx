import { Container } from '../../components/ui/Layout/Layout'
import { PhoneCard } from './PhoneCard'
import { Reveal } from './Reveal'
import './CustomizationSection.css'

const FEATURES = [
  {
    title: 'Liens sociaux',
    description: 'Instagram, Snapchat, TikTok, LinkedIn — centralise tout.',
  },
  {
    title: 'Contact',
    description: 'Téléphone, email, WhatsApp — sois joignable facilement.',
  },
  {
    title: 'Bio & texte',
    description: 'Décris-toi en quelques mots. Change ton message à tout moment.',
  },
  {
    title: 'Destination',
    description: 'Redirige vers le lien de ton choix. Modifiable en un clic.',
  },
  {
    title: 'Confidentialité',
    description: 'Choisis ce qui est visible. Tu gardes le contrôle.',
  },
  {
    title: 'Statistiques',
    description: 'Suis les scans et comprends ton audience.',
  },
]

/**
 * TAGGO Customization — shows a realistic preview of the customization UI.
 */
export function CustomizationSection() {
  return (
    <section
      id="customization"
      className="taggo-landing-section taggo-custom-section"
      aria-labelledby="custom-heading"
    >
      <Container size="lg">
        <div className="taggo-landing-grid-2">
          <div>
            <Reveal>
              <span className="taggo-eyebrow">Personnalisation</span>
            </Reveal>
            <Reveal delay={100}>
              <h2 id="custom-heading" className="taggo-landing-heading">
                Ton QR. Tes règles.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="taggo-landing-subheading">
                Chaque TAGGO est personnalisable : liens sociaux, contact,
                texte, destination, confidentialité. Tu changes d’avis ? Tu
                modifies ton profil en quelques secondes, avec le même T-shirt.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="taggo-custom-features">
                {FEATURES.map((feature) => (
                  <div key={feature.title} className="taggo-custom-feature">
                    <span className="taggo-custom-feature__dot" aria-hidden="true" />
                    <div>
                      <p className="taggo-custom-feature__title">{feature.title}</p>
                      <p className="taggo-custom-feature__desc">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={400}>
              <a className="taggo-button taggo-button--ghost taggo-custom-cta" href="#how-it-works">
                Découvrir le fonctionnement
              </a>
            </Reveal>
          </div>

          <Reveal delay={200}>
            <PhoneCard variant="destination" />
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
