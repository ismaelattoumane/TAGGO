import { BUSINESS, LEGAL_DOCUMENTS_UPDATED_AT, LEGAL_REVIEW_NOTICE } from '../../config/business'
import type { ContentDocument, ContentSection } from '../types'

export type CookieCategoryId = 'necessary' | 'preferences' | 'analytics' | 'marketing'

export type CookieCategory = {
  id: CookieCategoryId
  title: string
  /** Une catégorie requise ne peut pas être refusée. */
  required: boolean
  /** `false` = la catégorie n'est pas utilisée par TAGGO aujourd'hui. */
  inUse: boolean
  /**
   * `false` = la catégorie est utilisée mais ne peut pas être refusée : c'est le
   * cas des traitements strictement nécessaires, et de la mesure d'audience
   * interne qui n'utilise ni cookie ni identifiant. Présenter ces catégories
   * comme des cases à cocher prometrait un refus qui n'existe pas.
   */
  consentRequired: boolean
  description: string
  examples: string[]
  duration: string
}

/**
 * ÉTAPE 10 (mise à jour ÉTAPE 11) — Catégories réellement utilisées par TAGGO.
 *
 * Aucun traceur tiers n'est installé : la catégorie « publicité / reciblage »
 * reste explicitement marquée comme inutilisée.
 *
 * ÉTAPE 11 : la catégorie « mesure d’audience » devient utilisée, mais par
 * TAGGO lui-même et sans cookie. Le comptage des scans ne peut identifier ni
 * suivre une personne (aucune IP, aucun device, aucun identifiant de visiteur),
 * il relève donc de la mesure d'audience interne exemptée de consentement.
 * Aucune donnée n'est transmise à un tiers.
 */
export const COOKIE_CATEGORIES: CookieCategory[] = [
  {
    id: 'necessary',
    title: 'Cookies et stockages strictement nécessaires',
    required: true,
    inUse: true,
    consentRequired: false,
    description:
      "Indispensables au fonctionnement du site : connexion au compte TAGGO, panier, sécurité et mémorisation de votre choix relatif aux cookies. Ils ne sont pas soumis à consentement car leur activation est nécessaire à un serviceexplicitement demandé.",
    examples: [
      'Session d’authentification du compte TAGGO (stockage local du navigateur, géré par Supabase).',
      'Panier d’achat et nombre d’articles.',
      'Préférence de choix relatif aux cookies.',
      'Jetons techniques de sécurité et de protection contre les requêtes abusives.',
    ],
    duration: 'Session courante, ou tant que le compte et les données associées sont conservés.',
  },
  {
    id: 'preferences',
    title: 'Cookies de préférence',
    required: false,
    inUse: true,
    consentRequired: true,
    description:
      'Mémorisent vos choix d’affichage et de consentement afin de ne pas vous les redemander à chaque visite. Ils ne transmettent aucune information à un tiers.',
    examples: ['Mémorisation du choix « accepter / refuser / personnaliser » relatif aux cookies.'],
    duration: 'Jusqu’à la suppression des données de navigation ou votre prochain choix.',
  },
  {
    id: 'analytics',
    title: 'Mesure d’audience',
    required: false,
    inUse: true,
    consentRequired: false,
    description:
      "TAGGO compte le nombre de scans de vos TAGGO dans votre espace propriétaire. Ce comptage est réalisé par TAGGO lui-même, sans aucun outil tiers, sans cookie, sans pixel et sans aucun outil de mesure d'audience externe. Il est exempté de consentement car il ne permet pas d'identifier, de suivre ou de profiler une personne : aucune adresse IP, aucun appareil, aucun navigateur, aucun pays, aucune adresse de provenance et aucun identifiant de visiteur ne sont conservés. Seul le TAGGO concerné et la date du scan sont enregistrés, et ces statistiques ne sont visibles que par vous, propriétaire du TAGGO.",
    examples: [
      'Compteur du nombre de scans de chaque TAGGO, affiché uniquement dans votre tableau de bord.',
      'Évolution des scans sur 7, 30 ou 90 jours.',
      'Horodatage des scans récents.',
    ],
    duration:
      'Tant que le TAGGO existe dans votre compte. Les données sont supprimées avec le TAGGO.',
  },
  {
    id: 'marketing',
    title: 'Publicité et reciblage',
    required: false,
    inUse: false,
    consentRequired: true,
    description:
      "TAGGO n'utilise aucune plateforme publicitaire, aucun pixel et aucun traçage marketing à ce jour. Aucune donnée de navigation n'est transmise à des régies publicitaires.",
    examples: [],
    duration: 'Non applicable tant qu’aucune régie publicitaire n’est utilisée.',
  },
]

