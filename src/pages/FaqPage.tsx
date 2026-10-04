import { Eyebrow } from '../components/ui/Typography/Typography'
import { FAQ_CATEGORIES } from '../content/faq/faqContent'
import { ContentBlocks } from '../features/content/ContentBlocks'
import { ContentFooter, ContentHeader } from '../features/content/ContentShell'
import { FaqAccordion } from '../features/faq/FaqAccordion'
import { usePageSeo } from '../lib/usePageSeo'
import '../features/content/content.css'

const TITLE = 'FAQ TAGGO — Questions fréquentes'
const DESCRIPTION =
  'Les réponses aux questions fréquentes sur le TAGGO : produit, scan, transfert, tailles, livraison, retours, dashboard, paiement et sécurité.'

/**
 * ÉTAPE 10 — FAQ publique (`/faq`), source de vérité dans
 * `src/content/faq/faqContent.ts`.
 *
 * Hiérarchie des titres : `h1` unique pour la page, `h2` par catégorie,
 * `h3` pour chaque question (respect du WCAG et des recommendations SEO).
 */
export function FaqPage() {
  usePageSeo({ title: TITLE, description: DESCRIPTION, canonicalPath: '/faq' })

  return (
    <div className="taggo-content-page">
      <a className="taggo-content__skip-link" href="#taggo-content">
        Aller au contenu
      </a>

      <ContentHeader />

      <main className="taggo-content" id="taggo-content">
        <header className="taggo-content__header">
          <Eyebrow>FAQ</Eyebrow>
          <h1 className="taggo-content__title">Questions fréquentes</h1>
          <p className="taggo-content__lead">
            Tout ce qu’il faut savoir avant de scanner, commander ou configurer ton TAGGO.
          </p>
          <p className="taggo-content__hint">
            Les informations encore inconnues sont affichées entre crochets : elles seront
            complétées par TAGGO dès qu’elles seront confirmées.
          </p>
        </header>

        <nav className="taggo-content__toc" aria-label="Sommaire de la FAQ">
          <p className="taggo-content__toc-title">Catégories</p>
          <ol className="taggo-content__toc-list">
            {FAQ_CATEGORIES.map((category) => (
              <li key={category.id}>
                <a href={`#faq-${category.id}`}>{category.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        {FAQ_CATEGORIES.map((category) => (
          <section
            className="taggo-faq-page__category"
            id={`faq-${category.id}`}
            key={category.id}
            aria-labelledby={`faq-${category.id}-title`}
          >
            <h2
              className="taggo-faq-page__category-title"
              id={`faq-${category.id}-title`}
            >
              {category.title}
            </h2>
            <FaqAccordion
              items={category.items}
              idPrefix={`faq-${category.id}`}
              headingLevel={3}
            />
          </section>
        ))}

        <section className="taggo-faq-page__category" aria-labelledby="faq-contact-title">
          <h2 className="taggo-faq-page__category-title" id="faq-contact-title">
            Ta question n’est pas là ?
          </h2>
          <ContentBlocks
            blocks={[
              {
                kind: 'paragraph',
                text: 'Consulte les pages Livraison et retours puis Contact : elles détaillent les informations pratiques et le canal d’échange avec TAGGO.',
              },
            ]}
          />
        </section>
      </main>

      <ContentFooter />
    </div>
  )
}