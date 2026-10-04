export type {
  ContentBlock,
  ContentSection,
  ContentDocument,
  ContentCard,
} from './types'

export { aboutDocument } from './about/aboutContent'
export { FAQ_CATEGORIES } from './faq/faqContent'
export type { FaqCategory, FaqItem } from './faq/faqContent'
export { CONTACT_CHANNELS, CONTACT_SECTIONS, CONTACT_UPDATED_AT } from './contact/contactContent'
export type { ContactChannel } from './contact/contactContent'
export {
  LEGAL_DOCUMENTS_BY_PATH,
  LEGAL_DOCUMENT_PATHS,
  legalNoticeDocument,
  legalPrivacyDocument,
  legalTermsDocument,
  legalCookiesDocument,
  shippingDocument,
  COOKIE_CATEGORIES,
  OPTIONAL_COOKIE_CATEGORIES,
  cookieCategoryById,
} from './legal'
export type { CookieCategory, CookieCategoryId } from './legal'

import { aboutDocument } from './about/aboutContent'
import { LEGAL_DOCUMENTS_BY_PATH } from './legal'
import type { ContentDocument } from './types'

/** Toutes les pages éditoriales publiques indexables, par route. */
export const PUBLIC_CONTENT_DOCUMENTS_BY_PATH: Record<string, ContentDocument> = {
  '/about': aboutDocument,
  ...LEGAL_DOCUMENTS_BY_PATH,
}