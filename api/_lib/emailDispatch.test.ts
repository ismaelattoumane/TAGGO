import { describe, expect, it, vi } from 'vitest'
import { dispatchTransactionalEmail, emailDedupeKey, type EmailDispatchDeps } from './emailDispatch'
import { buildOrderConfirmedJob, buildOrderShippedJob, buildPasswordResetJob } from './emailTriggers'
import { createMemoryEmailProvider, DisabledEmailProvider } from '../../src/emails/provider'
import type { OrderLineDraft } from '../../src/emails/templates/lineItems'
import type { EmailType } from '../../src/emails/emailTypes'

/**
 * ÉTAPE 10 — Idempotence des emails transactionnels.
 *
 * Exigence centrale : un webhook Stripe rejoué, ou un job relancé, ne doit
 * JAMAIS produire un second email. Ces tests simulent le rejeu.
 */

const LINES: OrderLineDraft[] = [
  { name: 'T-shirt TAGGO', variant: null, quantity: 1, lineTotalFormatted: '42,00 €' },
]

const ORDER_CONTEXT = {
  orderId: '3f1a2b4c-0000-4000-8000-000000000000',
  reference: 'TAGGO-2026-0001',
  email: 'alex@example.com',
  firstName: 'Alex',
  lines: LINES,
  totalFormatted: '42,00 €',
  dashboardUrl: 'https://taggo.example/dashboard',
}

/** Faux serveur de déduplication : une clé ne peut être réservée qu'une fois. */
function createDedupeServer() {
  const reserved = new Set<string>()
  const finished: { key: string; status: string; detail: string | null }[] = []

  const provider = createMemoryEmailProvider()

  const deps: EmailDispatchDeps = {
    beginEmail: vi.fn(async (key: string) => {
      if (reserved.has(key)) return false
      reserved.add(key)
      return true
    }),
    finishEmail: vi.fn(async (key: string, status, detail = null) => {
      finished.push({ key, status, detail })
    }),
    provider,
  }

  return { deps, provider, reserved, finished }
}

