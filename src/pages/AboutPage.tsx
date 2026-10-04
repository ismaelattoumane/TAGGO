import { aboutDocument } from '../content/about/aboutContent'
import { ContentDocumentPage } from '../features/content/ContentDocumentPage'

/** Page publique À propos (route `/about`). Contenu dans `src/content/about`. */
export function AboutPage() {
  return <ContentDocumentPage document={aboutDocument} />
}
