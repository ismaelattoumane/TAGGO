import { legalNoticeDocument } from '../content/legal/notice'
import { ContentDocumentPage } from '../features/content/ContentDocumentPage'

/** Mentions légales (route `/legal/notice`). */
export function LegalNoticePage() {
  return <ContentDocumentPage document={legalNoticeDocument} />
}
