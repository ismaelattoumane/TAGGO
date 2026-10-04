import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUSINESS } from '../config/business'
import { FAQ_CATEGORIES } from './faq/faqContent'
import { aboutDocument } from './about/aboutContent'
import { legalTermsDocument } from './legal/terms'
import { legalPrivacyDocument } from './legal/privacy'
import { legalNoticeDocument } from './legal/notice'
import { legalCookiesDocument } from './legal/cookies'
import { shippingDocument } from './legal/shipping'
import type { ContentBlock, ContentDocument } from './types'

/**
 * Étape 10 — Contrôle du contenu éditorial public.
 *
 * Objectif : garantir qu'aucune information juridique, aucun délai, aucun prix
 * et aucun médiateur n'est inventé, et que les pages légales couvrent les
 * rubriques attendues avant commercialisation.
 */

function collectText(document: ContentDocument): string {
  const blocks: ContentBlock[] = [...(document.blocks ?? [])]
  for (const section of document.sections) blocks.push(...section.blocks)

  const parts: string[] = [document.title, document.description, document.lead ?? '']
  for (const block of blocks) {
    if ('text' in block) parts.push(block.text)
    if ('items' in block) parts.push(block.items.join(' '))
    if ('entries' in block) {
      for (const entry of block.entries) parts.push(`${entry.term} ${entry.description}`)
    }
  }
  return parts.join('\n')
}

function readAllContentSources(): { file: string; source: string }[] {
  const root = resolve(process.cwd(), 'src/content')
  const files: { file: string; source: string }[] = []

  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue
      files.push({ file: fullPath, source: readFileSync(fullPath, 'utf8') })
    }
  }

  walk(root)
  return files
}

const DOCUMENTS = [
  aboutDocument,
  legalNoticeDocument,
  legalPrivacyDocument,
  legalCookiesDocument,
  legalTermsDocument,
  shippingDocument,
]

