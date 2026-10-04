/**
 * ÉTAPE 10 — Source de vérité unique pour les informations d'entreprise TAGGO.
 *
 * RÈGLE ABSOLUE : aucune valeur légale, aucun prix, aucun délai, aucun numéro
 * de téléphone, aucun médiateur et aucune certification n'est inventé ici.
 * Tant que TAGGO n'a pas validé une donnée, la valeur est `null` et les pages
 * publiques affichent un placeholder explicitement identifié.
 *
 * Ce module est importé par le frontend (pages publiques) ET par la couche
 * serveur d'emails. Il ne doit contenir aucun secret.
 */

export type PendingFieldKey =
  | 'legalForm'
  | 'capital'
  | 'siret'
  | 'vatNumber'
  | 'address'
  | 'phone'
  | 'director'
  | 'host'
  | 'hostAddress'
  | 'hostPhone'
  | 'mediator'
  | 'mediatorWebsite'
  | 'mediatorContact'
  | 'returnAddress'
  | 'material'
  | 'certifications'
  | 'sizeGuide'
  | 'returnPolicy'
  | 'paymentProvider'
  | 'paymentMethods'
  | 'subscriptionPrice'
  | 'promoCode'
  | 'deliveryCarrier'
  | 'productionDelay'
  | 'deliveryDelayFrance'
  | 'deliveryDelayEurope'
  | 'deliveryDelayInternational'
  | 'freeShippingThreshold'
  | 'careInstructions'

export type BusinessInfo = {
  /** Raison sociale / marque. Donnée confirmée par le brief projet. */
  businessName: string
  tagline: string
  /** Adresse de support confirmée par le brief projet. */
  supportEmail: string
  /** Site principalement destiné à la France au lancement. */
  primaryMarket: string
  legalForm: string | null
  capital: string | null
  siret: string | null
  vatNumber: string | null
  address: string | null
  phone: string | null
  director: string | null
  host: string | null
  hostAddress: string | null
  hostPhone: string | null
  mediator: string | null
  mediatorWebsite: string | null
  mediatorContact: string | null
  returnAddress: string | null
  material: string | null
  certifications: string | null
  sizeGuide: string | null
  returnPolicy: string | null
  paymentProvider: string | null
  paymentMethods: string | null
  subscriptionPrice: string | null
  promoCode: string | null
  deliveryCarrier: string | null
  productionDelay: string | null
  deliveryDelayFrance: string | null
  deliveryDelayEurope: string | null
  deliveryDelayInternational: string | null
  freeShippingThreshold: string | null
  careInstructions: string | null
}

/**
 * Informations d'entreprise.
 * Toute valeur `null` = information non confirmée par TAGGO à ce jour.
 */
export const BUSINESS: BusinessInfo = {
  businessName: 'TAGGO',
  tagline: 'Le vêtement qui connecte.',
  supportEmail: 'support-taggo@protonmail.com',
  primaryMarket: 'France',

  legalForm: null,
  capital: null,
  siret: null,
  vatNumber: null,
  address: null,
  phone: null,
  director: null,

  host: null,
  hostAddress: null,
  hostPhone: null,

  mediator: null,
  mediatorWebsite: null,
  mediatorContact: null,

  returnAddress: null,

  material: null,
  certifications: null,
  sizeGuide: null,
  returnPolicy: null,

  paymentProvider: null,
  paymentMethods: null,
  subscriptionPrice: null,
  promoCode: null,

  deliveryCarrier: null,
  productionDelay: null,
  deliveryDelayFrance: null,
  deliveryDelayEurope: null,
  deliveryDelayInternational: null,
  freeShippingThreshold: null,
  careInstructions: null,
}

/**
 * Étiquettes des placeholders affichées dans les pages publiques.
 * Une valeur absente n'est jamais masquée : elle devient
 * `[À COMPLÉTER — <label>]`, visible par tous et facile à repérer.
 */
export const PLACEHOLDER_LABELS: Record<PendingFieldKey, string> = {
  legalForm: 'forme juridique',
  capital: 'capital social',
  siret: 'SIRET',
  vatNumber: 'TVA intracommunautaire',
  address: 'adresse du siège social',
  phone: 'téléphone',
  director: 'directeur de publication',
  host: 'hébergeur',
  hostAddress: 'adresse de l’hébergeur',
  hostPhone: 'téléphone de l’hébergeur',
  mediator: 'médiateur de la consommation',
  mediatorWebsite: 'site du médiateur',
  mediatorContact: 'contact du médiateur',
  returnAddress: 'adresse de retour',
  material: 'matière',
  certifications: 'certification',
  sizeGuide: 'guide des tailles',
  returnPolicy: 'politique de retour',
  paymentProvider: 'fournisseur de paiement',
  paymentMethods: 'moyens de paiement',
  subscriptionPrice: 'prix de l’abonnement',
  promoCode: 'code promotionnel',
  deliveryCarrier: 'transporteur',
  productionDelay: 'délai de préparation',
  deliveryDelayFrance: 'délai de livraison France',
  deliveryDelayEurope: 'délai de livraison Europe',
  deliveryDelayInternational: 'délai de livraison international',
  freeShippingThreshold: 'seuil de livraison offerte',
  careInstructions: 'conseils d’entretien',
}

/** Jeton de placeholder rendu dans les pages publiques. */
export function placeholderFor(key: PendingFieldKey): string {
  return `[À COMPLÉTER — ${PLACEHOLDER_LABELS[key]}]`
}

/**
 * Valeur affichable d'un champ métier : la valeur si elle existe, sinon le
 * placeholder. Utilisé par les pages légales, la FAQ et les emails.
 */
export function businessValue(key: PendingFieldKey): string {
  const value = BUSINESS[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : placeholderFor(key)
}

/** `true` si l'information est encore inconnue (affichage placeholder). */
export function isPending(key: PendingFieldKey): boolean {
  return businessValue(key) === placeholderFor(key)
}

/** Liste des champs encore inconnus — utilisée par les tests et la doc. */
export function pendingFields(): PendingFieldKey[] {
  return (Object.keys(PLACEHOLDER_LABELS) as PendingFieldKey[]).filter(isPending)
}

/**
 * Date de dernière révision des documents légaux. Elle décrit la rédaction du
 * document dans ce dépôt, pas une validation juridique.
 */
export const LEGAL_DOCUMENTS_UPDATED_AT = '2026-09-30'

/**
 * Mention obligatoire : ces documents sont rédigés pour être complétés et
 * validés par TAGGO (et par un conseil juridique) avant commercialisation.
 */
export const LEGAL_REVIEW_NOTICE =
  'Ce document est une base de travail rédigée pour TAGGO. Il doit être complété et validé ' +
  'par TAGGO et par un conseil juridique avant toute mise en production commerciale.'