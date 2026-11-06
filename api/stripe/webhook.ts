import { isServerDatabaseConfigured, isStripeConfigured, readServerEnv } from '../_lib/env'
import { getHeader, json, readRawBody } from '../_lib/http'
import { failure } from '../_lib/errors'
import { createServerSupabase } from '../_lib/supabaseAdmin'
import { createStripeGateway } from '../_lib/stripeGateway'
import { beginStripeEvent, finishStripeEvent, findOrderForPayment, markOrderPaid, reserveTaggos } from '../_lib/orderServer'
import { processStripeEvent, stripeWebhookHttpStatus } from '../_lib/webhook'
import { dispatchTransactionalEmail } from '../_lib/emailDispatch'
import { beginEmailEvent, finishEmailEvent } from '../_lib/emailServer'
import { createEmailProvider } from '../_lib/emailProvider'
import { buildOrderConfirmedJob, buildDashboardUrl } from '../_lib/emailTriggers'
import { loadOrderEmailContext } from '../_lib/orderEmailContext'
import type { ApiRequest, ApiResponse } from '../_lib/types'

/**
 * POST /api/stripe/webhook
 *
 * SÉCURITÉ :
 * - le corps BRUT est lu tel quel (aucun `JSON.parse` avant vérification) ;
 * - la signature `stripe-signature` est vérifiée avec `STRIPE_WEBHOOK_SECRET` ;
 * - toute requête invalide est rejetée en 400 sans détail ;
 * - l'idempotence est assurée par une contrainte UNIQUE côté SQL ;
 * - la transition `pending -> paid` n'est possible que via cette RPC serveur.
 */
export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  if ((req.method ?? 'POST').toUpperCase() !== 'POST') {
    return failure('invalid_request')
  }

  const env = readServerEnv()
  if (!isStripeConfigured(env)) return failure('stripe_unavailable')
  if (!isServerDatabaseConfigured(env)) return failure('stripe_unavailable')

  const signature = getHeader(req, 'stripe-signature')
  if (!signature) return failure('invalid_signature')

  const rawBody = await readRawBody(req)

  let event
  try {
    const stripe = createStripeGateway(env.stripeSecretKey as string)
    event = stripe.constructWebhookEvent(rawBody, signature, env.stripeWebhookSecret as string)
  } catch {
    return failure('invalid_signature')
  }

  let supabase
  try {
    supabase = createServerSupabase(env)
  } catch {
    return failure('stripe_unavailable')
  }

  let outcome
  try {
    outcome = await processStripeEvent(
      {
      beginEvent: (eventId, eventType, orderId) => beginStripeEvent(supabase, eventId, eventType, orderId),
      finishEvent: (eventId, status, detail) => finishStripeEvent(supabase, eventId, status, detail),
      findOrder: (orderId) => findOrderForPayment(supabase, orderId),
      markOrderPaid: (input) => markOrderPaid(supabase, input),
      reserveTaggos: (orderId, quantity) => reserveTaggos(supabase, orderId, quantity),
    },
      event,
    )
  } catch {
    // Toute erreur non gérée doit rester retryable côté Stripe.
    return json(500, { received: false, status: 'failed', detail: 'webhook_processing_failed' })
  }

  // Étape 10 — Email transactionnel « commande confirmée ».
  //
  // - déclenché uniquement après confirmation du paiement ET attribution
  //   complète des TAGGO ; un rejeu réparé peut donc compléter un email manqué ;
  // - jamais déclenché par le frontend : le navigateur ne peut pas appeler
  //   cette couche ;
  // - idempotent : la clé `ORDER_CONFIRMED:<orderId>` est réservée par une
  //   insertion atomique, donc un webhook rejoué n'envoie pas un second email ;
  // - non bloquant pour le paiement : un échec d'email ne change jamais la
  //   réponse envoyée à Stripe.
  if (outcome.status === 'processed' && outcome.paid && outcome.orderId && env.appUrl) {
    try {
      const context = await loadOrderEmailContext(
        supabase,
        outcome.orderId,
        buildDashboardUrl(env.appUrl),
      )

      // Pas de contexte exploitable (email absent, montant inconnu…) : aucun
      // email n'est inventé, rien n'est envoyé.
      if (context) {
        await dispatchTransactionalEmail(
          {
            beginEmail: (key, type, orderId, recipient) =>
              beginEmailEvent(supabase, { dedupeKey: key, emailType: type, orderId, recipient }),
            finishEmail: (key, status, detail) =>
              finishEmailEvent(supabase, { dedupeKey: key, status, detail }),
            provider: createEmailProvider(env),
          },
          buildOrderConfirmedJob(context),
        )
      }
    } catch {
      // Le paiement est acquis : l'email ne doit jamais faire échouer le webhook.
    }
  }

  const httpStatus = stripeWebhookHttpStatus(outcome.status)
  if (httpStatus !== 200) {
    return json(httpStatus, { received: true, status: outcome.status, detail: outcome.detail })
  }

  return json(200, { received: true, status: outcome.status })
}