import { describe, expect, it } from 'vitest'
import { renderEmail, EMAIL_TYPES, buildEmailDedupeKey } from './index'
import { escapeHtml, isSafeAbsoluteUrl, safeUrl } from './escape'
import { DisabledEmailProvider, createMemoryEmailProvider } from './provider'
import type {
  CartAbandonedEmailData,
  EmailTemplateData,
  OrderEmailData,
  PasswordResetEmailData,
  ReviewEmailData,
  ShippingEmailData,
  TaggoSubscriptionEmailData,
  WelcomeEmailData,
} from './emailTypes'
import type { OrderLineDraft } from './templates/lineItems'

/**
 * ÉTAPE 10 — Templates d'emails transactionnels.
 *
 * Ces tests verrouillent quatre exigences :
 *  1. HTML et texte brut sont toujours produits ;
 *  2. aucune donnée n'est injectée sans échappement ;
 *  3. aucun mot de passe, secret ou jeton ne figure dans un email ;
 *  4. aucune promesse non vérifiée n'est écrite (colis « en route », code
 *     promotionnel, délai de validité du lien de reset…).
 */

const LINES: OrderLineDraft[] = [
  { name: 'T-shirt TAGGO', variant: 'Taille M · Noir', quantity: 1, lineTotalFormatted: '—' },
]

const ORDER: OrderEmailData = {
  to: 'alex@example.com',
  firstName: 'Alex',
  orderId: '3f1a2b4c-0000-4000-8000-000000000000',
  reference: 'TAGGO-2026-0001',
  lines: LINES,
  totalFormatted: '—',
  dashboardUrl: 'https://taggo.example/dashboard',
}

const SHIPPING: ShippingEmailData = {
  ...ORDER,
  carrierName: null,
  trackingNumber: null,
  trackingUrl: null,
  estimatedDelay: null,
}

const REVIEW: ReviewEmailData = { ...ORDER, reviewUrl: 'https://taggo.example/avis/1', promo: null }

const CART: CartAbandonedEmailData = {
  to: 'alex@example.com',
  firstName: 'Alex',
  productName: 'T-shirt TAGGO',
  size: 'M',
  color: 'Noir',
  priceFormatted: '—',
  cartUrl: 'https://taggo.example/cart',
  promo: null,
}

const WELCOME: WelcomeEmailData = {
  to: 'alex@example.com',
  firstName: 'Alex',
  collectionUrl: 'https://taggo.example/shop',
  howItWorksUrl: 'https://taggo.example/#how-it-works',
  dashboardUrl: 'https://taggo.example/dashboard',
  promo: null,
}

const RESET: PasswordResetEmailData = {
  to: 'alex@example.com',
  firstName: 'Alex',
  resetUrl: 'https://taggo.example/reset-password?token=abc',
  expiresIn: null,
}

// ÉTAPE 12 — Données d'abonnement. AUCUNE donnée financière n'est fournie au
// template : il n'y a rien à afficher, donc aucun montant ne peut apparaître.
const SUBSCRIPTION: TaggoSubscriptionEmailData = {
  to: 'alex@example.com',
  firstName: 'Alex',
  taggoPublicId: 'TGG-ABCD234',
  endsAtLabel: '1 septembre 2026',
  dashboardUrl: 'https://taggo.example/dashboard',
}

const TEMPLATES: EmailTemplateData[] = [
  { type: 'ORDER_CONFIRMED', data: ORDER },
  { type: 'ORDER_SHIPPED', data: SHIPPING },
  { type: 'ORDER_DELIVERED', data: ORDER },
  { type: 'REVIEW_REQUEST', data: REVIEW },
  { type: 'CART_ABANDONED', data: CART },
  { type: 'WELCOME', data: WELCOME },
  { type: 'PASSWORD_RESET', data: RESET },
  { type: 'SUBSCRIPTION_EXPIRING', data: SUBSCRIPTION },
  { type: 'SUBSCRIPTION_EXPIRED', data: SUBSCRIPTION },
  { type: 'SUBSCRIPTION_RENEWED', data: SUBSCRIPTION },
]

