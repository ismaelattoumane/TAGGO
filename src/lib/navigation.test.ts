import { describe, expect, it, beforeEach } from 'vitest'
import { getSafeBackPath, getSafeForwardPath, recordCurrentAppPath } from './navigation'

describe('safe navigation helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.history.pushState({}, '', '/dashboard')
  })

  it('returns the previous internal route when available', () => {
    recordCurrentAppPath('/dashboard')
    recordCurrentAppPath('/dashboard/settings')
    window.history.pushState({}, '', '/dashboard/settings')

    expect(getSafeBackPath('/dashboard')).toBe('/dashboard')
  })

  it('returns the next internal route when available', () => {
    recordCurrentAppPath('/dashboard')
    recordCurrentAppPath('/dashboard/settings')
    recordCurrentAppPath('/dashboard/qr/new')
    window.history.pushState({}, '', '/dashboard/settings')

    expect(getSafeForwardPath('/dashboard')).toBe('/dashboard/qr/new')
  })

  it('falls back to the dashboard when the previous page is outside the app', () => {
    recordCurrentAppPath('/dashboard')
    window.history.pushState({}, '', '/dashboard')
    Object.defineProperty(document, 'referrer', { value: 'https://external.example/page', configurable: true })

    expect(getSafeBackPath('/dashboard')).toBe('/dashboard')
  })
})
