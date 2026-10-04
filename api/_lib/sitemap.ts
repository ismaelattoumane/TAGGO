import { LEGAL_DOCUMENT_PATHS } from '../../src/content/legal'
import { listShopProducts } from '../../src/features/shop/catalog'

/**
 * ÉTAPE 10 — Sitemap XML généré côté serveur.
 *
 * Le domaine public n'est pas connu à ce jour : aucune URL absolue n'est
 * inventée. Sans `APP_URL` configurée, la fonction répond 404 et le site
 * fonctionne normalement — seule la directive `Sitemap:` de robots.txt manque
 * alors, à ajouter une fois le domaine validé.
 */

export type SitemapEntry = {
  path: string
  changefreq: 'daily' | 'weekly' | 'monthly'
  priority: string
}

/** Routes publiques indexables, hors pages produit générées dynamiquement. */
export const STATIC_SITEMAP_ENTRIES: SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/shop', changefreq: 'weekly', priority: '0.9' },
  { path: '/about', changefreq: 'monthly', priority: '0.6' },
  { path: '/faq', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.5' },
  { path: '/shipping', changefreq: 'monthly', priority: '0.5' },
  ...LEGAL_DOCUMENT_PATHS.map((path) => ({
    path,
    changefreq: 'monthly' as const,
    priority: '0.3',
  })),
]

/** Fiches produit publiques réellement cataloguees. */
export function productSitemapEntries(): SitemapEntry[] {
  return listShopProducts().map((product) => ({
    path: `/shop/${product.slug}`,
    changefreq: 'weekly' as const,
    priority: '0.8',
  }))
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildSitemapXml(appUrl: string): string {
  const base = appUrl.replace(/\/+$/, '')
  const entries = [...STATIC_SITEMAP_ENTRIES, ...productSitemapEntries()]

  const urls = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${escapeXml(`${base}${entry.path}`)}</loc>\n` +
        `    <changefreq>${entry.changefreq}</changefreq>\n` +
        `    <priority>${entry.priority}</priority>\n  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}