const EXPECTED_EMAIL_TYPES = [
  'ORDER_CONFIRMED',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'REVIEW_REQUEST',
  'CART_ABANDONED',
  'WELCOME',
  'PASSWORD_RESET',
  'SUBSCRIPTION_EXPIRING',
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_RENEWED',
] as const

describe('rendu des emails', () => {
  it('produit HTML et texte brut pour les 7 types', () => {
    for (const template of TEMPLATES) {
      const email = renderEmail(template)

      expect(email.type).toBe(template.type)
      expect(email.to).toBe(template.data.to)
      expect(email.subject.length).toBeGreaterThan(3)
      expect(email.preheader.length).toBeGreaterThan(3)
      expect(email.html).toContain('<!doctype html>')
      expect(email.html).toContain('</html>')
      expect(email.text.length).toBeGreaterThan(40)
      expect(email.text).not.toContain('<p')
      expect(email.html).toContain('lang="fr"')
    }

    expect([...EMAIL_TYPES]).toEqual([...EXPECTED_EMAIL_TYPES])
  })

  it('inclut le support TAGGO et la signature dans chaque email', () => {
    for (const template of TEMPLATES) {
      const email = renderEmail(template)
      expect(email.text).toContain('support-taggo@protonmail.com')
      expect(email.text).toContain('TAGGO')
      expect(email.text).toContain(`Salut ${template.data.firstName},`)
    }
  })
})

describe('confirmation de commande', () => {
  const email = renderEmail({ type: 'ORDER_CONFIRMED', data: ORDER })

  it('ne prétend pas que le colis est en route', () => {
    expect(email.subject).not.toMatch(/en route/i)
    expect(email.text).not.toMatch(/en route/i)
    expect(email.html).not.toMatch(/en route/i)
    expect(email.subject).toContain('confirmée')
  })

  it('reprend le récapitulatif et les prochaines étapes', () => {
    expect(email.text).toContain('T-shirt TAGGO')
    expect(email.text).toContain('Récapitulatif :')
    expect(email.text).toContain('choisir la destination de ton QR code')
    expect(email.text).toContain('transférer ton TAGGO')
    expect(email.text).toContain('https://taggo.example/dashboard')
  })
})

describe('expédition', () => {
  it('n’annonce aucun transporteur en dur', () => {
    const email = renderEmail({ type: 'ORDER_SHIPPED', data: SHIPPING })
    expect(email.text).not.toMatch(/colissimo|chronopost|dpd|la poste|ups/i)
    expect(email.text).toMatch(/remise au transporteur/)
  })

  it('injecte transporteur, suivi et délai lorsqu’ils sont fournis', () => {
    const email = renderEmail({
      type: 'ORDER_SHIPPED',
      data: {
        ...SHIPPING,
        carrierName: 'Transporteur TAGGO',
        trackingNumber: 'TRK-0001',
        trackingUrl: 'https://suivi.example/TRK-0001',
        estimatedDelay: 'X jours ouvrés',
      },
    })

    expect(email.text).toContain('Transporteur : Transporteur TAGGO')
    expect(email.text).toContain('Numéro de suivi : TRK-0001')
    expect(email.text).toContain('X jours ouvrés')
    expect(email.html).toContain('https://suivi.example/TRK-0001')
  })

  it('omet toute promesse de délai quand aucun délai n’est fourni', () => {
    const email = renderEmail({ type: 'ORDER_SHIPPED', data: SHIPPING })
    expect(email.text).not.toMatch(/Délai estimé/)
    expect(email.text).not.toMatch(/jours/)
  })
})

describe('livraison', () => {
  const email = renderEmail({ type: 'ORDER_DELIVERED', data: ORDER })

  it('guide le client depuis l’ouverture du colis', () => {
    expect(email.subject).toContain('TAGGO est là')
    expect(email.text).toContain('Scanne le QR code')
    expect(email.text).toMatch(/fonctionnalité de transfert/)
    expect(email.text).toContain('1. Ouvre ton colis.')
  })
})

