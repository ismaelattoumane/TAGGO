import { renderCartAbandonedEmail } from './templates/cartAbandoned'
import { renderDeliveryEmail } from './templates/delivery'
import { renderOrderConfirmationEmail } from './templates/orderConfirmed'
import { renderPasswordResetEmail } from './templates/passwordReset'
import { renderReviewRequestEmail } from './templates/review'
import { renderShippingEmail } from './templates/shipping'
import {
  renderSubscriptionExpiredEmail,
  renderSubscriptionExpiringEmail,
  renderSubscriptionRenewedEmail,
} from './templates/subscription'
import { renderWelcomeEmail } from './templates/welcome'
import { EMAIL_TYPES, type EmailTemplateData, type EmailType, type RenderedEmail } from './emailTypes'

export { EMAIL_TYPES }
export type { EmailTemplateData, EmailType, RenderedEmail }
export type { EmailDraft } from './templates/lineItems'

/**
 * ÉTAPE 10 — Rendu d'un email transactionnel.
 *
 * Chaque fonction renvoie l'objet, l'aperçu, le HTML et le texte brut. Le rendu
 * est PUR : aucune donnée n'est lue, aucun envoi n'est effectué ici.
 * L'envoi est déclenché uniquement côté serveur (`api/_lib/emailDispatch.ts`).
 */
export function renderEmail(template: EmailTemplateData): RenderedEmail {
  switch (template.type) {
    case 'ORDER_CONFIRMED': {
      const draft = renderOrderConfirmationEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'ORDER_SHIPPED': {
      const draft = renderShippingEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'ORDER_DELIVERED': {
      const draft = renderDeliveryEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'REVIEW_REQUEST': {
      const draft = renderReviewRequestEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'CART_ABANDONED': {
      const draft = renderCartAbandonedEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'WELCOME': {
      const draft = renderWelcomeEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'PASSWORD_RESET': {
      const draft = renderPasswordResetEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'SUBSCRIPTION_EXPIRING': {
      const draft = renderSubscriptionExpiringEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'SUBSCRIPTION_EXPIRED': {
      const draft = renderSubscriptionExpiredEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    case 'SUBSCRIPTION_RENEWED': {
      const draft = renderSubscriptionRenewedEmail(template.data)
      return { type: template.type, to: template.data.to, ...draft }
    }

    default: {
      throw new Error(`unknown_email_type:${String((template as { type: string }).type)}`)
    }
  }
}

/**
 * Clé d'idempotence canonique d'un email.
 *
 * Elle est dérivée de l'événement métier (commande + type), jamais du contenu
 * rendu : deux rendus du même événement produisent la même clé.
 */
export function buildEmailDedupeKey(type: EmailType, subjectReference: string): string {
  const normalizedReference = subjectReference
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${type}:${normalizedReference}`
}