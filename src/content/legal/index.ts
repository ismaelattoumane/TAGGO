import type { ContentDocument } from '../types'
import { legalNoticeDocument } from './notice'
import { legalPrivacyDocument } from './privacy'
import { legalTermsDocument } from './terms'
import { legalCookiesDocument } from './cookies'
import { shippingDocument } from './shipping'

export type { CookieCategory, CookieCategoryId } from './cookies'

export { legalNoticeDocument } from './notice'
export { legalPrivacyDocument } from './privacy'
export { legalTermsDocument } from './terms'
export { legalCookiesDocument, COOKIE_CATEGORIES, OPTIONAL_COOKIE_CATEGORIES, cookieCategoryById } from './cookies'
export { shippingDocument } from './shipping'

/** Index des documents publics par route, utilisé par les pages, le footer et les tests. */
export const LEGAL_DOCUMENTS_BY_PATH: Record<string, ContentDocument> = {
  '/legal/notice': legalNoticeDocument,
  '/legal/privacy': legalPrivacyDocument,
  '/legal/terms': legalTermsDocument,
  '/legal/cookies': legalCookiesDocument,
  '/shipping': shippingDocument,
}

/** Routes légales publiques indexables. */
export const LEGAL_DOCUMENT_PATHS = [
  '/legal/notice',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
  '/shipping',
] as const