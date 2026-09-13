import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './SecuritySection.css'

const TRUST_POINTS = [
  {
    title: 'Tu contrôles ton TAGGO',
    description:
      'Tu décides ce qui est visible et quand. Modifie ou masque ton profil à tout moment.',
  },
  {
    title: 'Tes choix de confidentialité',
    description:
      'Tu choisis quelles informations sont publiques. Rien n’est partagé sans ta décision.',
  },
  {
    title: 'Destination modifiable',
    description:
      'Tu peux changer la destination de ton QR code en quelques clics. Le profil reste sous ton contrôle.',
  },
  {
    title: 'Gestion depuis le dashboard',
    description:
      'Tu gères ton profil, les liens et les statistiques depuis un seul tableau de bord.',
  },
]

/**
 * TAGGO Security — reassuring, honest messaging.
 */
export function SecuritySection() {
  return (
    <section
      id="security"
      className="taggo-landing-section taggo-security-section"
      aria-labelledby="security-heading"
    >
      <Container size="lg">
        <div className="taggo-landing-grid-2">
          <div>
            <Reveal>
              <span className="taggo-eyebrow">Sécurité</span>
            </Reveal>
            <Reveal delay={100}>
              <h2 id="security-heading" className="taggo-landing-heading">
                Tes données. Ton contrôle.
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="taggo-landing-subheading">
                Tu gardes la maîtrise de ta présence digitale. Tu décides ce
                qui est visible, tu modifies ta destination, et tu gères ton
                profil depuis un seul espace.
              </p>
            </Reveal>
          </div>

          <div className="taggo-security-points">
            {TRUST_POINTS.map((point, i) => (
              <Reveal key={point.title} delay={200 + i * 100}>
                <div className="taggo-security-point">
                  <span className="taggo-security-point__icon" aria-hidden="true">
                    ✓
                  </span>
                  <div>
                    <p className="taggo-security-point__title">{point.title}</p>
                    <p className="taggo-security-point__desc">{point.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
