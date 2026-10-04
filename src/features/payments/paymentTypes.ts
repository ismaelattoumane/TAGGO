/**
 * ÉTAPE 9 — Contrats partagés entre le frontend TAGGO et les fonctions serveur.
 *
 * Ce fichier ne contient QUE des types et des constantes : aucune logique, aucun
 * secret, aucune dépendance. Il est importé à la fois par le bundle navigateur
 * et par les fonctions serveur Vercel (`/api`).
 *
 * Principe : le navigateur envoie uniquement des RÉFÉRENCES
 * (`variantId` + `quantity`). Le prix, la devise, le sous-total, la disponibilité
 * et l'identité du client sont résolus côté serveur.
 */

export const PAYMENT_CURRENCY = 'EUR'

/** Limite de quantité par ligne : identique à l'étape 8. */
export const MAX_PAYMENT_LINE_QUANTITY = 10

/** Nombre maximum de lignes acceptées par une commande. */
export const MAX_PAYMENT_LINES = 20

export type CheckoutRequestItem = {
  variantId: string
  quantity: number
}

export type CheckoutRequest = {
  items: CheckoutRequestItem[]
}

export type PaymentErrorCode =
  | 'unauthenticated'
  | 'empty_cart'
  | 'invalid_item'
  | 'invalid_quantity'
  | 'variant_not_found'
  | 'variant_unavailable'
  | 'price_unavailable'
  | 'invalid_currency'
  | 'invalid_order'
  | 'order_not_found'
  | 'session_not_found'
  | 'stripe_unavailable'
  | 'stripe_error'
  | 'invalid_signature'
  | 'invalid_request'

export type PaymentError = {
  code: PaymentErrorCode
  /** Message affichable, en français, sans détail technique. */
  message: string
}

export type CheckoutSuccessResponse = {
  ok: true
  orderId: string
  sessionId: string
  /** URL Stripe Checkout : le navigateur y est redirigé, rien n'est calculé ici. */
  url: string
}

export type CheckoutErrorResponse = PaymentError & { ok: false }

export type CheckoutResponse = CheckoutSuccessResponse | CheckoutErrorResponse

/**
 * État du paiement côté serveur, exposé au frontend pour l'affichage.
 * `paid` n'est vrai que si le backend l'affirme (webhook Stripe traité).
 */
export type PaymentConfigResponse = {
  stripeConfigured: boolean
  /** Vrai seulement si le catalogue serveur a des prix ET Stripe est configuré. */
  checkoutAvailable: boolean
  reason: 'stripe_unconfigured' | 'pricing_unavailable' | null
  message: string
}

export type OrderPaymentStatusResponse = {
  ok: true
  orderId: string
  status: string
  paid: boolean
  /** Nombre de TAGGO effectivement assignés par le webhook. */
  taggoCount: number
}

export type OrderPaymentStatusErrorResponse = PaymentError & { ok: false }

export type OrderPaymentStatusResponseType =
  | OrderPaymentStatusResponse
  | OrderPaymentStatusErrorResponse

/** Erreurs de checkout traduites côté frontend (aucun détail technique exposé). */
export const PAYMENT_ERROR_MESSAGES: Record<PaymentErrorCode, string> = {
  unauthenticated: 'Connectez-vous pour passer commande.',
  empty_cart: 'Votre panier est vide.',
  invalid_item: 'Votre panier contient un article invalide.',
  invalid_quantity: 'La quantité demandée est invalide.',
  variant_not_found: 'Un article de votre panier n’existe plus.',
  variant_unavailable: 'Un article de votre panier n’est plus disponible.',
  price_unavailable: 'Le paiement sera disponible prochainement.',
  invalid_currency: 'Devise non prise en charge.',
  invalid_order: 'Référence de commande invalide.',
  order_not_found: 'Commande introuvable.',
  session_not_found: 'Session de paiement introuvable.',
  stripe_unavailable: 'Paiement indisponible — Stripe n’est pas configuré.',
  stripe_error: 'Le paiement n’a pas pu être initialisé. Réessayez.',
  invalid_signature: 'Signature de paiement invalide.',
  invalid_request: 'Requête de paiement invalide.',
}