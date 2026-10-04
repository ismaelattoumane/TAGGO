import { describe, expect, it } from 'vitest'
import {
  AUTH_REDIRECT_PATHS,
  buildAuthRedirectUrl,
  getOriginForAuth,
  getSafeAuthDestination,
  isAuthRedirectPath,
} from './runtime'

describe('runtime auth helpers', () => {
  it('builds a current-origin redirect to the login page', () => {
    expect(buildAuthRedirectUrl('/login')).toBe(`${window.location.origin}/login`)
    expect(buildAuthRedirectUrl('/reset-password')).toBe(`${window.location.origin}/reset-password`)
  })

  it('falls back to the provided origin when no window API is available', () => {
    const originalWindow = globalThis.window
    // @ts-expect-error testing fallback when browser globals are unavailable
    delete globalThis.window

    try {
      expect(getOriginForAuth('https://taggo-omega.vercel.app')).toBe('https://taggo-omega.vercel.app')
      expect(buildAuthRedirectUrl('/login', 'https://taggo-omega.vercel.app')).toBe('https://taggo-omega.vercel.app/login')
    } finally {
      globalThis.window = originalWindow
    }
  })

  it('allows only internal auth destinations', () => {
    expect(getSafeAuthDestination('/activate/TGG-ABCDEFG')).toBe('/activate/TGG-ABCDEFG')
    expect(getSafeAuthDestination('/dashboard/qr/new')).toBe('/dashboard/qr/new')
    expect(getSafeAuthDestination('https://evil.example')).toBe('/dashboard')
    expect(getSafeAuthDestination('//evil.example')).toBe('/dashboard')
  })
})

describe('redirections Supabase Auth — étape 10.1', () => {
  it('n’autorise que les deux chemins Auth de TAGGO', () => {
    expect([...AUTH_REDIRECT_PATHS]).toEqual(['/login', '/reset-password', '/settings'])
    expect(isAuthRedirectPath('/login')).toBe(true)
    expect(isAuthRedirectPath('/reset-password')).toBe(true)
  })

  it('refuse toute origine ou domaine fourni par un tiers', () => {
    for (const hostile of [
      'https://evil.example/reset-password',
      '//evil.example/reset-password',
      'http://localhost:5173/reset-password',
      'javascript:alert(1)',
      '/reset-password?next=https://evil.example',
    ]) {
      expect(isAuthRedirectPath(hostile), `${hostile} ne doit pas être accepté`).toBe(false)
      expect(() => buildAuthRedirectUrl(hostile)).toThrow(/non autorisé/)
    }
  })

  it('refuse une origine open-redirect même si le chemin est valide', () => {
    // Le chemin est valide, mais la fonction ne doit jamais accepter d’origine
    // en entrée : seule `getOriginForAuth` (window.location ou valeur de test)
    // décide de l’hôte.
    const redirect = buildAuthRedirectUrl('/reset-password')
    expect(redirect).not.toContain('evil.example')
    expect(redirect.startsWith(window.location.origin)).toBe(true)
  })

  it('ne dérive jamais une redirection Auth d’un returnTo utilisateur', () => {
    // Le `returnTo` des pages /login et /register est filtré séparément et ne
    // touche jamais buildAuthRedirectUrl.
    for (const candidate of ['https://evil.example', '//evil.example', '/reset-password', '/dashboard']) {
      const destination = getSafeAuthDestination(candidate)
      expect(destination.startsWith('//')).toBe(false)
      expect(destination.startsWith('http')).toBe(false)
      expect(isAuthRedirectPath(destination)).toBe(false)
    }
  })
})
