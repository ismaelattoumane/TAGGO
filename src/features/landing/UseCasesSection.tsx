import { Container } from '../../components/ui/Layout/Layout'
import { Reveal } from './Reveal'
import './UseCasesSection.css'

const USE_CASES = [
  {
    title: 'Particuliers',
    description:
      'Partage facilement tes réseaux et tes contacts. Un scan, et te voilà connecté.',
    icon: '✦',
    audience: 'Pour toi',
  },
  {
    title: 'Influenceurs',
    description:
      'Crée une expérience autour de ton identité et de ta communauté. Ton TAGGO, c’est ton média.',
    icon: '◈',
    audience: 'Pour ta communauté',
  },
  {
    title: 'Associations & entreprises',
    description:
      'Événements, campagnes, communication, recrutement, promotion : TAGGO s’adapte à ton activité.',
    icon: '◉',
    audience: 'Pour ton organisation',
  },
]

/**
 * TAGGO Use Cases — who is TAGGO for.
 */
export function UseCasesSection() {
  return (
    <section
      id="use-cases"
      className="taggo-landing-section taggo-usecases-section"
      aria-labelledby="usecases-heading"
    >
      <Container size="lg">
        <div className="taggo-usecases-header">
          <Reveal>
            <span className="taggo-eyebrow">Pour qui ?</span>
          </Reveal>
          <Reveal delay={100}>
            <h2 id="usecases-heading" className="taggo-landing-heading">
              Un TAGGO pour chaque usage.
            </h2>
          </Reveal>
        </div>

        <div className="taggo-landing-grid-3 taggo-usecases-grid">
          {USE_CASES.map((uc, i) => (
            <Reveal key={uc.title} delay={100 + i * 120}>
              <article className="taggo-usecases-card">
                <span className="taggo-usecases-card__audience">{uc.audience}</span>
                <span className="taggo-usecases-card__icon" aria-hidden="true">
                  {uc.icon}
                </span>
                <h3 className="taggo-usecases-card__title">{uc.title}</h3>
                <p className="taggo-usecases-card__description">{uc.description}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
