import { isValidEmail } from '../../src/lib/validators'
import { buildEmailDedupeKey } from '../../src/emails'
import type { EmailProvider, EmailType, RenderedEmail } from '../../src/emails/emailTypes'

/**
 * ÉTAPE 10 — Envoi transactionnel idempotent (serveur uniquement).
 *
 * RÈGLE CENTRALE : un même événement métier ne produit qu'un seul email.
 *
 * Un webhook Stripe rejoué, un événement d'expédition rejoué ou une double
 * exécution d'un job ne doivent jamais envoyer deux fois le même message.
 * L'idempotence repose sur une insertion atomique (`beginEmail`) portée par une
 * contrainte UNIQUE côté SQL : le premier appel gagne, tous les suivants sont
 * ignorés AVANT tout appel réseau.
 */

export type EmailDeliveryStatus = 'processing' | 'sent' | 'skipped' | 'failed'

export type EmailDispatchOutcome = {
  status: 'sent' | 'duplicate' | 'invalid_recipient' | 'render_failed' | 'send_failed' | 'skipped'
  type: EmailType
  dedupeKey: string
  detail?: string
}

export type EmailDispatchDeps = {
  /** Insertion atomique ; `false` si cet email a déjà été traité. */
  beginEmail(key: string, type: EmailType, orderId: string | null, recipient: string): Promise<boolean>
  finishEmail(key: string, status: EmailDeliveryStatus, detail?: string | null): Promise<void>
  provider: EmailProvider
}

export type EmailJob = {
  type: EmailType
  /** Référence métier : identifiant de commande, de compte, de session panier… */
  reference: string
  orderId?: string | null
  to: string
  /** Rend le contenu. Peut lever une erreur si une donnée obligatoire manque. */
  render: () => RenderedEmail
}

/** Clé d'idempotence déterministe : type + référence métier. */
export function emailDedupeKey(job: Pick<EmailJob, 'type' | 'reference'>): string {
  return buildEmailDedupeKey(job.type, job.reference)
}

async function safeFinish(
  deps: EmailDispatchDeps,
  key: string,
  status: EmailDeliveryStatus,
  detail: string,
): Promise<void> {
  try {
    await deps.finishEmail(key, status, detail)
  } catch {
    // La journalisation ne doit jamais faire échouer l'envoi.
  }
}

export async function dispatchTransactionalEmail(
  deps: EmailDispatchDeps,
  job: EmailJob,
): Promise<EmailDispatchOutcome> {
  const dedupeKey = emailDedupeKey(job)

  if (!isValidEmail(job.to)) {
    return { status: 'invalid_recipient', type: job.type, dedupeKey, detail: 'invalid_email' }
  }

  // Idempotence : la réservation de la clé se fait AVANT tout envoi.
  const firstTime = await deps.beginEmail(dedupeKey, job.type, job.orderId ?? null, job.to)
  if (!firstTime) {
    return { status: 'duplicate', type: job.type, dedupeKey, detail: 'already_sent' }
  }

  let rendered: RenderedEmail
  try {
    rendered = job.render()
  } catch {
    await safeFinish(deps, dedupeKey, 'failed', 'render_failed')
    return { status: 'render_failed', type: job.type, dedupeKey, detail: 'render_failed' }
  }

  try {
    const result = await deps.provider.send({
      to: job.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: dedupeKey,
    })

    await safeFinish(deps, dedupeKey, result.delivered ? 'sent' : 'skipped', result.provider)

    return result.delivered
      ? { status: 'sent', type: job.type, dedupeKey }
      : { status: 'skipped', type: job.type, dedupeKey, detail: result.provider }
  } catch {
    await safeFinish(deps, dedupeKey, 'failed', 'send_failed')
    return { status: 'send_failed', type: job.type, dedupeKey, detail: 'send_failed' }
  }
}