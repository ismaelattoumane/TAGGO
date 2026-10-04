import Stripe from 'stripe'
import { assertTestModeKey } from './env'
import { WEBHOOK_TOLERANCE_SECONDS } from './limits'
import type {
  StripeCheckoutSessionInput,
  StripeCheckoutSessionOutput,
  StripeEvent,
  StripeGateway,
} from './types'

/**
 * ÉTAPE 9 — passerelle Stripe (serveur uniquement).
 *
 * Le SDK n'est importé que par les fonctions `/api` : il n'entre jamais dans le
 * bundle navigateur (rien sous `src/` ne l'importe). Aucune Checkout Session
 * n'est créée avec une clé secrète depuis le frontend.
 *
 * La clé de webhook est passée à chaque appel : aucun état global mutable.
 */
export function createStripeGateway(secretKey: string): StripeGateway {
  assertTestModeKey(secretKey)
  const stripe = new Stripe(secretKey)

  return {
    async createCheckoutSession(input: StripeCheckoutSessionInput): Promise<StripeCheckoutSessionOutput> {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        client_reference_id: input.orderId,
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        locale: 'fr',
        // Montants issus EXCLUSIVEMENT du catalogue serveur.
        line_items: input.lines.map((line) => ({
          quantity: line.quantity,
          price_data: {
            currency: line.currency.toLowerCase(),
            unit_amount: line.unitAmountCents,
            product_data: {
              name: line.name,
              ...(line.description ? { description: line.description.slice(0, 500) } : {}),
            },
          },
        })),
        // Metadata interne minimale : aucune donnée personnelle.
        metadata: { order_id: input.orderId },
        payment_intent_data: { metadata: { order_id: input.orderId } },
      })

      if (!session.url) throw new Error('stripe_session_without_url')

      return { id: session.id, url: session.url }
    },

    constructWebhookEvent(rawBody: string, signature: string, webhookSecret: string): StripeEvent {
      const event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
        WEBHOOK_TOLERANCE_SECONDS,
      )

      return {
        id: event.id,
        type: event.type,
        data: { object: event.data.object as unknown as Record<string, unknown> },
      }
    },
  }
}