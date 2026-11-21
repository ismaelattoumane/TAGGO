import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from '../../../api/cron/reconcile-paid-orders'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('reconcile-paid-orders cron', () => {
  it('refuse un appel sans secret de cron configuré', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const response = await handler({ method: 'GET', headers: {} })

    expect(response.status).toBe(503)
    expect(response.body).toEqual({ ok: false, error: 'cron_not_configured' })
  })

  it('refuse une autorisation incorrecte avant tout accès à Supabase', async () => {
    vi.stubEnv('CRON_SECRET', 'expected-secret')
    const response = await handler({
      method: 'GET',
      headers: { authorization: 'Bearer wrong-secret' },
    })

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ ok: false, error: 'unauthorized' })
  })

  it('refuse les méthodes autres que GET', async () => {
    const response = await handler({ method: 'POST', headers: {} })

    expect(response.status).toBe(405)
    expect(response.body).toEqual({ ok: false, error: 'method_not_allowed' })
  })
})
