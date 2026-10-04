import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PUBLIC_CONTENT_DOCUMENTS_BY_PATH, LEGAL_DOCUMENT_PATHS } from '../content'
import { STATIC_SITEMAP_ENTRIES } from '../../api/_lib/sitemap'

/**
 * Crawler-facing SEO configuration.
 *
 * Ces assertions lisent les fichiers STATIQUES réellement servis avant
 * l'exécution de JavaScript. Un test React qui mute une balise meta après le
 * rendu ne prouve rien de ce que reçoit un crawler : le HTML servi et
 * robots.txt sont donc vérifiés ici.
 */

const root = process.cwd()

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8')
}

function extractMetaContent(html: string, name: string): string | null {
  const match = new RegExp(`<meta[^>]*name="${name}"[^>]*>`).exec(html)
  if (!match) return null
  return /content="([^"]*)"/.exec(match[0])?.[1] ?? null
}

describe('static SEO configuration', () => {
  const indexHtml = readProjectFile('index.html')
  const robotsTxt = readProjectFile('public/robots.txt')

  it('does not hide public pages behind a global noindex before JS runs', () => {
    expect(extractMetaContent(indexHtml, 'robots')).toBe('index, follow')
  })

  it('ships a title and a meta description in the served HTML', () => {
    expect(/<title>[^<]+<\/title>/.test(indexHtml)).toBe(true)
    expect(extractMetaContent(indexHtml, 'description')).toBeTruthy()
  })

  it('keeps the shop crawlable and the private routes blocked in robots.txt', () => {
    expect(robotsTxt).toMatch(/^Allow: \/shop$/m)
    for (const privatePath of ['/dashboard', '/login', '/register', '/cart', '/checkout']) {
      expect(robotsTxt).toMatch(new RegExp(`^Disallow: ${privatePath}$`, 'm'))
    }
  })

  it('blocks the remaining private routes from crawling', () => {
    for (const privatePath of ['/forgot-password', '/reset-password', '/activate/']) {
      expect(robotsTxt).toMatch(new RegExp(`^Disallow: ${privatePath}$`, 'm'))
    }
  })

  it('explicitly allows the public content pages added in step 10', () => {
    for (const publicPath of ['/about', '/faq', '/contact', '/shipping', '/legal/']) {
      expect(robotsTxt).toMatch(new RegExp(`^Allow: ${publicPath}$`, 'm'))
    }
  })

  it('never declares a sitemap URL while the public domain is unknown', () => {
    // Le domaine n'est pas connu : aucune URL absolue n'est inventée.
    expect(robotsTxt).not.toMatch(/^Sitemap:\s*https?:\/\//m)
  })

  it('documents the limitation: the app is a client-rendered SPA', () => {
    // A single static index.html is served for every route (vercel.json
    // rewrites), so per-route metadata only exists after hydration.
    const vercelConfig = JSON.parse(readProjectFile('vercel.json')) as {
      rewrites: { source: string; destination: string }[]
    }
    expect(vercelConfig.rewrites.some((rule) => rule.destination === '/index.html')).toBe(true)
  })
})

describe('sitemap et cohérence du routage public', () => {
  it('déclare exactement les routes publiques indexables de l’étape 10', () => {
    const sitemapPaths = STATIC_SITEMAP_ENTRIES.map((entry) => entry.path)
    for (const path of ['/about', '/faq', '/contact', '/shipping']) {
      expect(sitemapPaths).toContain(path)
    }
    for (const path of LEGAL_DOCUMENT_PATHS) {
      expect(sitemapPaths).toContain(path)
    }
  })

  it('expose un contenu indexable pour chaque route du sitemap éditorial', () => {
    for (const path of ['/about', ...LEGAL_DOCUMENT_PATHS]) {
      const document = PUBLIC_CONTENT_DOCUMENTS_BY_PATH[path]
      expect(document, `${path} doit avoir un document public`).toBeDefined()
      expect(document.path).toBe(path)
      expect(document.description.length).toBeGreaterThan(30)
    }
  })

  it('exclut toute route privée du sitemap', () => {
    const sitemapPaths = STATIC_SITEMAP_ENTRIES.map((entry) => entry.path)
    for (const privatePath of ['/login', '/register', '/cart', '/checkout', '/dashboard', '/reset-password']) {
      expect(sitemapPaths).not.toContain(privatePath)
    }
  })

  it('déclare toutes les routes du router', () => {
    const router = readProjectFile('src/app/router.tsx')

    for (const path of ['about', 'faq', 'contact', 'shipping', 'legal/notice', 'legal/terms', 'legal/privacy', 'legal/cookies']) {
      expect(router).toContain(`path: '${path}'`)
    }
  })
})