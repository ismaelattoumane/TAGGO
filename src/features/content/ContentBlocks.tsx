import type { ContentBlock } from '../../content/types'
import './content.css'

/**
 * ÉTAPE 10 — Rendu des blocs de contenu éditorial.
 *
 * Sémantique : `dl/dt/dd` pour les définitions, listes `ul/ol` pour les
 * énumérations, `p` pour les paragraphes. Aucun style inline, tout passe par
 * les classes `taggo-content-*` définies dans content.css.
 */
export function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`

        switch (block.kind) {
          case 'paragraph':
            return (
              <p className="taggo-content__paragraph" key={key}>
                {block.text}
              </p>
            )

          case 'note':
            return (
              <p className="taggo-content__note" key={key}>
                {block.text}
              </p>
            )

          case 'bullets':
            return (
              <ul className="taggo-content__list" key={key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )

          case 'numbers':
            return (
              <ol className="taggo-content__list" key={key}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            )

          case 'definition':
            return (
              <dl className="taggo-content__definitions" key={key}>
                {block.entries.map((entry) => (
                  <div className="taggo-content__definition" key={entry.term}>
                    <dt className="taggo-content__term">{entry.term}</dt>
                    <dd className="taggo-content__definition-value">{entry.description}</dd>
                  </div>
                ))}
              </dl>
            )

          default:
            return null
        }
      })}
    </>
  )
}