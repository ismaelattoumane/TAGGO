import { isServerDatabaseConfigured, isStripeConfigured, readServerEnv } from '../_lib/env'
import { getHeader, json, readRawBody } from '../_lib/http'
import { failure } from '../_lib/errors'
import { createServerSupabase } from '../_lib/supabaseAdmin'
import { createStripeGateway } from '../_lib/stripeGateway'
import { beginStripeEvent, finishStripeEvent, findOrderForPayment, markOrderPaid, reserveTaggos } from '../_lib/orderServer'
import { processStripeEvent } from '../_lib/webhook'
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

  const outcome = await processStripeEvent(
    {
      beginEvent: (eventId, eventType, orderId) => beginStripeEvent(supabase, eventId, eventType, orderId),
      finishEvent: (eventId, status, detail) => finishStripeEvent(supabase, eventId, status, detail),
      findOrder: (orderId) => findOrderForPayment(supabase, orderId),
      markOrderPaid: (input) => markOrderPaid(supabase, input),
      reserveTaggos: (orderId, quantity) => reserveTaggos(supabase, orderId, quantity),
    },
    event,
  )

  // Étape 10 — Email transactionnel « commande confirmée ».
  //
  // - déclenché UNIQUEMENT quand cet événement vient de faire passer la
  //   commande à `paid` côté serveur ;
  // - jamais déclenché par le frontend : le navigateur ne peut pas appeler
  //   cette couche ;
  // - idempotent : la clé `ORDER_CONFIRMED:<orderId>` est réservée par une
  //   insertion atomique, donc un webhook rejoué n'envoie pas un second email ;
  // - non bloquant pour le paiement : un échec d'email ne change jamais la
  //   réponse envoyée à Stripe.
  if (outcome.paid && outcome.orderId && env.appUrl) {
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

  // Un événement rejeté (montant, devise, commande) reste un 400 pour Stripe :
  // il est visible dans le dashboard et ne sera pas rejoué silencieusement.
  if (outcome.status === 'rejected') {
    return json(400, { received: true, status: outcome.status, detail: outcome.detail })
  }

  return json(200, { received: true, status: outcome.status })
}