import { describe, expect, it, vi } from 'vitest'
import { attachStripeSession, finishStripeEvent } from './orderServer'

function makeClient(order: any, updateResult: any) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: order, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              select: vi.fn(async () => updateResult),
            })),
          })),
        })),
      })),
    })),
  } as any
}

describe('attachStripeSession', () => {
  it('cas nominal', async () => {
    const client = makeClient(
      { id: 'o1', user_id: 'u1', status: 'pending', stripe_checkout_session_id: null },
      { data: [{ id: 'o1' }], error: null },
    )
    await expect(attachStripeSession(client, 'o1', 'sess', 'u1')).resolves.toBeUndefined()
  })

  it('utilisateur incorrect', async () => {
    const client = makeClient(
      { id: 'o1', user_id: 'u2', status: 'pending', stripe_checkout_session_id: null },
      { data: [{ id: 'o1' }], error: null },
    )
    await expect(attachStripeSession(client, 'o1', 'sess', 'u1')).rejects.toThrow('order_not_owned')
  })

  it('statut incorrect', async () => {
    const client = makeClient(
      { id: 'o1', user_id: 'u1', status: 'paid', stripe_checkout_session_id: null },
      { data: [{ id: 'o1' }], error: null },
    )
    await expect(attachStripeSession(client, 'o1', 'sess', 'u1')).rejects.toThrow('order_not_pending')
  })

  it('session déjà attachée', async () => {
    const client = makeClient(
      { id: 'o1', user_id: 'u1', status: 'pending', stripe_checkout_session_id: 'sess0' },
      { data: [{ id: 'o1' }], error: null },
    )
    await expect(attachStripeSession(client, 'o1', 'sess', 'u1')).rejects.toThrow('stripe_session_already_attached')
  })

  it('mise à jour sans ligne', async () => {
    const client = makeClient(
      { id: 'o1', user_id: 'u1', status: 'pending', stripe_checkout_session_id: null },
      { data: [], error: null },
    )
    await expect(attachStripeSession(client, 'o1', 'sess', 'u1')).rejects.toThrow('order_session_link_failed')
  })
})


describe('finishStripeEvent', () => {
  it('propage une erreur RPC au lieu de confirmer silencieusement la persistance', async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: null, error: { message: 'database unavailable' } })),
    } as any

    await expect(finishStripeEvent(client, 'evt_test', 'failed', 'unexpected_error'))
      .rejects.toThrow('stripe_event_finish_failed')
    expect(client.rpc).toHaveBeenCalledWith('finish_stripe_event', {
      p_stripe_event_id: 'evt_test',
      p_status: 'failed',
      p_detail: 'unexpected_error',
    })
  })

  it('accepte une confirmation de journalisation réussie', async () => {
    const client = {
      rpc: vi.fn(async () => ({ data: null, error: null })),
    } as any

    await expect(finishStripeEvent(client, 'evt_test', 'processed', null)).resolves.toBeUndefined()
  })
})
