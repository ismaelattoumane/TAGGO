import { ContentBlocks } from './ContentBlocks'
import { ContentFooter, ContentHeader } from './ContentShell'
import { usePageSeo } from '../../lib/usePageSeo'
import type { ContentDocument } from '../../content/types'
import './content.css'

/**
 * ÉTAPE 10 — Rendu générique d'un document public (légaux, FAQ longue, livraison).
 *
 * Accessibilité et SEO :
 * - un seul `h1` par page (le titre du document) ;
 * - chaque section est un `h2` et porte un `id` stable (ancres profondes) ;
 * - sommaire de navigation en amont du contenu ;
 * - `main` unique, lien d'évitement vers le contenu.
 */
export function ContentDocumentPage({ document }: { document: ContentDocument }) {
  // Les titres qui mentionnent déjà la marque ne sont pas suffixes deux fois.
  const pageTitle = document.title.includes('TAGGO')
    ? document.title
    : `${document.title} — TAGGO`

  usePageSeo({
    title: pageTitle,
    description: document.description,
    canonicalPath: document.path,
    ogType: 'article',
  })

  return (
    <div className="taggo-content-page">
      <a className="taggo-content__skip-link" href="#taggo-content">
        Aller au contenu
      </a>

      <ContentHeader />

      <main className="taggo-content" id="taggo-content">
        <header className="taggo-content__header">
          <p className="taggo-eyebrow">{document.eyebrow}</p>
          <h1 className="taggo-content__title">{document.title}</h1>
          {document.lead ? <p className="taggo-content__lead">{document.lead}</p> : null}
          {document.blocks ? <ContentBlocks blocks={document.blocks} /> : null}
        </header>

        {document.sections.length > 1 ? (
          <nav className="taggo-content__toc" aria-label="Sommaire du document">
            <p className="taggo-content__toc-title">Sommaire</p>
            <ol className="taggo-content__toc-list">
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
        ) : null}

        {document.sections.map((section) => (
          <section className="taggo-content__section" key={section.id} id={section.id}>
            <h2 className="taggo-content__section-title">{section.title}</h2>
            <ContentBlocks blocks={section.blocks} />
          </section>
        ))}
      </main>

      <ContentFooter />
    </div>
  )
}