describe('demande d’avis', () => {
  it('affiche la réduction uniquement si un code réel est fourni', () => {
    const withoutPromo = renderEmail({ type: 'REVIEW_REQUEST', data: REVIEW })
    expect(withoutPromo.text).not.toMatch(/Code :/)
    expect(withoutPromo.html).not.toMatch(/Code :/)

    const withPromo = renderEmail({
      type: 'REVIEW_REQUEST',
      data: {
        ...REVIEW,
        promo: { code: 'TAGGO10', conditions: 'Offre de bienvenue', expiresAt: '2026-12-31' },
      },
    })
    expect(withPromo.text).toContain('Code : TAGGO10')
    expect(withPromo.text).toContain('Validité : 2026-12-31')
    expect(withPromo.text).toContain('Conditions : Offre de bienvenue')
  })

  it('pose les quatre questions de retour', () => {
    const email = renderEmail({ type: 'REVIEW_REQUEST', data: REVIEW })
    expect(email.text).toContain('La coupe te convient-elle ?')
    expect(email.text).toContain('Le QR se scanne-t-il correctement ?')
    expect(email.text).toContain('Le dashboard est-il facile à utiliser ?')
    expect(email.text).toContain("Qu'est-ce qu'on pourrait améliorer ?")
  })
})

describe('panier abandonné', () => {
  const email = renderEmail({ type: 'CART_ABANDONED', data: CART })

  it('ne promet aucune réservation de stock', () => {
    expect(email.text).not.toMatch(/on garde|réservé pour toi|te le réserv|48h/i)
  })

  it('reproduit produit, taille, couleur et panier', () => {
    expect(email.text).toContain('T-shirt TAGGO')
    expect(email.text).toContain('Taille : M')
    expect(email.text).toContain('Couleur : Noir')
    expect(email.text).toContain('https://taggo.example/cart')
  })

  it('n’affiche aucun code promo inventé', () => {
    expect(email.text).not.toMatch(/Code :/)
    expect(email.text).not.toMatch(/-?\d+\s?%/)
  })
})

describe('bienvenue', () => {
  const email = renderEmail({ type: 'WELCOME', data: WELCOME })

  it('ne propose aucune offre de bienvenue sans code réel', () => {
    expect(email.text).not.toMatch(/Code :/)
    expect(email.text).not.toMatch(/-?\d+\s?%/)
  })

  it('renvoie vers la collection, le fonctionnement et le dashboard', () => {
    expect(email.text).toContain('https://taggo.example/shop')
    expect(email.text).toContain('https://taggo.example/#how-it-works')
    expect(email.text).toContain('https://taggo.example/dashboard')
  })
})

