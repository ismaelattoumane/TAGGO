import { legalPrivacyDocument } from '../content/legal/privacy'
import { ContentDocumentPage } from '../features/content/ContentDocumentPage'

/** Politique de confidentialité / RGPD (route `/legal/privacy`). */
export function LegalPrivacyPage() {
  return <ContentDocumentPage document={legalPrivacyDocument} />
}
