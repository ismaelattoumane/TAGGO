import { BUSINESS, businessValue, LEGAL_DOCUMENTS_UPDATED_AT, LEGAL_REVIEW_NOTICE } from '../../config/business'
import type { ContentDocument } from '../types'

/**
 * ÉTAPE 10 — Mentions légales (route `/legal/notice`).
 *
 * Toutes les informations non confirmées par TAGGO sont rendues via
 * `businessValue(...)`, qui produit un placeholder visible
 * `[À COMPLÉTER — …]`. Aucune donnée légale n'est inventée.
 */
export const legalNoticeDocument: ContentDocument = {
  path: '/legal/notice',
  eyebrow: 'Informations légales',
  title: 'Mentions légales',
  description:
    'Mentions légales du site TAGGO : éditeur, directeur de publication, hébergeur et propriété intellectuelle.',
  lead: `Dernière révision : ${LEGAL_DOCUMENTS_UPDATED_AT}. ${LEGAL_REVIEW_NOTICE}`,
  sections: [
    {
      id: 'editeur',
      title: 'Éditeur du site',
      blocks: [
        { kind: 'paragraph', text: 'Le présent site est édité par :' },
        {
          kind: 'definition',
          entries: [
            { term: 'Nom', description: BUSINESS.businessName },
            { term: 'Forme juridique', description: businessValue('legalForm') },
            { term: 'Capital social', description: businessValue('capital') },
            { term: 'SIRET', description: businessValue('siret') },
            { term: 'TVA intracommunautaire', description: businessValue('vatNumber') },
            { term: 'Siège social', description: businessValue('address') },
            { term: 'Email', description: BUSINESS.supportEmail },
            { term: 'Téléphone', description: businessValue('phone') },
          ],
        },
      ],
    },
    {
      id: 'directeur-publication',
      title: 'Directeur de publication',
      blocks: [
        {
          kind: 'paragraph',
          text: `Le directeur de la publication est : ${businessValue('director')}.`,
        },
        {
          kind: 'paragraph',
          text: `Pour toute demande relative au site, à une commande ou à l'exercice d'un droit, vous pouvez écrire à ${BUSINESS.supportEmail}.`,
        },
      ],
    },
    {
      id: 'hebergeur',
      title: 'Hébergeur',
      blocks: [
        { kind: 'paragraph', text: 'Le site est hébergé par :' },
        {
          kind: 'definition',
          entries: [
            { term: 'Hébergeur', description: businessValue('host') },
            { term: 'Adresse', description: businessValue('hostAddress') },
            { term: 'Téléphone', description: businessValue('hostPhone') },
          ],
        },
      ],
    },
    {
      id: 'propriete-intellectuelle',
      title: 'Propriété intellectuelle',
      blocks: [
        {
          kind: 'paragraph',
          text: `L'ensemble des éléments composant le site TAGGO — le nom, le logo, l'identité visuelle, les textes, les illustrations, les photographies, les maquettes, le code source et les bases de données — est détenu par TAGGO ou fait l'objet d'une autorisation d'utilisation. Ces éléments sont protégés par le droit d'auteur et par le droit des marques.`,
        },
        {
          kind: 'paragraph',
          text: "Toute reproduction, représentation, modification, publication, adaptation ou exploitation, totale ou partielle, de ces éléments, sur quelque support et par quelque procédé que ce soit, est interdite sans autorisation écrite préalable de TAGGO.",
        },
        {
          kind: 'paragraph',
          text: "Les demandes de reproduction d'un contenu ou d'une marque peuvent être adressées à l'adresse de contact TAGGO. Une autorisation n'est jamais présumée.",
        },
        {
          kind: 'note',
          text: "Cette section porte uniquement sur les éléments effectivement utilisés par TAGGO. Elle ne constitue pas une revendication de propriété sur des techniques, des concepts ou des domaines de tiers, et notamment pas sur le principe d'un QR code lisible sur un vêtement. Une stratégie de protection (marque, brevet, dessin ou modèle) doit être établie avec un conseil juridique avant toute commercialisation.",
        },
      ],
    },
    {
      id: 'responsabilite-contenu',
      title: 'Limitation de responsabilité sur le contenu',
      blocks: [
        {
          kind: 'paragraph',
          text: "TAGGO s'efforce d'assurer l'exactitude des informations publiées sur le site. Toutefois, les visuels, les descriptions produit, les délais, les disponibilités et les caractéristiques techniques sont fournis à titre informatif et peuvent évoluer. Les informations affichées sur un profil public ou via un QR code relèvent de la responsabilité de leur auteur.",
        },
      ],
    },
  ],
}