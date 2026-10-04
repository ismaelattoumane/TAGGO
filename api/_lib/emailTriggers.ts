import { renderEmail } from '../../src/emails'
import type {
  CartAbandonedEmailData,
  EmailPromo,
  OrderEmailData,
  PasswordResetEmailData,
  ReviewEmailData,
  ShippingEmailData,
  WelcomeEmailData,
} from '../../src/emails/emailTypes'
import type { OrderLineDraft } from '../../src/emails/templates/lineItems'
import type { EmailJob } from './emailDispatch'

/**
 * ÉTAPE 10 — Construction des emails transactionnels à partir d'événements
 * métier. Ce module ne fait QUE traduire un événement confirmé en job.
 *
 * L'envoi reste une décision serveur : voir `dispatchTransactionalEmail`.
 * Aucun de ces builders n'est importé par le frontend.
 */

export type OrderEmailContext = {
  orderId: string
  /** Référence lisible par le client. Fournie par le serveur, jamais déduite ici. */
  reference: string
  email: string
  firstName: string
  lines: OrderLineDraft[]
  /** Montant calculé et formaté par le serveur. */
  totalFormatted: string
  /** URL du dashboard construite côté serveur à partir de `APP_URL`. */
  dashboardUrl: string
}

function baseOrderData(context: OrderEmailContext): OrderEmailData {
  return {
    to: context.email,
    firstName: context.firstName,
    orderId: context.orderId,
    reference: context.reference,
    lines: context.lines,
    totalFormatted: context.totalFormatted,
    dashboardUrl: context.dashboardUrl,
  }
}

/** Commande payée confirmée côté serveur. */
export function buildOrderConfirmedJob(context: OrderEmailContext): EmailJob {
  const data = baseOrderData(context)

  return {
    type: 'ORDER_CONFIRMED',
    reference: context.orderId,
    orderId: context.orderId,
    to: context.email,
    render: () => renderEmail({ type: 'ORDER_CONFIRMED', data: { ...data, lines: context.lines } }),
  }
}

export type ShippingEmailContext = OrderEmailContext & {
  carrierName: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  estimatedDelay: string | null
}

/** Colis remis au transporteur. */
export function buildOrderShippedJob(context: ShippingEmailContext): EmailJob {
  const data: ShippingEmailData = {
    ...baseOrderData(context),
    carrierName: context.carrierName,
    trackingNumber: context.trackingNumber,
    trackingUrl: context.trackingUrl,
    estimatedDelay: context.estimatedDelay,
  }

  return {
    type: 'ORDER_SHIPPED',
    reference: context.orderId,
    orderId: context.orderId,
    to: context.email,
    render: () => renderEmail({ type: 'ORDER_SHIPPED', data }),
  }
}

/** Colis livré. */
export function buildOrderDeliveredJob(context: OrderEmailContext): EmailJob {
  const data = baseOrderData(context)

  return {
    type: 'ORDER_DELIVERED',
    reference: context.orderId,
    orderId: context.orderId,
    to: context.email,
    render: () => renderEmail({ type: 'ORDER_DELIVERED', data }),
  }
}

export type ReviewEmailContext = OrderEmailContext & {
  reviewUrl: string | null
  promo: EmailPromo | null
}

/** Demande d'avis, envoyée plusieurs jours après la livraison confirmée. */
export function buildReviewRequestJob(context: ReviewEmailContext): EmailJob {
  const data: ReviewEmailData = {
    ...baseOrderData(context),
    reviewUrl: context.reviewUrl,
    promo: context.promo,
  }

  return {
    type: 'REVIEW_REQUEST',
    reference: context.orderId,
    orderId: context.orderId,
    to: context.email,
    render: () => renderEmail({ type: 'REVIEW_REQUEST', data }),
  }
}

export type CartAbandonedContext = {
  email: string
  firstName: string
  /** Identifiant stable de la session panier, utilisé pour l'idempotence. */
  cartReference: string
  productName: string
  size: string | null
  color: string | null
  priceFormatted: string
  cartUrl: string
  promo: EmailPromo | null
}

export function buildCartAbandonedJob(context: CartAbandonedContext): EmailJob {
  const data: CartAbandonedEmailData = {
    to: context.email,
    firstName: context.firstName,
    productName: context.productName,
    size: context.size,
    color: context.color,
    priceFormatted: context.priceFormatted,
    cartUrl: context.cartUrl,
    promo: context.promo,
  }

  return {
    type: 'CART_ABANDONED',
    reference: context.cartReference,
    to: context.email,
    render: () => renderEmail({ type: 'CART_ABANDONED', data }),
  }
}

export type WelcomeContext = {
  email: string
  firstName: string
  /** Identifiant du compte : clé d'idempotence de l'email de bienvenue. */
  accountReference: string
  collectionUrl: string
  howItWorksUrl: string
  dashboardUrl: string
  promo: EmailPromo | null
}

export function buildWelcomeJob(context: WelcomeContext): EmailJob {
  const data: WelcomeEmailData = {
    to: context.email,
    firstName: context.firstName,
    collectionUrl: context.collectionUrl,
    howItWorksUrl: context.howItWorksUrl,
    dashboardUrl: context.dashboardUrl,
    promo: context.promo,
  }

  return {
    type: 'WELCOME',
    reference: context.accountReference,
    to: context.email,
    render: () => renderEmail({ type: 'WELCOME', data }),
  }
}

export type PasswordResetContext = {
  email: string
  firstName: string
  /** Lien produit par le mécanisme d'authentification. */
  resetUrl: string
  /** Durée de validité réellement configurée, ou `null`. */
  expiresIn: string | null
}

export function buildPasswordResetJob(context: PasswordResetContext): EmailJob {
  const data: PasswordResetEmailData = {
    to: context.email,
    firstName: context.firstName,
    resetUrl: context.resetUrl,
    expiresIn: context.expiresIn,
  }

  return {
    type: 'PASSWORD_RESET',
    reference: context.email,
    to: context.email,
    render: () => renderEmail({ type: 'PASSWORD_RESET', data }),
  }
}

/** URL absolue du dashboard, construite à partir de `APP_URL`. */
export function buildDashboardUrl(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, '')}/dashboard`
}