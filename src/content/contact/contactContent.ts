import { BUSINESS, businessValue, LEGAL_DOCUMENTS_UPDATED_AT } from '../../config/business'
import type { ContentBlock, ContentSection } from '../types'

export type ContactChannel = {
  id: string
  label: string
  value: string
  href: string | null
  blocks: ContentBlock[]
}

export const CONTACT_CHANNELS: ContactChannel[] = [
  {
    id: 'email',
    label: 'Email',
    value: BUSINESS.supportEmail,
    href: `mailto:${BUSINESS.supportEmail}`,
    blocks: [
      {
        kind: 'paragraph',
        text: "C'est le canal de contact principal de TAGGO. Indique ta référence de commande si ta demande concerne un achat : ça nous permet de répondre plus vite.",
      },
    ],
  },
  {
    id: 'telephone',
    label: 'Téléphone',
    value: businessValue('phone'),
    href: null,
    blocks: [
      {
        kind: 'paragraph',
        text: "Aucun numéro de téléphone TAGGO n'est encore publié. Passe par l'email : c'est le canal le plus suivi.",
      },
    ],
  },
]

export const CONTACT_SECTIONS: ContentSection[] = [
  {
    id: 'delai-reponse',
    title: 'Délai de réponse',
    blocks: [
      {
        kind: 'paragraph',
        text: "TAGGO répond aux demandes dans les meilleurs délais. Aucun délai de réponse contractuel n'est publié à ce jour.",
      },
    ],
  },
  {
    id: 'avant-ecrire',
    title: 'Avant d’écrire',
    blocks: [
      {
        kind: 'paragraph',
        text: "Beaucoup de questions trouvent déjà leur réponse dans les pages suivantes :",
      },
      {
        kind: 'bullets',
        items: [
          'Les questions fréquentes sur le produit, les tailles, la livraison et les retours.',
          'Les informations de livraison et de retours.',
          'Les conditions générales de vente, qui détaillent les retours et les garanties légales.',
        ],
      },
    ],
  },
  {
    id: 'donnees-contact',
    title: 'Données transmises',
    blocks: [
      {
        kind: 'paragraph',
        text: "Le formulaire ci-dessus se prépare dans votre messagerie : aucune donnée n'est envoyée à un serveur TAGGO, aucun message n'est stocké par TAGGO. Vous décidez vous-même de l'envoyer.",
      },
      {
        kind: 'note',
        text: `Si vous préférez utiliser votre messagerie directement, écrivez à ${BUSINESS.supportEmail}.`,
      },
    ],
  },
]

export const CONTACT_UPDATED_AT = LEGAL_DOCUMENTS_UPDATED_AT