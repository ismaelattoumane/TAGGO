/** Données structurées schema.org de la landing (Organization, WebSite, WebPage, FAQPage). Pur, testable. */
export type FaqEntry = { question: string; answer: readonly string[] }

export type LandingJsonLdOptions = {
  /** Origine du site, ex. https://taggo.space (sans slash final). */
  origin: string
  title: string
  description: string
  supportEmail: string
  faq: readonly FaqEntry[]
  /** Chemin du logo carré (défaut : icône Android 512 du dépôt). */
  logoPath?: string
}

export function buildLandingJsonLd(options: LandingJsonLdOptions): Record<string, unknown> {
  const origin = options.origin.replace(/\/+$/, '')
  const url = `${origin}/`
  const organizationId = `${url}#organization`
  const websiteId = `${url}#website`

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': organizationId,
        name: 'TAGGO',
        url,
        logo: `${origin}${options.logoPath ?? '/android-chrome-512x512.png'}`,
        slogan: 'Le vêtement qui connecte.',
        description:
          'Vêtements connectés : un QR code intégré au T-shirt donne accès à une identité numérique personnalisable.',
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: options.supportEmail,
          availableLanguage: 'fr',
        },
      },
      { '@type': 'WebSite', '@id': websiteId, url, name: 'TAGGO', inLanguage: 'fr-FR', publisher: { '@id': organizationId } },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: options.title,
        description: options.description,
        inLanguage: 'fr-FR',
        isPartOf: { '@id': websiteId },
        about: { '@id': organizationId },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: options.faq.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: { '@type': 'Answer', text: entry.answer.join(' ') },
        })),
      },
    ],
  }
}

/** Sérialisation sûre pour <script type="application/ld+json"> (neutralise « < »). */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
