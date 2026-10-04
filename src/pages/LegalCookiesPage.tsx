import { legalCookiesDocument } from '../content/legal/cookies'
import { ContentDocumentPage } from '../features/content/ContentDocumentPage'

/** Politique cookies (route `/legal/cookies`). */
export function LegalCookiesPage() {
  return <ContentDocumentPage document={legalCookiesDocument} />
}