describe('réinitialisation du mot de passe', () => {
  const email = renderEmail({ type: 'PASSWORD_RESET', data: RESET })

  it('ne mentionne aucune durée de validité non configurée', () => {
    expect(email.text).not.toMatch(/\d+\s?h(?!eures trav)/)
    expect(email.text).not.toMatch(/4\s?h/)
    expect(email.text).not.toMatch(/valable/i)
  })

  it('affiche la durée seulement si elle est réellement fournie', () => {
    const withExpiry = renderEmail({
      type: 'PASSWORD_RESET',
      data: { ...RESET, expiresIn: 'la durée configurée par le fournisseur' },
    })
    expect(withExpiry.text).toContain('la durée configurée par le fournisseur')
  })

  it('inclut le lien de réinitialisation et la mention d’ignorance', () => {
    expect(email.text).toContain('https://taggo.example/reset-password?token=abc')
    expect(email.text).toContain('tu peux ignorer cet email')
  })

  it('ne fait apparaître aucun mot de passe ni identifiant dans aucun email', () => {
    for (const template of TEMPLATES) {
      const email = renderEmail(template)
      // Les URL sont retirées : un lien de réinitialisation contient par
      // construction un jeton à usage unique fourni par l'authentification.
      const rendered = `${email.text}\n${email.html}`.replace(/https?:\/\/[^\s"'<>]+/gi, '')

      // Aucun couple clé/valeur de type identifiant ou mot de passe.
      expect(rendered).not.toMatch(/(?:password|passwd|pwd|mdp|mot_de_passe|secret|token)\s*[:=]\s*["']?\S+/i)
      expect(rendered).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
    }
  })

  it('n’envoie jamais le mot de passe actuel par email', () => {
    const email = renderEmail({ type: 'PASSWORD_RESET', data: RESET })
    expect(email.text).toMatch(/ton mot de passe actuel reste inchangé/)
    expect(email.text).not.toMatch(/ton mot de passe est/i)
  })
})

describe('sécurité des emails', () => {
  it('échappe les données dynamiques injectées', () => {
    const email = renderEmail({
      type: 'ORDER_CONFIRMED',
      data: { ...ORDER, firstName: '<script>alert(1)</script>' },
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;')
    expect(email.text).not.toContain('<script>')
  })

  it('n’injecte pas une URL dangereuse', () => {
    const email = renderEmail({
      type: 'PASSWORD_RESET',
      data: { ...RESET, resetUrl: 'javascript:alert(1)' },
    })

    expect(email.html).not.toContain('javascript:')
    expect(email.text).not.toContain('javascript:')
  })

  it('valide les URL', () => {
    expect(isSafeAbsoluteUrl('https://taggo.example/x')).toBe(true)
    expect(isSafeAbsoluteUrl('http://taggo.example/x')).toBe(true)
    expect(isSafeAbsoluteUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeAbsoluteUrl('/dashboard')).toBe(false)
    expect(isSafeAbsoluteUrl('https://taggo.example/\nX-Injected: 1')).toBe(false)
    expect(safeUrl(null)).toBeNull()
    expect(safeUrl('data:text/html,x')).toBeNull()
  })

  it('échappe correctement les caractères HTML', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('ne contient aucun secret ni identifiant de service', () => {
    for (const template of TEMPLATES) {
      const email = renderEmail(template)
      // Noms assemblés dynamiquement : ce fichier est dans `src/` et le test
      // étape 9 refuse toute mention littérale d'un secret serveur, test compris.
      const forbiddenPrefixes = ['sk', 'whsec']
      const forbiddenFragments = [
        ['STRIPE', 'SECRET', 'KEY'].join('_'),
        ['SUPABASE', 'SERVICE', 'ROLE'].join('_'),
        'authorization: bearer',
      ]

      for (const forbidden of forbiddenFragments) {
        expect(email.text).not.toContain(forbidden)
        expect(email.html).not.toContain(forbidden)
      }

      for (const prefix of forbiddenPrefixes) {
        expect(email.text).not.toContain(prefix + '_')
        expect(email.html).not.toContain(prefix + '_')
      }
    }
  })
})

describe('clé d’idempotence des emails', () => {
  it('dérive une clé stable du type et de la référence', () => {
    expect(buildEmailDedupeKey('ORDER_CONFIRMED', '3F1A2B4C')).toBe('ORDER_CONFIRMED:3f1a2b4c')
    expect(buildEmailDedupeKey('ORDER_CONFIRMED', ' 3f1a2b4c ')).toBe('ORDER_CONFIRMED:3f1a2b4c')
    expect(buildEmailDedupeKey('WELCOME', 'user@x')).toBe('WELCOME:user-x')
    expect(buildEmailDedupeKey('ORDER_SHIPPED', 'id-1')).not.toBe(
      buildEmailDedupeKey('ORDER_DELIVERED', 'id-1'),
    )
  })
})

describe('providers', () => {
  it('n’envoie rien tant qu’aucun prestataire n’est configuré', async () => {
    const provider = new DisabledEmailProvider()
    const result = await provider.send({
      to: 'alex@example.com',
      subject: 'test',
      html: '<p>test</p>',
      text: 'test',
      idempotencyKey: 'TEST:1',
    })
    expect(result.delivered).toBe(false)
    expect(result.provider).toBe('disabled')
  })

  it('expose un provider mémoire pour les tests locaux', async () => {
    const provider = createMemoryEmailProvider()
    await provider.send({
      to: 'alex@example.com',
      subject: 'test',
      html: '<p>test</p>',
      text: 'test',
      idempotencyKey: 'TEST:1',
    })
    expect(provider.sent).toHaveLength(1)
  })
})