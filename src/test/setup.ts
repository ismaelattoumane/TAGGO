import '@testing-library/jest-dom/vitest'

/**
 * jsdom n'implémente pas `IntersectionObserver` : l'en-tête de la landing
 * l'utilise pour n'apparaître qu'à partir de la section #concept.
 * Sans ce stub, le rendu de la landing en test lève une ReferenceError.
 */
if (typeof globalThis.IntersectionObserver === 'undefined') {
  class IntersectionObserverStub implements IntersectionObserver {
    readonly root: Element | Document | null = null
    readonly rootMargin: string = ''
    readonly scrollMargin: string = ''
    readonly thresholds: ReadonlyArray<number> = []

    constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}

    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }

  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof globalThis.IntersectionObserver
}

/**
 * jsdom n'implémente pas `matchMedia` : le code l'utilise pour détecter
 * `prefers-reduced-motion` (hero 3D, écran de chargement, favicon animée).
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