export function cookieCategoryById(id: CookieCategoryId): CookieCategory {
  const category = COOKIE_CATEGORIES.find((item) => item.id === id)
  if (!category) throw new Error(`unknown_cookie_category:${id}`)
  return category
}

/** Catégories pour lesquelles un consentement est demandable. */
export const OPTIONAL_COOKIE_CATEGORIES: CookieCategory[] = COOKIE_CATEGORIES.filter(
  (category) => !category.required,
)

export const legalCookiesDocument: ContentDocument = {
  path: '/legal/cookies',
  eyebrow: 'Données personnelles',
  title: 'Politique cookies',
  description:
    'Politique cookies de TAGGO : cookies strictement nécessaires, préférences, mesure d’audience et publicité. Aucun traceur tiers n’est utilisé.',
  lead: `Dernière révision : ${LEGAL_DOCUMENTS_UPDATED_AT}. ${LEGAL_REVIEW_NOTICE}`,
  blocks: [
    {
      kind: 'paragraph',
      text: `Cette page explique les cookies et stockages locaux utilisés par ${BUSINESS.businessName}, ce qu'ils permettent et comment les gérer. Vous pouvez à tout moment retirer votre consentement depuis le lien « Modifier mes choix » présent en bas de page.`,
    },
  ],
  sections: [
    {
      id: 'principe',
      title: 'Principe',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO applique le principe du consentement pour tout traçage non strictement nécessaire. Les cookies strictement nécessaires au service sont directement mis en service sans consentement préalable, conformément à la réglementation applicable.",
        },
      ],
    },
    ...COOKIE_CATEGORIES.map<ContentSection>((category) => ({
      id: `categorie-${category.id}`,
      title: category.title,
      blocks: [
        {
          kind: 'paragraph',
          text: category.description,
        },
        {
          kind: 'definition',
          entries: [
            { term: 'Statut', description: category.inUse ? 'Utilisé par TAGGO' : 'Non utilisé par TAGGO à ce jour' },
            {
              term: 'Consentement requis',
              description: category.consentRequired
                ? 'Oui'
                : category.required
                  ? 'Non (strictement nécessaire)'
                  : 'Non (mesure d’audience interne sans cookie ni identifiant, qui ne permet pas d’identifier une personne)',
            },
            { term: 'Durée de conservation', description: category.duration },
          ],
        },
        ...(category.examples.length > 0
          ? [{ kind: 'bullets' as const, items: category.examples }]
          : []),
      ],
    })),
    {
      id: 'gestion',
      title: 'Gérer vos choix',
      blocks: [
        {
          kind: 'paragraph',
          text: "Vous pouvez accepter, refuser ou personnaliser vos choix depuis le bandeau affiché lors de votre première visite, puis les modifier à tout moment via le lien « Modifier mes choix » en bas de page.",
        },
        {
          kind: 'paragraph',
          text: "Vous pouvez également supprimer ou bloquer les cookies depuis les paramètres de votre navigateur. Le blocage des cookies strictement nécessaires peut empêcher l'utilisation de la connexion et du panier.",
        },
        {
          kind: 'note',
          text: "TAGGO n'utilisant aucun traceur tiers, aucun outil tiers n'est nécessaire pour vérifier les catégories actives : les informations ci-dessus reflètent l'état réel du site.",
        },
      ],
    },
    {
      id: 'contact-cookies',
      title: 'Contact',
      blocks: [
        {
          kind: 'paragraph',
          text: `Pour toute question relative aux cookies, écrivez à ${BUSINESS.supportEmail}.`,
        },
      ],
    },
  ],
}