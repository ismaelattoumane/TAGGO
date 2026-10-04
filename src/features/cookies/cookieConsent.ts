import type { CookieCategoryId } from '../../content/legal/cookies'

/**
 * ÉTAPE 10 — Logique de consentement cookies (pure, testable).
 *
 * Le consentement est un simple choix booléen par catégorie optionnelle. Il
 * n'accorde et ne retire aucune donnée réellement utilisée : TAGGO n'utilise
 * aujourd'hui que des cookies strictement nécessaires et une préférence locale.
 */

export const COOKIE_CONSENT_STORAGE_KEY = 'taggo:cookie-consent'

export type CookieConsentState = {
  necessary: true
  preferences: boolean
  analytics: boolean
  marketing: boolean
  /** Horodatage ISO du choix, ou `null` si aucun choix n'a encore été fait. */
  decidedAt: string | null
}

export type CookieConsentChoice = Partial<Record<CookieCategoryId, boolean>>

export const DEFAULT_COOKIE_CONSENT: CookieConsentState = {
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
  decidedAt: null,
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isCookieConsentState(value: unknown): value is CookieConsentState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    candidate.necessary === true &&
    isBoolean(candidate.preferences) &&
    isBoolean(candidate.analytics) &&
    isBoolean(candidate.marketing) &&
    (candidate.decidedAt === null || typeof candidate.decidedAt === 'string')
  )
}

export function buildCookieConsent(choice: CookieConsentChoice, now: string): CookieConsentState {
  return {
    necessary: true,
    preferences: choice.preferences ?? false,
    analytics: choice.analytics ?? false,
    marketing: choice.marketing ?? false,
    decidedAt: now,
  }
}

export function acceptAllCookieConsent(now: string): CookieConsentState {
  return buildCookieConsent({ preferences: true, analytics: true, marketing: true }, now)
}

/**
 * Refuser = tout bloquer sauf les cookies strictement nécessaires.
 * Un choix « tout refuser » ne doit jamais être plus permissif qu'un choix
 * « tout accepter ».
 */
export function rejectAllCookieConsent(now: string): CookieConsentState {
  return buildCookieConsent({}, now)
}

/** Lit le consentement stocké. Un stockage corrompu est traité comme absent. */
export function readCookieConsent(storage: Storage | null): CookieConsentState | null {
  if (!storage) return null

  try {
    const raw = storage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isCookieConsentState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeCookieConsent(storage: Storage | null, state: CookieConsentState): void {
  if (!storage) return

  try {
    storage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Stockage indisponible (navigation privée, quota) : l'UI reste utilisable.
  }
}

export function clearCookieConsent(storage: Storage | null): void {
  if (!storage) return

  try {
    storage.removeItem(COOKIE_CONSENT_STORAGE_KEY)
  } catch {
    // Ignoré : le consentement est de toute façon recalculé au prochain rendu.
  }
}