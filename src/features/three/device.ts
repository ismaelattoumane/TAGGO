/**
 * Pure device/capability helpers for the 3D hero.
 * Kept free of three.js / R3F imports so they are trivially unit-testable
 * and do not pull the 3D stack into unrelated bundles.
 */

/** GLB served as a static asset from Vite `public/` (resolved at runtime). */
const BASE_URL = (import.meta.env.BASE_URL ?? '').replace(/\/+$/, '')
export const GLB_MODEL_URL = `${BASE_URL}/models/taggo-shirt.glb`

/**
 * Clamp the renderer pixel ratio to a sane range.
 * Default [1, 2]: keeps mobile GPUs honest without degrading HiDPI desktops.
 */
export function clampDpr(dpr: number, min = 1, max = 2): number {
  if (!Number.isFinite(dpr)) return min
  return Math.min(max, Math.max(min, dpr))
}

export type MediaQueryListLike = {
  (query: string): { matches: boolean }
}

/**
 * Resolve `prefers-reduced-motion: reduce`.
 * Accepts an injectable matchMedia for tests.
 */
export function prefersReducedMotion(
  media?: MediaQueryListLike | undefined,
): boolean {
  const mql = media ?? (typeof window !== 'undefined' ? window.matchMedia : undefined)
  if (!mql) return false
  return mql('(prefers-reduced-motion: reduce)').matches
}

export type CanvasFactory = () => HTMLCanvasElement | null

/**
 * WebGL 1/2 availability probe.
 * Accepts an injectable canvas factory for tests.
 */
export function isWebGlSupported(createCanvas?: CanvasFactory): boolean {
  const make = createCanvas ?? (() => document.createElement('canvas'))
  try {
    const canvas = make()
    if (!canvas) return false
    const ctx =
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl') ??
      canvas.getContext('webgl2d')
    return Boolean(ctx)
  } catch {
    return false
  }
}

/**
 * Effective DPR for the hero canvas.
 * Under `prefers-reduced-motion` we additionally cap resolution
 * (lower GPU load, still crisp on standard displays).
 */
export function heroDpr(
  devicePixelRatio: number | undefined,
  reducedMotion = false,
  _createCanvas?: CanvasFactory,
): number {
  const dpr =
    typeof devicePixelRatio === 'number' && Number.isFinite(devicePixelRatio)
      ? devicePixelRatio
      : 1
  return reducedMotion ? clampDpr(dpr, 1, 1.5) : clampDpr(dpr)
}