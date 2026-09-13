import { Link } from 'react-router-dom'
import { Eyebrow } from '../../components/ui/Typography/Typography'
import { heroContent } from './heroContent'
import './Hero.css'

/**
 * TAGGO Hero — HTML content overlay.
 *
 * The Hero now contains only its textual content.
 * The 3D canvas is managed by StoryStage, not inside the Hero.
 */
export function Hero() {
  const { eyebrow, title, subtext, primaryCta, secondaryCta } = heroContent

  return (
    <section
      className="taggo-hero"
      aria-labelledby="hero-heading"
    >
      <div className="taggo-hero__content">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 id="hero-heading" className="taggo-h1 taggo-hero__title">
          {title.map((line) => (
            <span key={line} className="taggo-hero__line">
              {line}
            </span>
          ))}
        </h1>
        <p className="taggo-hero__subtext">{subtext}</p>
        <div className="taggo-hero__actions">
          <Link
            to="/register"
            className="taggo-button taggo-button--primary"
          >
            {primaryCta}
          </Link>
          <a href="#how-it-works" className="taggo-button taggo-button--ghost">
            {secondaryCta}
          </a>
        </div>
      </div>
    </section>
  )
}
