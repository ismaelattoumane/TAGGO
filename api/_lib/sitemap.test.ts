import { describe, expect, it } from 'vitest'
import vercelConfigFile from '../../vercel.json'
import { buildSitemapXml, STATIC_SITEMAP_ENTRIES, productSitemapEntries } from './sitemap'
import handler from '../sitemap'
import type { ApiRequest } from './types'

/**
 * Étape 10 — Sitemap XML.
 * Le domaine public n'est pas connu : aucune URL absolue n'est inventée.
 */

function request(): ApiRequest {
  return { method: 'GET', headers: {} }
}

describe('sitemap', () => {
  it('refuse de répondre tant que APP_URL n’est pas configurée', async () => {
    const previous = process.env.APP_URL
    delete process.env.APP_URL
    try {
      const response = await handler(request())
      expect(response.status).toBe(404)
      expect(JSON.stringify(response.body)).toContain('app_url_not_configured')
    } finally {
      if (previous !== undefined) process.env.APP_URL = previous
    }
  })

  it('sert un sitemap XML valide quand le domaine est connu', async () => {
    const previous = process.env.APP_URL
    process.env.APP_URL = 'https://taggo.example/'
    try {
      const response = await handler(request())
      expect(response.status).toBe(200)
      expect(response.headers?.['content-type']).toContain('application/xml')

      const xml = String(response.body)
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
      expect(xml).toContain('<loc>https://taggo.example/about</loc>')
      expect(xml).toContain('<loc>https://taggo.example/faq</loc>')
      expect(xml).toContain('<loc>https://taggo.example/legal/privacy</loc>')
      expect(xml).toContain('<loc>https://taggo.example/shop/tshirt-taggo</loc>')
      // Aucune route privée ne doit apparaître dans un sitemap.
      for (const privatePath of ['/login', '/register', '/cart', '/checkout', '/dashboard']) {
        expect(xml).not.toContain(`<loc>https://taggo.example${privatePath}`)
      }
    } finally {
      if (previous !== undefined) {
        process.env.APP_URL = previous
      } else {
        delete process.env.APP_URL
      }
    }
  })

  it('échappe les caractères XML', () => {
    const xml = buildSitemapXml('https://taggo.example/?a=1&b=2')
    expect(xml).toContain('&amp;')
    expect(xml).not.toContain('?a=1&b=2<')
  })

  it('liste les pages publiques attendues', () => {
    const paths = STATIC_SITEMAP_ENTRIES.map((entry) => entry.path)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/shop',
        '/about',
        '/faq',
        '/contact',
        '/shipping',
        '/legal/notice',
        '/legal/terms',
        '/legal/privacy',
        '/legal/cookies',
      ]),
    )
  })

  it('inclut uniquement les produits publics du catalogue', () => {
    const entries = productSitemapEntries()
    expect(entries.map((entry) => entry.path)).toContain('/shop/tshirt-taggo')
  })
})

describe('vercel.json — routage du sitemap', () => {
  it('route /sitemap.xml vers la fonction serveur avant le fallback SPA', () => {
    const vercelConfig = vercelConfigFile as { rewrites: { source: string; destination: string }[] }

    const sitemapRule = vercelConfig.rewrites.find((rule) => rule.source === '/sitemap.xml')
    expect(sitemapRule?.destination).toBe('/api/sitemap')

    const spaIndex = vercelConfig.rewrites.findIndex(
      (rule) => rule.destination === '/index.html',
    )
    const sitemapIndex = vercelConfig.rewrites.findIndex(
      (rule) => rule.source === '/sitemap.xml',
    )
    expect(sitemapIndex).toBeLessThan(spaIndex)
  })
})