import { Container } from '../../components/ui/Layout/Layout'
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
                Ton TAGGO, à ton image.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="taggo-landing-subheading">
                Chaque TAGGO est personnalisable : liens sociaux, contact,
                texte, destination, confidentialité. Tu changes d'avis ? Tu
                modifies ton profil en quelques secondes.
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
          </div>

          <Reveal delay={200}>
            <div className="taggo-custom-preview" aria-hidden="true">
              <div className="taggo-custom-preview__card">
                <div className="taggo-custom-preview__header">
                  <span className="taggo-custom-preview__dot" />
                  <span className="taggo-custom-preview__dot" />
                  <span className="taggo-custom-preview__dot" />
                </div>

                <div className="taggo-custom-preview__profile">
                  <div className="taggo-custom-preview__avatar">A</div>
                  <div>
                    <p className="taggo-custom-preview__name">Alex</p>
                    <p className="taggo-custom-preview__tag">@alex</p>
                  </div>
                </div>

                <div className="taggo-custom-preview__fields">
                  <div className="taggo-custom-preview__field">
                    <span className="taggo-custom-preview__field-label">Bio</span>
                    <span className="taggo-custom-preview__field-value">
                      Créatif. Paris. ☕
                    </span>
                  </div>
                  <div className="taggo-custom-preview__field">
                    <span className="taggo-custom-preview__field-label">Instagram</span>
                    <span className="taggo-custom-preview__field-value taggo-custom-preview__field-value--link">
                      @alex.creative
                    </span>
                  </div>
                  <div className="taggo-custom-preview__field">
                    <span className="taggo-custom-preview__field-label">WhatsApp</span>
                    <span className="taggo-custom-preview__field-value">
                      +33 6 12 34 56 78
                    </span>
                  </div>
                  <div className="taggo-custom-preview__field">
                    <span className="taggo-custom-preview__field-label">Site</span>
                    <span className="taggo-custom-preview__field-value taggo-custom-preview__field-value--link">
                      alex-portfolio.fr
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
