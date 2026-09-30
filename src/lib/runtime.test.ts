import { describe, expect, it } from 'vitest'
import { buildAuthRedirectUrl, getOriginForAuth, getSafeAuthDestination } from './runtime'

describe('runtime auth helpers', () => {
  it('builds a current-origin redirect to the login page', () => {
    expect(buildAuthRedirectUrl('/login')).toBe(`${window.location.origin}/login`)
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
