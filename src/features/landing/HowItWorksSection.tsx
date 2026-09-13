import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './HowItWorksSection.css'

const STEPS = [
  {
    number: '01',
    title: 'Choisis ton TAGGO',
    description:
      'Sélectionne ton T-shirt TAGGO. Chaque pièce est livrée avec un QR code unique, prêt à être activé.',
    icon: '✦',
  },
  {
    number: '02',
    title: 'Personnalise ton expérience',
    description:
      'Ajoute tes liens sociaux, tes coordonnées, ta bio. Ta page publique te représente, à ton image.',
    icon: '◈',
  },
  {
    number: '03',
    title: 'Porte-le',
    description:
      'Porte ton TAGGO au quotidien. Au travail, en soirée, en voyage — ton identité digitale te suit partout.',
    icon: '♛',
  },
  {
    number: '04',
    title: 'Fais scanner',
    description:
      "Un scan suffit. N'importe qui avec un smartphone accède instantanément à ton profil. Sans application.",
    icon: '◉',
  },
]

/**
 * TAGGO How It Works — 4-step premium explanation.
 */
export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="taggo-landing-section taggo-hiw-section"
      aria-labelledby="hiw-heading"
    >
      <Container size="lg">
        <div className="taggo-hiw-header">
          <Reveal>
            <span className="taggo-eyebrow">Comment ça marche</span>
          </Reveal>
          <Reveal delay={100}>
            <h2 id="hiw-heading" className="taggo-landing-heading">
              Simple comme un scan.
            </h2>
          </Reveal>
        </div>

        <div className="taggo-landing-grid-4 taggo-hiw-grid">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={100 + i * 100}>
              <article className="taggo-hiw-card">
                <span className="taggo-hiw-card__number" aria-hidden="true">
                  {step.number}
                </span>
                <span className="taggo-hiw-card__icon" aria-hidden="true">
                  {step.icon}
                </span>
                <h3 className="taggo-hiw-card__title">{step.title}</h3>
                <p className="taggo-hiw-card__description">{step.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
