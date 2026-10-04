import { describe, expect, it, vi } from 'vitest'
import { HANDLED_EVENT_TYPES, processStripeEvent, type OrderForPayment, type WebhookDeps } from './webhook'
import type { StripeEvent } from './types'

const ORDER_ID = '44444444-4444-4444-8444-444444444444'
const SESSION_ID = 'cs_test_123'

function order(overrides: Partial<OrderForPayment> = {}): OrderForPayment {
  return {
    id: ORDER_ID,
    status: 'pending',
    subtotalCents: 5000,
    currency: 'EUR',
    stripeCheckoutSessionId: SESSION_ID,
    taggoQuantity: 2,
    ...overrides,
  }
}

function sessionEvent(overrides: Record<string, unknown> = {}, eventId = 'evt_1'): StripeEvent {
  return {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: SESSION_ID,
        amount_total: 5000,
        currency: 'eur',
        payment_status: 'paid',
        payment_intent: 'pi_test_1',
        metadata: { order_id: ORDER_ID },
        ...overrides,
      },
    },
  }
}

function deps(overrides: Partial<WebhookDeps> = {}) {
  return {
    beginEvent: vi.fn(async () => true),
    finishEvent: vi.fn(async () => undefined),
    findOrder: vi.fn(async () => order()),
    markOrderPaid: vi.fn(async () => undefined),
    reserveTaggos: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('processStripeEvent', () => {
  it('traite un paiement confirmé : paid + réservation des TAGGO', async () => {
    const context = deps()
    const outcome = await processStripeEvent(context, sessionEvent())

    expect(outcome).toEqual({ status: 'processed', orderId: ORDER_ID, paid: true })
    expect(context.markOrderPaid).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      stripeSessionId: SESSION_ID,
      stripePaymentIntentId: 'pi_test_1',
      amountTotal: 5000,
      currency: 'EUR',
    })
    expect(context.reserveTaggos).toHaveBeenCalledWith(ORDER_ID, 2)
    expect(context.finishEvent).toHaveBeenCalledWith('evt_1', 'processed', null)
  })

  it('ignore un événement d’un autre type', async () => {
    const context = deps()
    const outcome = await processStripeEvent(context, {
      ...sessionEvent({}, 'evt_2'),
      type: 'checkout.session.expired',
    })

    expect(outcome).toEqual({ status: 'ignored', paid: false, detail: 'unhandled_event_type' })
    expect(context.beginEvent).not.toHaveBeenCalled()
    expect(context.markOrderPaid).not.toHaveBeenCalled()
  })

  it('ne traite que les deux événements de paiement attendus', () => {
    expect([...HANDLED_EVENT_TYPES]).toEqual([
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
    ])
  })

  it('traite aussi un paiement asynchrone confirmé', async () => {
    const context = deps()
    const outcome = await processStripeEvent(context, {
      ...sessionEvent({}, 'evt_3'),
      type: 'checkout.session.async_payment_succeeded',
    })

    expect(outcome.paid).toBe(true)
  })

  it('ne fait rien sur rejeu du même event_id', async () => {
    const context = deps({ beginEvent: vi.fn(async () => false) })
    const outcome = await processStripeEvent(context, sessionEvent())

    expect(outcome).toEqual({
      status: 'ignored',
      paid: false,
      orderId: ORDER_ID,
      detail: 'duplicate_event',
    })
    expect(context.markOrderPaid).not.toHaveBeenCalled()
    expect(context.reserveTaggos).not.toHaveBeenCalled()
  })

  it('refuse un événement sans référence de commande', async () => {
    const context = deps()
    const outcome = await processStripeEvent(context, sessionEvent({ metadata: {} }, 'evt_4'))

    expect(outcome).toEqual({ status: 'rejected', paid: false, detail: 'missing_order_reference' })
    expect(context.markOrderPaid).not.toHaveBeenCalled()
  })

  it('refuse une référence de commande qui n’est pas un UUID', async () => {
    const context = deps()
    const outcome = await processStripeEvent(
      context,
      sessionEvent({ metadata: { order_id: 'order-42' } }, 'evt_5'),
    )

    expect(outcome.status).toBe('rejected')
    expect(context.markOrderPaid).not.toHaveBeenCalled()
  })

  it('ignore une session non payée', async () => {
    const context = deps()
    const outcome = await processStripeEvent(context, sessionEvent({ payment_status: 'unpaid' }, 'evt_6'))

    expect(outcome).toEqual({ status: 'ignored', orderId: ORDER_ID, paid: false, detail: 'payment_not_completed' })
    expect(context.markOrderPaid).not.toHaveBeenCalled()
  })

  it('refuse une commande inexistante', async () => {
    const context = deps({ findOrder: vi.fn(async () => null) })
    const outcome = await processStripeEvent(context, sessionEvent({}, 'evt_7'))

    expect(outcome).toEqual({ status: 'rejected', orderId: ORDER_ID, paid: false, detail: 'order_not_found' })
  })

  it('ne refait rien sur une commande déjà payée', async () => {
    const context = deps({ findOrder: vi.fn(async () => order({ status: 'paid' })) })
    const outcome = await processStripeEvent(context, sessionEvent({}, 'evt_8'))

    expect(outcome).toEqual({ status: 'ignored', orderId: ORDER_ID, paid: false, detail: 'already_paid' })
    expect(context.reserveTaggos).not.toHaveBeenCalled()
  })

  it('refuse un montant différent de celui de la commande', async () => {
    const context = deps()
    const outcome = await processStripeEvent(context, sessionEvent({ amount_total: 1 }, 'evt_9'))

    expect(outcome).toEqual({ status: 'rejected', orderId: ORDER_ID, paid: false, detail: 'amount_mismatch' })
    expect(context.markOrderPaid).not.toHaveBeenCalled()
    expect(context.reserveTaggos).not.toHaveBeenCalled()
  })

  it('refuse un montant absent', async () => {
    const context = deps()
    const outcome = await processStripeEvent(context, sessionEvent({ amount_total: null }, 'evt_10'))

    expect(outcome).toEqual({ status: 'rejected', orderId: ORDER_ID, paid: false, detail: 'missing_amount' })
  })

  it('refuse une devise différente de celle de la commande', async () => {
    const context = deps()
    const outcome = await processStripeEvent(context, sessionEvent({ currency: 'usd' }, 'evt_11'))

    expect(outcome).toEqual({ status: 'rejected', orderId: ORDER_ID, paid: false, detail: 'currency_mismatch' })
    expect(context.markOrderPaid).not.toHaveBeenCalled()
  })

  it('refuse une session Stripe qui ne correspond pas à la commande', async () => {
    const context = deps({
      findOrder: vi.fn(async () => order({ stripeCheckoutSessionId: 'cs_test_autre' })),
    })
    const outcome = await processStripeEvent(context, sessionEvent({}, 'evt_12'))

    expect(outcome).toEqual({ status: 'rejected', orderId: ORDER_ID, paid: false, detail: 'session_mismatch' })
    expect(context.markOrderPaid).not.toHaveBeenCalled()
  })

  it('accepte une commande sans session encore rattachée', async () => {
    const context = deps({ findOrder: vi.fn(async () => order({ stripeCheckoutSessionId: null })) })
    const outcome = await processStripeEvent(context, sessionEvent({}, 'evt_13'))

    expect(outcome.paid).toBe(true)
  })

  it('conserve le paiement acquis si la réservation échoue', async () => {
    const context = deps({
      reserveTaggos: vi.fn(async () => {
        throw new Error('no_taggo_left')
      }),
    })
    const outcome = await processStripeEvent(context, sessionEvent({}, 'evt_14'))

    expect(outcome).toEqual({
      status: 'processed',
      orderId: ORDER_ID,
      paid: true,
      detail: 'paid_taggo_pending',
    })
    expect(context.finishEvent).toHaveBeenCalledWith('evt_14', 'processed', 'paid_taggo_pending')
  })

  it('journalise un échec inattendu sans masquer l’événement', async () => {
    const context = deps({
      markOrderPaid: vi.fn(async () => {
        throw new Error('db_down')
      }),
    })
    const outcome = await processStripeEvent(context, sessionEvent({}, 'evt_15'))

    expect(outcome).toEqual({
      status: 'failed',
      orderId: ORDER_ID,
      paid: false,
      detail: 'unexpected_error',
    })
    expect(context.finishEvent).toHaveBeenCalledWith('evt_15', 'failed', 'unexpected_error')
  })
})
