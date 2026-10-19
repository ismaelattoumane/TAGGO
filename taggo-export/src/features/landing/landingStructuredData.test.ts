import { describe, expect, it } from 'vitest'
import { FAQ_ITEMS } from './landingFaqItems'
import { buildLandingJsonLd, serializeJsonLd } from './landingStructuredData'

const options = {
  origin: 'https://taggo.space/',
  title: 'TAGGO — Le T-shirt qui connecte le physique au numérique',
  description: 'TAGGO transforme ton T-shirt en identité numérique grâce à un QR code personnalisé.',
  supportEmail: 'support-taggo@protonmail.com',
  faq: FAQ_ITEMS,
}

describe('landing structured data', () => {
  const graph = (buildLandingJsonLd(options)['@graph'] as Array<Record<string, unknown>>)

  it('describes organization, website, page and FAQ', () => {
    expect(graph.map((node) => node['@type'])).toEqual(['Organization', 'WebSite', 'WebPage', 'FAQPage'])
  })

  it('uses the production origin without a double slash', () => {
    expect(graph[0]?.url).toBe('https://taggo.space/')
    expect(graph[0]?.logo).toBe('https://taggo.space/android-chrome-512x512.png')
  })

  it('mirrors every visible FAQ entry (Google requires parity with the page)', () => {
    const faq = graph[3] as { mainEntity: Array<{ name: string }> }
    expect(faq.mainEntity).toHaveLength(FAQ_ITEMS.length)
    expect(faq.mainEntity[0]?.name).toBe(FAQ_ITEMS[0]?.question)
  })

  it('serializes to valid JSON and never emits a raw "<"', () => {
    const json = serializeJsonLd(buildLandingJsonLd({ ...options, title: 'a </script> b' }))
    expect(json).not.toContain('<')
    expect(() => JSON.parse(json)).not.toThrow()
  })
})
