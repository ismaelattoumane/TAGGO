import { useEffect } from 'react'

/**
 * TAGGO page metadata (title, description, canonical, robots, Open Graph,
 * Twitter/X).
 *
 * `index.html` ships with `noindex, nofollow` as the safe default, so every
 * public page must explicitly opt in. Shop and public content pages are
 * indexed, private pages (dashboard, cart, checkout) stay out of the index.
 */

const DEFAULT_ROBOTS = 'noindex, nofollow'
const CANONICAL_LINK_ID = 'taggo-canonical-link'

const SITE_NAME = 'TAGGO'
/** Image sociale par défaut : un logo local, aucune URL externe inventée. */
const DEFAULT_OG_IMAGE_PATH = '/logo/logo.svg'

export type PageSeo = {
  title: string
  description: string
  /** Absolute app path, e.g. `/shop/tshirt-taggo`. */
  canonicalPath?: string
  noindex?: boolean
  /** `website` par défaut, `article` pour les pages éditoriales longues. */
  ogType?: 'website' | 'article'
  /** Chemin local de l'image sociale. Défaut : logo TAGGO. */
  ogImagePath?: string
}

function buildCanonicalUrl(pathname: string): string | null {
  if (typeof window === 'undefined' || !window.location?.origin) return null

  const base = import.meta.env.BASE_URL || '/'
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  const normalizedBase = base.endsWith('/') ? base : `${base}/`

  return `${window.location.origin}${normalizedBase}${normalizedPath.replace(/^\//, '')}`
}

function buildAssetUrl(path: string): string {
  if (typeof window === 'undefined' || !window.location?.origin) return path

  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${window.location.origin}${normalizedBase}${path.replace(/^\//, '')}`
}

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string): HTMLMetaElement {
  const existing = document.querySelector<HTMLMetaElement>(selector)
  if (existing) return existing

  const meta = document.createElement('meta')
  meta.setAttribute(attribute, key)
  document.head.appendChild(meta)
  return meta
}

export function usePageSeo({
  title,
  description,
  canonicalPath,
  noindex = false,
  ogType = 'website',
  ogImagePath = DEFAULT_OG_IMAGE_PATH,
}: PageSeo): void {
  useEffect(() => {
    const previousTitle = document.title

    document.title = title

    const descriptionMeta = upsertMeta('meta[name="description"]', 'name', 'description')
    const previousDescription = descriptionMeta.content
    descriptionMeta.content = description

    const robotsMeta = upsertMeta('meta[name="robots"]', 'name', 'robots')
    const previousRobots = robotsMeta.content
    robotsMeta.content = noindex ? DEFAULT_ROBOTS : 'index, follow'

    let canonical: HTMLLinkElement | null = null
    const canonicalUrl = canonicalPath ? buildCanonicalUrl(canonicalPath) : null

    if (canonicalUrl) {
      canonical = document.getElementById(CANONICAL_LINK_ID) as HTMLLinkElement | null
      if (!canonical) {
        canonical = document.createElement('link')
        canonical.id = CANONICAL_LINK_ID
        canonical.rel = 'canonical'
        document.head.appendChild(canonical)
      }
      canonical.href = canonicalUrl
    }

    // Open Graph + Twitter/X. Toutes les URL sont construites localement : aucune
    // URL sociale externe n'est inventée.
    const socialValues: Array<[string, 'name' | 'property', string, string]> = [
      ['meta[property="og:site_name"]', 'property', 'og:site_name', SITE_NAME],
      ['meta[property="og:type"]', 'property', 'og:type', ogType],
      ['meta[property="og:title"]', 'property', 'og:title', title],
      ['meta[property="og:description"]', 'property', 'og:description', description],
      ['meta[property="og:locale"]', 'property', 'og:locale', 'fr_FR'],
      ['meta[property="og:image"]', 'property', 'og:image', buildAssetUrl(ogImagePath)],
      ['meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image'],
      ['meta[name="twitter:title"]', 'name', 'twitter:title', title],
      ['meta[name="twitter:description"]', 'name', 'twitter:description', description],
      ['meta[name="twitter:image"]', 'name', 'twitter:image', buildAssetUrl(ogImagePath)],
    ]

    if (canonicalUrl) {
      socialValues.push(['meta[property="og:url"]', 'property', 'og:url', canonicalUrl])
    }

    const createdMetas: HTMLMetaElement[] = []
    const previousSocial = socialValues.map(([selector, attribute, key, value]) => {
      const meta = upsertMeta(selector, attribute, key)
      const previous = meta.content
      if (!meta.isConnected) createdMetas.push(meta)
      meta.content = value
      return { meta, previous }
    })

    return () => {
      document.title = previousTitle
      descriptionMeta.content = previousDescription
      robotsMeta.content = previousRobots
      if (canonical && canonicalPath) canonical.remove()
      previousSocial.forEach(({ meta, previous }) => {
        if (createdMetas.includes(meta)) meta.remove()
        else meta.content = previous
      })
    }
  }, [title, description, canonicalPath, noindex, ogType, ogImagePath])
}