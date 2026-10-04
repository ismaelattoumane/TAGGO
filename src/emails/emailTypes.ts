/**
 * ÉTAPE 10 — Types des emails transactionnels TAGGO.
 *
 * RÈGLE ABSOLUE : ce module ne contient que des types. Il n'est jamais importé
 * par le frontend pour déclencher un envoi. Les emails sont rendus et envoyés
 * côté serveur uniquement (`api/_lib/email*.ts`).
 */

export const EMAIL_TYPES = [
  'ORDER_CONFIRMED',
  'ORDER_SHIPPED',
  'ORDER_DELIVERED',
  'REVIEW_REQUEST',
  'CART_ABANDONED',
  'WELCOME',
  'PASSWORD_RESET',
  // ETAPE 12 — Abonnements TAGGO. Ces trois evenements sont prevus ; AUCUN
  // declencheur automatique n'est cable (le projet n'a pas de planificateur).
  'SUBSCRIPTION_EXPIRING',
  'SUBSCRIPTION_EXPIRED',
  'SUBSCRIPTION_RENEWED',
] as const

export type EmailType = (typeof EMAIL_TYPES)[number]

/** Ligne de commande affichée dans un email. */
export type EmailOrderLine = {
  name: string
  /** Ex. « Taille M · Noir ». `null` si la variante n'est pas renseignée. */
  variant: string | null
  quantity: number
  /** Montant de la ligne, calculé et formaté par le serveur. Jamais recalculé ici. */
  lineTotalFormatted: string
}

/**
 * Bloc promotionnel.
 * Il n'est RENDU que si `code` est non vide : aucun code n'est inventé, aucun
 * code promotionnel n'est affiché tant qu'aucune offre réelle n'est active.
 */
export type EmailPromo = {
  code: string | null
  conditions: string | null
  expiresAt: string | null
}

export type OrderEmailData = {
  to: string
  firstName: string
  orderId: string
  /** Référence lisible par le client (ex. « TAGGO-0001 »), fournie par le serveur. */
  reference: string
  lines: EmailOrderLine[]
  /** Montant déjà calculé et formaté par le serveur. Jamais recalculé ici. */
  totalFormatted: string
  /** URL absolue du dashboard, construite et validée côté serveur. */
  dashboardUrl: string
}

export type ShippingEmailData = OrderEmailData & {
  /** Transporteur réellement utilisé, injecté dynamiquement. Jamais codé en dur. */
  carrierName: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  /** Délai annoncé, validé par TAGGO. `null` = aucune durée promise. */
  estimatedDelay: string | null
}

export type ReviewEmailData = OrderEmailData & {
  /** Lien du questionnaire d'avis. `null` = aucun questionnaire n'est prêt. */
  reviewUrl: string | null
  promo: EmailPromo | null
}

export type CartAbandonedEmailData = {
  to: string
  firstName: string
  productName: string
  size: string | null
  color: string | null
  priceFormatted: string
  cartUrl: string
  promo: EmailPromo | null
}

export type WelcomeEmailData = {
  to: string
  firstName: string
  collectionUrl: string
  howItWorksUrl: string
  dashboardUrl: string
  promo: EmailPromo | null
}

export type PasswordResetEmailData = {
  to: string
  firstName: string
  /** Lien de réinitialisation fourni par le mécanisme d'authentification. */
  resetUrl: string
  /**
   * Durée de validité du lien. `null` tant que le fournisseur d'authentification
   * n'a pas de durée configurée et vérifiée : aucune durée n'est annoncée.
   */
  expiresIn: string | null
}

/**
 * ETAPE 12 — Donnees d'un email d'abonnement.
 *
 * Regle stricte : aucune donnee financiere. Ni montant, ni identifiant Stripe,
 * ni reference de commande. Le message ne parle que du TAGGO concerne, de la
 * date d'echeance reelle et de la page ou agir.
 */
export type TaggoSubscriptionEmailData = {
  to: string
  firstName: string
  /** Code public du TAGGO (`TGG-XXXXXXX`), seul identifiant utile au client. */
  taggoPublicId: string
  /** Date de fin de periode, deja formatee par le serveur. */
  endsAtLabel: string | null
  /** Page du TAGGO dans le dashboard, ou le renouvellement sera propose. */
  dashboardUrl: string
}

export type EmailTemplateData =
  | { type: 'ORDER_CONFIRMED'; data: OrderEmailData }
  | { type: 'ORDER_SHIPPED'; data: ShippingEmailData }
  | { type: 'ORDER_DELIVERED'; data: OrderEmailData }
  | { type: 'REVIEW_REQUEST'; data: ReviewEmailData }
  | { type: 'CART_ABANDONED'; data: CartAbandonedEmailData }
  | { type: 'WELCOME'; data: WelcomeEmailData }
  | { type: 'PASSWORD_RESET'; data: PasswordResetEmailData }
  | { type: 'SUBSCRIPTION_EXPIRING'; data: TaggoSubscriptionEmailData }
  | { type: 'SUBSCRIPTION_EXPIRED'; data: TaggoSubscriptionEmailData }
  | { type: 'SUBSCRIPTION_RENEWED'; data: TaggoSubscriptionEmailData }

/** Email rendu, prêt à être transmis à un provider. */
export type RenderedEmail = {
  type: EmailType
  to: string
  subject: string
  preheader: string
  html: string
  text: string
}

export type EmailSendRequest = {
  to: string
  subject: string
  html: string
  text: string
  /** Clé d'idempotence fournie par l'appelant serveur. */
  idempotencyKey: string
}

export type EmailSendResult = {
  delivered: boolean
  provider: string
  providerMessageId: string | null
}

/**
 * Interface provider. Aucun fournisseur n'est branché à ce jour : brancher un
 * service transactionnel consiste à implémenter cette interface et à renvoyer
 * l'instance depuis `api/_lib/emailProvider.ts`.
 */
export interface EmailProvider {
  readonly name: string
  send(request: EmailSendRequest): Promise<EmailSendResult>
}