describe('contenu public TAGGO — aucune donnée inventée', () => {
  const sources = readAllContentSources()
  const allText = sources.map((item) => item.source).join('\n')

  it('ne contient aucun SIRET plausible', () => {
    // Un SIRET fait 14 chiffres, séparés ou non par des espaces.
    expect(allText).not.toMatch(/(?<![\d\s])\d{3}[\s]?\d{3}[\s]?\d{3}[\s]?\d{5}(?![\d])/)
  })

  it('ne contient aucun numéro de TVA plausible', () => {
    // Préfixe FR + 2 caractères + 9 chiffres.
    expect(allText).not.toMatch(/FR\s?\d{2}[\s]?\d{9}/i)
  })

  it('ne contient aucun numéro de téléphone français plausible', () => {
    expect(allText).not.toMatch(/(?<![\d\s])0[1-9](?:[\s.]?\d{2}){4}(?![\d])/)
  })

  it('ne contient aucun prix annoncé', () => {
    expect(allText).not.toMatch(/\d+[,.]0{2}\s?€/)
    expect(allText).not.toMatch(/\b\d+\s?€\b/)
  })

  it('ne contient aucun délai de livraison annoncé', () => {
    // Formules du type « 3-4 jours », « 5 à 8 jours », « sous 24 h ».
    expect(allText).not.toMatch(/\b\d+\s?(?:à|-|–)\s?\d+\s?jours?\b/i)
    expect(allText).not.toMatch(/sous\s+\d+\s?(?:h|heures|jours?)\b/i)
  })

  it('ne cite aucun médiateur ni tribunal particulier', () => {
    for (const mediator of [
      'mediateur-conso',
      'mediateur de la consommation agréé',
      'paris mediation',
      'um mediation',
      'lyn mediation',
      'médiateur indépendant',
    ]) {
      expect(allText.toLowerCase()).not.toContain(mediator)
    }
    // Aucun tribunal géographique n'est désigné.
    expect(allText).not.toMatch(/tribunal\s+(?:de|d'|commercial\s+de)\s+[A-ZÀ-Ü]/)
  })

  it('ne remplace pas les garanties légales par une garantie commerciale inventée', () => {
    expect(allText).not.toMatch(/garantie\s+(?:commerciale\s+)?de\s+\d+\s*ans?/i)
    expect(legalTermsDocument.sections.some((section) => section.id === 'article-9-garanties')).toBe(true)
  })

  it("n'exclut pas automatiquement le droit de rétractation pour activation du QR", () => {
    const termsText = collectText(legalTermsDocument)
    expect(termsText).toMatch(/n'instaure aucune règle/i)
    expect(legalTermsDocument.sections.some((section) => section.id === 'article-7-retractation')).toBe(true)
  })

  it("ne promet aucune performance chiffrée", () => {
    expect(allText).not.toMatch(/\d+\s?(?:vues?|scans?|visites?)\s?par\s?jour/i)
    expect(allText).not.toMatch(/\d+\s?%\s?de\s?visuels?\s?scann/i)
  })

  it('ne revendique pas la propriété du principe du QR code sur un vêtement', () => {
    const noticeText = collectText(legalNoticeDocument)
    const termsText = collectText(legalTermsDocument)
    expect(noticeText).toMatch(/ne constitue pas une revendication de propriété/i)
    expect(termsText).toMatch(/ne constituent pas une revendication de propriété/i)
  })
})

describe('structure des documents publics', () => {
  it('donne à chaque document un titre, une description SEO et une route canonique', () => {
    for (const document of DOCUMENTS) {
      expect(document.path.startsWith('/')).toBe(true)
      expect(document.title.length).toBeGreaterThan(0)
      expect(document.description.length).toBeGreaterThan(20)
      expect(document.sections.length).toBeGreaterThan(0)
    }
  })

  it('utilise des identifiants de section uniques dans chaque document', () => {
    for (const document of DOCUMENTS) {
      const ids = document.sections.map((section) => section.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('affiche un placeholder pour chaque information encore inconnue', () => {
    const noticeText = collectText(legalNoticeDocument)
    expect(noticeText).toContain('[À COMPLÉTER — SIRET]')
    expect(noticeText).toContain('[À COMPLÉTER — hébergeur]')
    expect(noticeText).toContain(BUSINESS.supportEmail)
  })
})

describe('Conditions Générales de Vente', () => {
  it('contient les 18 articles attendus', () => {
    expect(legalTermsDocument.sections).toHaveLength(18)
    expect(legalTermsDocument.sections.map((section) => section.id)).toEqual([
      'article-1-objet',
      'article-2-produits',
      'article-3-prix',
      'article-4-commande',
      'article-5-paiement',
      'article-6-livraison',
      'article-7-retractation',
      'article-8-retours',
      'article-9-garanties',
      'article-10-taggo',
      'article-11-contenus',
      'article-12-suspension',
      'article-13-responsabilite',
      'article-14-donnees',
      'article-15-propriete',
      'article-16-reclamations',
      'article-17-mediation',
      'article-18-droit',
    ])
  })

  it('distingue les garanties légales de conformité, vices cachés et commerciale', () => {
    const text = collectText(legalTermsDocument)
    expect(text).toContain('Garantie légale de conformité')
    expect(text).toContain('Garantie des vices cachés')
    expect(text).toContain('Garantie commerciale TAGGO')
  })

  it('qualifie le délai de rétractation selon le droit français', () => {
    const text = collectText(legalTermsDocument)
    expect(text).toMatch(/quatorze \(14\) jours/)
    expect(text).toMatch(/Code de la consommation/)
  })

  it('ne rend pas une clause de compétence opposable au consommateur', () => {
    const text = collectText(legalTermsDocument)
    expect(text).toMatch(/ne peut être opposée? au consommateur/i)
  })

  it('laisse le médiateur à compléter', () => {
    const text = collectText(legalTermsDocument)
    expect(text).toContain('[À COMPLÉTER — médiateur de la consommation]')
  })
})

describe('Politique de confidentialité', () => {
  const REQUIRED_SECTIONS = [
    'responsable-traitement',
    'donnees-collectees',
    'finalites',
    'bases-legales',
    'paiement',
    'emails-transactionnels',
    'newsletter',
    'cookies',
    'durees-conservation',
    'destinataires',
    'sous-traitants',
    'transferts-hors-ue',
    'securite',
    'droits',
    'exercer-droits',
    'cnil',
    'contact-rgpd',
  ]

  it('couvre toutes les rubriques RGPD attendues', () => {
    const ids = legalPrivacyDocument.sections.map((section) => section.id)
    expect(ids).toEqual(expect.arrayContaining(REQUIRED_SECTIONS))
  })

  it('documente uniquement les sous-traitants réellement utilisés', () => {
    const subProcessing = legalPrivacyDocument.sections.find(
      (section) => section.id === 'sous-traitants',
    )

    expect(subProcessing).toBeDefined()

    const entries = (subProcessing?.blocks ?? []).flatMap((block) =>
      'entries' in block ? block.entries : [],
    )
    expect(entries.map((entry) => entry.term)).toEqual(['Supabase', 'Stripe', 'Vercel'])

    // Aucun prestataire de communication marketing n'est déclaré : il n'est pas
    // utilisé par TAGGO et ne doit donc pas figurer dans la liste.
    const subProcessingText = entries.map((entry) => `${entry.term} ${entry.description}`).join(' ')
    expect(subProcessingText).not.toMatch(
      /Mailchimp|SendGrid|Amazon SES|Brevo|Google Analytics|Meta Pixel/i,
    )
  })

  it('indique le contact RGPD validé', () => {
    expect(collectText(legalPrivacyDocument)).toContain(BUSINESS.supportEmail)
  })
})

describe('Politique cookies', () => {
  it('déclare les quatre catégories et distingue celles inutilisées', () => {
    const cookiesSection = legalCookiesDocument.sections.filter((section) =>
      section.id.startsWith('categorie-'),
    )
    expect(cookiesSection).toHaveLength(4)

    const text = collectText(legalCookiesDocument)
    expect(text).toContain('Non utilisé par TAGGO à ce jour')
  })
})

describe('FAQ', () => {
  it('expose exactement les six catégories attendues', () => {
    expect(FAQ_CATEGORIES.map((category) => category.title)).toEqual([
      'Produit',
      'Utilisation & transfert',
      'Commandes & tailles',
      'Livraison & retours',
      'Dashboard',
      'Paiement & sécurité',
    ])
  })

  it('donne à chaque question un identifiant unique et une réponse non vide', () => {
    const ids = FAQ_CATEGORIES.flatMap((category) => category.items.map((item) => item.id))
    expect(new Set(ids).size).toBe(ids.length)

    for (const category of FAQ_CATEGORIES) {
      for (const item of category.items) {
        expect(item.question.length).toBeGreaterThan(5)
        expect(item.answer.length).toBeGreaterThan(0)
        for (const paragraph of item.answer) expect(paragraph.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('utilise des placeholders pour les informations non confirmées', () => {
    const faqText = JSON.stringify(FAQ_CATEGORIES)
    expect(faqText).toContain('[À COMPLÉTER — matière]')
    expect(faqText).toContain('[À COMPLÉTER — certification]')
    expect(faqText).toContain('[À COMPLÉTER — délai de préparation]')
    expect(faqText).toContain('[À COMPLÉTER — délai de livraison France]')
    expect(faqText).toContain('[À COMPLÉTER — délai de livraison Europe]')
    expect(faqText).toContain('[À COMPLÉTER — délai de livraison international]')
    expect(faqText).toContain('[À COMPLÉTER — seuil de livraison offerte]')
    expect(faqText).toContain('[À COMPLÉTER — prix de l’abonnement]')
    expect(faqText).toContain('[À COMPLÉTER — moyens de paiement]')
    expect(faqText).toContain('[À COMPLÉTER — fournisseur de paiement]')
    expect(faqText).toContain('[À COMPLÉTER — guide des tailles]')
    expect(faqText).toContain('[À COMPLÉTER — politique de retour]')
  })

  it("ne présente pas l'abonnement comme définitif", () => {
    const subscription = FAQ_CATEGORIES.find((category) => category.id === 'dashboard')?.items.find(
      (item) => item.id === 'dashboard-abonnement',
    )
    expect(subscription).toBeDefined()
    expect(subscription?.answer.join(' ')).toMatch(/prix de l'abonnement/i)
    expect(subscription?.answer.join(' ')).toMatch(/première année gratuite/i)
  })
})

describe('Page À propos', () => {
  it('reprend le ton TAGGO sans promesse chiffrée', () => {
    expect(aboutDocument.title).toBe('Le vêtement qui connecte.')
    const text = collectText(aboutDocument)
    expect(text).toContain('On en avait marre des t-shirts vides')
    expect(text).toContain('Viper')
    expect(text).toContain('Isma')
    expect(text).toMatch(/La visibilité, ça s.imprime/)
    expect(text).toMatch(/ne publie aucune promesse chiffrée/i)
  })
})

describe('Livraison et retours', () => {
  it('ne publie aucun délai confirmé', () => {
    const text = collectText(shippingDocument)
    expect(text).toContain('[À COMPLÉTER — délai de préparation]')
    expect(text).toContain('[À COMPLÉTER — délai de livraison France]')
    expect(text).toContain('[À COMPLÉTER — transporteur]')
  })
})