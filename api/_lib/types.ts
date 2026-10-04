/**
 * ÉTAPE 9 — Types structurels minimaux pour les fonctions Vercel.
 *
 * Aucun déploiement de types supplémentaire n'est nécessaire : on ne déclare que
 * les champs réellement utilisés par les handlers, ce qui garde le serveur
 * testable sans dépendance à `@vercel/node`.
 */

export type ApiRequest = {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  /** Corps déjà parsé (Vercel ne le parse pas pour nous en Node runtime). */
  body?: unknown
  /** Flux de la requête brute (body non parsé, signature Stripe). */
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  setEncoding?: (encoding: string) => void
  read?: () => unknown
  /** Paramètres de requête déjà analysés par la plateforme. */
  query?: Record<string, string | string[] | undefined>
}

export type ApiResponse = {
  status: number
  body: unknown
  headers?: Record<string, string>
}

export type StripeCheckoutLineInput = {
  name: string
  description?: string
  unitAmountCents: number
  currency: string
  quantity: number
}

export type StripeCheckoutSessionInput = {
  orderId: string
  currency: string
  lines: StripeCheckoutLineInput[]
  successUrl: string
  cancelUrl: string
}

export type StripeCheckoutSessionOutput = {
  id: string
  url: string
}

export interface StripeGateway {
  createCheckoutSession(input: StripeCheckoutSessionInput): Promise<StripeCheckoutSessionOutput>
  constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string): StripeEvent
}

export type StripeCheckoutSessionLike = {
  id: string
  amount_total: number | null
  currency: string | null
  payment_status: string | null
  payment_intent?: string | null
  metadata?: Record<string, string> | null
}

export type StripeEvent = {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}