import { useState } from 'react'
import './faqAccordion.css'

export type AccordionItem = {
  id: string
  question: string
  /** Réponse : liste de paragraphes courts (jamais de donnée inventée). */
  answer: string[]
}

type FaqAccordionProps = {
  items: AccordionItem[]
  /** Préfixe d'identifiants pour éviter les doublons si l'accordéon est répété. */
  idPrefix: string
  /** Niveau du titre de la question, pour respecter la hiérarchie des titres. */
  headingLevel?: 2 | 3
}

/**
 * ÉTAPE 10 — Accordéon FAQ accessible, réutilisé par la landing et par `/faq`.
 *
 * Accessibilité (WCAG 2.1 — 4.1.2 Nom, rôle, valeur) :
 * - chaque déclencheur est un vrai `<button>` dans un titre, donc atteignable
 *   au clavier et annoncé comme bouton ;
 * - `aria-expanded` reflète l'état réel, `aria-controls` pointe vers le panneau ;
 * - le panneau porte `role="region"` et `aria-labelledby` sur le déclencheur ;
 * - le contenu d'un panneau fermé est retiré de l'accessibility tree (`hidden`).
 */
export function FaqAccordion({ items, idPrefix, headingLevel = 3 }: FaqAccordionProps) {
  const [openIds, setOpenIds] = useState<string[]>([])

  const Heading = headingLevel === 2 ? 'h2' : 'h3'

  function toggle(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )
  }

  return (
    <div className="taggo-faq-accordion">
      {items.map((item) => {
        const isOpen = openIds.includes(item.id)
        const buttonId = `${idPrefix}-button-${item.id}`
        const panelId = `${idPrefix}-panel-${item.id}`

        return (
          <div
            className={`taggo-faq-item${isOpen ? ' taggo-faq-item--open' : ''}`}
            key={item.id}
          >
            <Heading className="taggo-faq-item__question">
              <button
                type="button"
                id={buttonId}
                className="taggo-faq-item__button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
              >
                <span className="taggo-faq-item__text">{item.question}</span>
                <span className="taggo-faq-item__icon" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
            </Heading>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="taggo-faq-item__panel"
              hidden={!isOpen}
            >
              {item.answer.map((paragraph) => (
                <p className="taggo-faq-item__answer" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}