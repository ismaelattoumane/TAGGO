import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { loadOrderEmailContext } from './orderEmailContext'

function makeClient(confirmedRecipient: string | null) {
  const order = {
    id: 'order-1',
    customer_id: 'user-1',
    subtotal_cents: 2500,
    currency: 'EUR',
    order_items: [],
  }
  const profile = {
    first_name: 'Alex',
    display_name: 'Alex TAGGO',
    full_name: 'Alex Example',
  }
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({
          data: table === 'orders' ? order : profile,
          error: null,
        })),
      })),
    })),
  }))
  const rpc = vi.fn(async () => ({ data: confirmedRecipient, error: null }))
  return {
    client: { from, rpc } as unknown as SupabaseClient,
    from,
    rpc,
  }
}

describe('loadOrderEmailContext', () => {
  it('does not build an email context when Auth has no confirmed address', async () => {
    const { client, from, rpc } = makeClient(null)

    await expect(loadOrderEmailContext(client, 'order-1', 'https://taggo.example')).resolves.toBeNull()
    expect(rpc).toHaveBeenCalledWith('get_confirmed_order_recipient', { p_order_id: 'order-1' })
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('uses the confirmed Auth recipient and profile fields only for the name', async () => {
    const { client, from } = makeClient('confirmed@example.com')

    await expect(loadOrderEmailContext(client, 'order-1', 'https://taggo.example')).resolves.toMatchObject({
      email: 'confirmed@example.com',
      firstName: 'Alex',
      totalFormatted: '25,00 €',
    })
    expect(from).toHaveBeenCalledTimes(2)
  })
})
