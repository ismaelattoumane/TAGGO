import { shippingDocument } from '../content/legal/shipping'
import { ContentDocumentPage } from '../features/content/ContentDocumentPage'

/** Informations de livraison et de retours (route `/shipping`). */
export function ShippingPage() {
  return <ContentDocumentPage document={shippingDocument} />
}
