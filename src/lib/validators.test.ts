import { describe, expect, it } from 'vitest'
import {
  isValidEmail,
  isValidPassword,
  isValidDestinationUrl,
  sanitizeText,
  buildPublicId,
} from './validators'

describe('validators', () => {
  it('accepts a valid email and rejects malformed values', () => {
    expect(isValidEmail('hello@taggo.com')).toBe(true)
    expect(isValidEmail('not-an-email')).toBe(false)
  })

  it('requires a strong password', () => {
    expect(isValidPassword('123456')).toBe(false)
    expect(isValidPassword('StrongPass123!')).toBe(true)
  })

  it('accepts valid tagged destinations and rejects unsafe values', () => {
    expect(isValidDestinationUrl('https://taggo.example/profile')).toBe(true)
    expect(isValidDestinationUrl('javascript:alert(1)')).toBe(false)
    expect(isValidDestinationUrl('not-a-url')).toBe(false)
  })

  it('removes script markup while preserving safe text', () => {
    expect(sanitizeText('  hello <script>alert(1)</script>  ')).toBe('hello')
  })

  it('builds a non-enumerable public id', () => {
    const id = buildPublicId()
    expect(id).toMatch(/^[A-Z0-9]{10,}$/)
    expect(id.length).toBeGreaterThanOrEqual(10)
  })
})
