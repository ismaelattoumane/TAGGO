import { afterEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { usePageSeo } from './usePageSeo'

function Probe({ noindex = false, canonicalPath = '/shop' }: { noindex?: boolean; canonicalPath?: string }) {
  usePageSeo({
    title: 'Boutique TAGGO',
    description: 'Catalogue TAGGO',
    canonicalPath,
    noindex,
  })
  return null
}

function readRobots(): string | null {
  return document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content ?? null
}

function readCanonical(): string | null {
  return document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href') ?? null
}

describe('usePageSeo', () => {
  afterEach(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    meta?.setAttribute('content', 'noindex, nofollow')
    document.querySelector('link[rel="canonical"]')?.remove()
  })

  it('sets title, description and canonical URL on a public page', () => {
    render(<Probe />)

    expect(document.title).toBe('Boutique TAGGO')
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(
      'Catalogue TAGGO',
    )
    expect(readCanonical()).toBe(`${window.location.origin}/shop`)
  })

  it('indexes public shop pages', () => {
    render(<Probe />)
    expect(readRobots()).toBe('index, follow')
  })

  it('keeps private pages out of the index', () => {
    render(<Probe canonicalPath="/checkout" noindex />)
    expect(readRobots()).toBe('noindex, nofollow')
  })

  it('restores the previous metadata on unmount', () => {
    const { unmount } = render(<Probe />)
    expect(document.title).toBe('Boutique TAGGO')

    unmount()
    expect(document.title).not.toBe('Boutique TAGGO')
    expect(readCanonical()).toBeNull()
  })
})