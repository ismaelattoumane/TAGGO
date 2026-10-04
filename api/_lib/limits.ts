/**
 * ÉTAPE 9 — Limites serveur.
 *
 * Ces bornes protègent le serveur contre les requêtes falsifiées ou abusives
 * (quantité géante, panier surdimensionné, corps de webhook surdimensionné).
 */

import { MAX_PAYMENT_LINE_QUANTITY, MAX_PAYMENT_LINES } from '../../src/features/payments/paymentTypes'

export { MAX_PAYMENT_LINE_QUANTITY, MAX_PAYMENT_LINES }

/** Stripe autorise un webhook de quelques dizaines de Ko : marge largement suffisante. */
export const MAX_RAW_BODY_BYTES = 128 * 1024

/**
 * Fenêtre de tolérance de la signature Stripe (protection anti-rejeu).
 * Doit rester alignée sur la tolérance par défaut de `stripe.webhooks.constructEvent`.
 */
export const WEBHOOK_TOLERANCE_SECONDS = 300