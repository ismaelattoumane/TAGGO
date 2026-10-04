import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CookieConsent } from './CookieConsent'
import {
  acceptAllCookieConsent,
  buildCookieConsent,
  COOKIE_CONSENT_STORAGE_KEY,
  DEFAULT_COOKIE_CONSENT,
  readCookieConsent,
  rejectAllCookieConsent,
  writeCookieConsent,
} from './cookieConsent'

/**
 * Étape 10 — Consentement cookies.
 *
 * Aucun traceur n'est installé : le composant enregistre un choix utilisateur.
 * On vérifie donc le stockage du choix, l'accessibilité du panneau et
 * l'impossibilité de désactiver les cookies strictement nécessaires.
 */

beforeEach(() => {
  window.localStorage.clear()
})

describe('cookieConsent (logique)', () => {
  it('ne peut jamais désactiver les cookies strictement nécessaires', () => {
    const refused = rejectAllCookieConsent('2026-01-01T00:00:00.000Z')
    expect(refused.necessary).toBe(true)
    expect(refused.preferences).toBe(false)
    expect(refused.analytics).toBe(false)
    expect(refused.marketing).toBe(false)
    expect(refused.decidedAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('refuse un choix moins permissif que le refus par défaut', () => {
    const accepted = acceptAllCookieConsent('2026-01-01T00:00:00.000Z')
    const refused = rejectAllCookieConsent('2026-01-01T00:00:00.000Z')
    expect(accepted.analytics).toBe(true)
    expect(refused.analytics).toBe(false)
    expect(DEFAULT_COOKIE_CONSENT.decidedAt).toBeNull()
  })

  it('complète les choix absents par des valeurs restrictives', () => {
    const consent = buildCookieConsent({ preferences: true }, '2026-01-01T00:00:00.000Z')
    expect(consent).toEqual({
      necessary: true,
      preferences: true,
      analytics: false,
      marketing: false,
      decidedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('lit un consentement corrompu comme absent', () => {
    expect(readCookieConsent(window.localStorage)).toBeNull()
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '{pas du json')
    expect(readCookieConsent(window.localStorage)).toBeNull()
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, '{"necessary":false}')
    expect(readCookieConsent(window.localStorage)).toBeNull()
  })

  it('effectue un aller-retour en stockage', () => {
    const consent = rejectAllCookieConsent('2026-01-01T00:00:00.000Z')
    writeCookieConsent(window.localStorage, consent)
    expect(readCookieConsent(window.localStorage)).toEqual(consent)
    expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).not.toContain('support@')
  })
})

describe('CookieConsent (composant)', () => {
  it('affiche le bandeau tant qu’aucun choix n’a été fait', () => {
    render(<CookieConsent />)

    expect(screen.getByRole('region', { name: 'Gestion des cookies' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tout accepter' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tout refuser' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Personnaliser' })).toBeInTheDocument()
  })

  it('enregistre un refus et affiche le bouton de modification', () => {
    render(<CookieConsent />)

    fireEvent.click(screen.getByRole('button', { name: 'Tout refuser' }))

    expect(screen.queryByRole('button', { name: 'Tout accepter' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier mes choix' })).toBeInTheDocument()

    const stored = readCookieConsent(window.localStorage)
    expect(stored).toMatchObject({ necessary: true, preferences: false, analytics: false })
  })

  it('permet de rouvrir le panneau et de modifier ses choix', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Tout refuser' }))
    fireEvent.click(screen.getByRole('button', { name: 'Modifier mes choix' }))

    const dialog = screen.getByRole('dialog', { name: 'Personnaliser les cookies' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')

    const preferences = screen.getByLabelText('Cookies de préférence') as HTMLInputElement
    expect(preferences.checked).toBe(false)
    fireEvent.click(preferences)

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer mes choix' }))

    expect(screen.getByRole('button', { name: 'Modifier mes choix' })).toBeInTheDocument()
    expect(readCookieConsent(window.localStorage)).toMatchObject({ preferences: true })
  })

  it('resteime les catégories inutilisées par TAGGO', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser' }))

    const marketing = screen.getByLabelText('Publicité et reciblage') as HTMLInputElement

    expect(marketing).toBeDisabled()
    expect(screen.getAllByText('Non utilisé par TAGGO à ce jour.').length).toBe(1)
  })

  it('présente la mesure d’audience interne comme active mais non refusable', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser' }))

    const analytics = screen.getByLabelText("Mesure d’audience") as HTMLInputElement

    // Une case à cocher activable prometrait un refus qui n'existe pas : le
    // comptage des scans n'utilise ni cookie ni identifiant et n'en dépend pas.
    expect(analytics).toBeDisabled()
    expect(
      screen.getByText('Actif, sans cookie ni identifiant : aucun consentement n’est requis.'),
    ).toBeInTheDocument()
  })

  it('affiche les cookies strictement nécessaires comme non configurables', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser' }))

    expect(screen.queryByLabelText('Cookies et stockages strictement nécessaires')).not.toBeInTheDocument()
    expect(screen.getByText('Toujours actif (non configurable)')).toBeInTheDocument()
  })

  it('permet d’annuler sans rien enregistrer', () => {
    render(<CookieConsent />)
    fireEvent.click(screen.getByRole('button', { name: 'Tout accepter' }))
    fireEvent.click(screen.getByRole('button', { name: 'Modifier mes choix' }))
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(readCookieConsent(window.localStorage)).toMatchObject({ analytics: true })
  })

  it('ne s’affiche pas si un choix a déjà été enregistré', () => {
    writeCookieConsent(window.localStorage, rejectAllCookieConsent('2026-01-01T00:00:00.000Z'))
    render(<CookieConsent />)

    expect(screen.queryByRole('region', { name: 'Gestion des cookies' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Modifier mes choix' })).toBeInTheDocument()
  })
})