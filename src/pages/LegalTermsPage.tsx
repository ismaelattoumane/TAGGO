import { legalTermsDocument } from '../content/legal/terms'
import { ContentDocumentPage } from '../features/content/ContentDocumentPage'

/** Conditions Générales de Vente (route `/legal/terms`). */
export function LegalTermsPage() {
  return <ContentDocumentPage document={legalTermsDocument} />
}