describe('déduplication des emails', () => {
  it('envoie un premier email et ignore tout rejeu du même événement', async () => {
    const { deps, provider } = createDedupeServer()
    const job = buildOrderConfirmedJob(ORDER_CONTEXT)

    const first = await dispatchTransactionalEmail(deps, job)
    const replay = await dispatchTransactionalEmail(deps, job)

    expect(first.status).toBe('sent')
    expect(replay.status).toBe('duplicate')
    expect(provider.sent).toHaveLength(1)
    expect(deps.beginEmail).toHaveBeenCalledTimes(2)
  })

  it('envoie au plus un email même sous rejeu concurrent', async () => {
    const { deps, provider } = createDedupeServer()
    const job = buildOrderConfirmedJob(ORDER_CONTEXT)

    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => dispatchTransactionalEmail(deps, job)),
    )

    expect(outcomes.filter((outcome) => outcome.status === 'sent')).toHaveLength(1)
    expect(outcomes.filter((outcome) => outcome.status === 'duplicate')).toHaveLength(4)
    expect(provider.sent).toHaveLength(1)
  })

  it('n’envoie pas deux fois l’email d’expédition d’une même commande', async () => {
    const { deps, provider } = createDedupeServer()
    const job = buildOrderShippedJob({
      ...ORDER_CONTEXT,
      carrierName: 'Transporteur TAGGO',
      trackingNumber: 'TRK-1',
      trackingUrl: null,
      estimatedDelay: null,
    })

    await dispatchTransactionalEmail(deps, job)
    await dispatchTransactionalEmail(deps, job)

    expect(provider.sent).toHaveLength(1)
  })

  it('distingue deux commandes différentes', async () => {
    const { deps, provider } = createDedupeServer()

    await dispatchTransactionalEmail(deps, buildOrderConfirmedJob(ORDER_CONTEXT))
    await dispatchTransactionalEmail(
      deps,
      buildOrderConfirmedJob({ ...ORDER_CONTEXT, orderId: 'autre-commande' }),
    )

    expect(provider.sent).toHaveLength(2)
  })

  it('distingue deux types d’email pour une même commande', async () => {
    const { deps, provider } = createDedupeServer()

    await dispatchTransactionalEmail(deps, buildOrderConfirmedJob(ORDER_CONTEXT))
    await dispatchTransactionalEmail(deps, buildOrderShippedJob({
      ...ORDER_CONTEXT,
      carrierName: null,
      trackingNumber: null,
      trackingUrl: null,
      estimatedDelay: null,
    }))

    expect(provider.sent).toHaveLength(2)
  })

  it('construit une clé d’idempotence déterministe par type et référence', () => {
    expect(emailDedupeKey({ type: 'ORDER_CONFIRMED', reference: 'ABC-1' })).toBe(
      'ORDER_CONFIRMED:abc-1',
    )
    expect(emailDedupeKey({ type: 'ORDER_CONFIRMED', reference: 'ABC-1' })).toBe(
      emailDedupeKey({ type: 'ORDER_CONFIRMED', reference: 'abc-1' }),
    )
  })

  it('refuse un destinataire invalide sans rien envoyer', async () => {
    const { deps, provider, finished } = createDedupeServer()

    const outcome = await dispatchTransactionalEmail(deps, {
      ...buildOrderConfirmedJob(ORDER_CONTEXT),
      to: 'pas-un-email',
    })

    expect(outcome.status).toBe('invalid_recipient')
    expect(provider.sent).toHaveLength(0)
    expect(deps.beginEmail).not.toHaveBeenCalled()
    expect(finished).toHaveLength(0)
  })

  it('journalise un échec de rendu sans jamais émettre l’email', async () => {
    const { deps, provider, finished } = createDedupeServer()

    const outcome = await dispatchTransactionalEmail(deps, {
      type: 'ORDER_SHIPPED',
      reference: 'commande-1',
      to: 'alex@example.com',
      render: () => {
        throw new Error('transporteur manquant')
      },
    })

    expect(outcome.status).toBe('render_failed')
    expect(provider.sent).toHaveLength(0)
    expect(finished[0]).toMatchObject({ status: 'failed', detail: 'render_failed' })
  })

  it('journalise un échec du provider sans faire échouer l’appelant', async () => {
    const reserved = new Set<string>()
    const deps: EmailDispatchDeps = {
      beginEmail: async (key: string) => {
        if (reserved.has(key)) return false
        reserved.add(key)
        return true
      },
      finishEmail: async () => undefined,
      provider: {
        name: 'failing',
        send: async () => {
          throw new Error('provider indisponible')
        },
      },
    }

    const outcome = await dispatchTransactionalEmail(deps, buildOrderConfirmedJob(ORDER_CONTEXT))
    expect(outcome.status).toBe('send_failed')
  })

  it('signale un provider désactivé sans prétendre avoir envoyé', async () => {
    const { deps } = createDedupeServer()
    const outcome = await dispatchTransactionalEmail(
      { ...deps, provider: new DisabledEmailProvider() },
      buildOrderConfirmedJob(ORDER_CONTEXT),
    )

    expect(outcome.status).toBe('skipped')
    expect(outcome.detail).toBe('disabled')
  })

  it('transmet la clé d’idempotence au provider', async () => {
    const { deps, provider } = createDedupeServer()
    await dispatchTransactionalEmail(deps, buildOrderConfirmedJob(ORDER_CONTEXT))

    expect(provider.sent[0].idempotencyKey).toBe(
      'ORDER_CONFIRMED:3f1a2b4c-0000-4000-8000-000000000000',
    )
    expect(provider.sent[0].subject).toContain('confirmée')
  })
})

describe('builders d’email', () => {
  it('ne produit jamais de lien de réinitialisation non sécurisé', async () => {
    const { deps, provider } = createDedupeServer()
    const job = buildPasswordResetJob({
      email: 'alex@example.com',
      firstName: 'Alex',
      resetUrl: 'javascript:alert(1)',
      expiresIn: null,
    })

    const outcome = await dispatchTransactionalEmail(deps, job)
    expect(outcome.status).toBe('sent')
    expect(provider.sent[0].html).not.toContain('javascript:')
  })

  it('type correctement chaque type d’email', () => {
    const jobs: EmailType[] = [
      buildOrderConfirmedJob(ORDER_CONTEXT).type,
      buildOrderShippedJob({
        ...ORDER_CONTEXT,
        carrierName: null,
        trackingNumber: null,
        trackingUrl: null,
        estimatedDelay: null,
      }).type,
      buildPasswordResetJob({
        email: 'a@b.co',
        firstName: 'A',
        resetUrl: 'https://taggo.example/reset-password',
        expiresIn: null,
      }).type,
    ]

    expect(jobs).toEqual(['ORDER_CONFIRMED', 'ORDER_SHIPPED', 'PASSWORD_RESET'])
  })
})