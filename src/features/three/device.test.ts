import { describe, expect, it } from 'vitest'
import {
  GLB_MODEL_URL,
  clampDpr,
  heroDpr,
  isWebGlSupported,
  prefersReducedMotion,
} from './device'

describe('device helpers (3D hero discipline)', () => {
  it('clamps dpr within [1, 2] and treats non-finite input as default', () => {
    expect(clampDpr(1)).toBe(1)
    expect(clampDpr(1.5)).toBe(1.5)
    expect(clampDpr(4)).toBe(2)
    expect(clampDpr(0.5)).toBe(1)
    expect(clampDpr(Number.NaN)).toBe(1)
    // Non-finite values are untrusted -> default to the minimum (safer than mapping to 2).
    expect(clampDpr(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('caps dpr further under prefers-reduced-motion', () => {
    expect(heroDpr(3, true)).toBe(1.5)
    expect(heroDpr(1.25, true)).toBe(1.25)
    expect(heroDpr(3, false)).toBe(2)
  })

  it('resolves prefers-reduced-motion from a mock media list', () => {
    expect(prefersReducedMotion()).toBe(false)
    const match = (_query: string) => ({ matches: true })
    expect(prefersReducedMotion(match)).toBe(true)
  })

  it('detects WebGL support through an injectable canvas factory', () => {
    expect(
      isWebGlSupported(() => {
        const canvas = { getContext: () => ({}) } as unknown as HTMLCanvasElement
        return canvas
      }),
    ).toBe(true)
    expect(
      isWebGlSupported(() => {
        const canvas = { getContext: () => null } as unknown as HTMLCanvasElement
        return canvas
      }),
    ).toBe(false)
    expect(isWebGlSupported(() => null)).toBe(false)
    expect(
      isWebGlSupported(() => {
        throw new Error('blocked')
      }),
    ).toBe(false)
  })

  it('points at the shipped GLB asset', () => {
    expect(GLB_MODEL_URL).toMatch(/models\/taggo-shirt\.glb$/)
  })
})