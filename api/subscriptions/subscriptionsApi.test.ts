import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiRequest, ApiResponse } from '../_lib/types'
import { RENEWAL_PRICE_CONFIGURED } from '../_lib/subscriptionServer'

/**
 * ÉTAPE 12 — Tests des endpoints d'abonnement.
 *
 * L'identité vient TOUJOURS du JWT et jamais d'un paramètre. Ces tests le
 * vérifient en inspectant les arguments réellement passés à la couche base.
 */

const resolveAuthenticatedUser = vi.fn()
const getTaggoSubscriptionState = vi.fn()
const requestTaggoRenewal = vi.fn()
const setTaggoAutoRenew = vi.fn()

vi.mock('../_lib/env', () => ({
  readServerEnv: () => ({
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'service-role-test-key',
    appUrl: 'https://taggo.example',
    emailProviderName: undefined,
    emailProviderApiKey: undefined,
  }),
  isServerDatabaseConfigured: () => true,
  isStripeConfigured: () => true,
}))

vi.mock('../_lib/supabaseAdmin', () => ({
  createServerSupabase: () => ({}),
  extractBearerToken: (header?: string | string[]) => {
    const value = Array.isArray(header) ? header[0] : header
    return value && value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : null
  },
  resolveAuthenticatedUser: () => resolveAuthenticatedUser(),
}))

vi.mock('../_lib/subscriptionServer', async () => {
  const actual = await vi.importActual<typeof import('../_lib/subscriptionServer')>('../_lib/subscriptionServer')
  return {
    ...actual,
    getTaggoSubscriptionState: (client: unknown, input: unknown) => getTaggoSubscriptionState(client, input),
    requestTaggoRenewal: (client: unknown, input: unknown) => requestTaggoRenewal(client, input),
    setTaggoAutoRenew: (client: unknown, input: unknown) => setTaggoAutoRenew(client, input),
  }
})

const QR_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_USER_ID = '44444444-4444-4444-8444-444444444444'

function request(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    headers: { authorization: `Bearer ${USER_ID}` },
    query: { qr_id: QR_ID },
    ...overrides,
  } as ApiRequest
}

function bodyOf(response: ApiResponse): Record<string, unknown> {
  return response.body as Record<string, unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  resolveAuthenticatedUser.mockResolvedValue({ id: USER_ID, email: 'client@example.org' })
  getTaggoSubscriptionState.mockResolvedValue({
    ok: true,
    state: {
      managed: true,
      status: 'expired',
      source: 'included',
      autoRenew: false,
      startedAt: '2025-10-01T12:00:00.000Z',
      endsAt: '2026-09-01T12:00:00.000Z',
      expiredAt: '2026-09-01T12:00:00.000Z',
      lifecycleStatus: 'expired',
      expiringSoon: false,
      renewalAvailable: RENEWAL_PRICE_CONFIGURED,
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/subscriptions/taggo', () => {
  it('lit l’état avec le propriétaire déduit du JWT', async () => {
    const { default: handler } = await import('./taggo')

    const response = await handler(request())

    expect(response.status).toBe(200)
    expect(getTaggoSubscriptionState).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ qrId: QR_ID, ownerId: USER_ID }),
    )
  })

  it('n’accepte jamais un owner_id fourni par l’URL', async () => {
    const { default: handler } = await import('./taggo')

    await handler(request({ query: { qr_id: QR_ID, owner_id: OTHER_USER_ID } }))

    const input = getTaggoSubscriptionState.mock.calls[0][1] as { ownerId: string }
    expect(input.ownerId).toBe(USER_ID)
    expect(input.ownerId).not.toBe(OTHER_USER_ID)
  })

  it('refuse une requête sans JWT', async () => {
    const { default: handler } = await import('./taggo')
    resolveAuthenticatedUser.mockResolvedValue(null)

    const response = await handler(request({ headers: {} }))

    expect(response.status).toBe(401)
    expect(bodyOf(response).code).toBe('unauthenticated')
    expect(getTaggoSubscriptionState).not.toHaveBeenCalled()
  })

  it('refuse un TAGGO appartenant à quelqu’un d’autre', async () => {
    const { default: handler } = await import('./taggo')
    getTaggoSubscriptionState.mockResolvedValue({ ok: false, reason: 'not_owner' })

    const response = await handler(request())

    expect(response.status).toBe(403)
    expect(bodyOf(response).code).toBe('not_owner')
  })

  it('refuse une méthode autre que GET', async () => {
    const { default: handler } = await import('./taggo')

    const response = await handler(request({ method: 'POST' }))

    expect(response.status).toBe(405)
  })

  it('n’expose ni identifiant Stripe ni montant', async () => {
    const { default: handler } = await import('./taggo')

    const response = await handler(request())
    const serialized = JSON.stringify(response.body)

    expect(serialized).not.toMatch(/stripe_/)
    expect(serialized).not.toMatch(/€|amount|price|cents/i)
  })

  it('ne renvoie jamais un abonnement actif en cas de panne', async () => {
    const { default: handler } = await import('./taggo')
    getTaggoSubscriptionState.mockResolvedValue({ ok: false, reason: 'subscription_unavailable' })

    const response = await handler(request())

    expect(response.status).toBe(503)
    expect(bodyOf(response).ok).toBe(false)
  })
})

describe('POST /api/subscriptions/renew', () => {
  it('refuse tant qu’aucun tarif n’est configuré', async () => {
    const { default: handler } = await import('./renew')
    requestTaggoRenewal.mockResolvedValue({ ok: false, reason: 'renewal_unavailable' })

    const response = await handler(request({ method: 'POST' }))

    expect(response.status).toBe(503)
    expect(bodyOf(response).code).toBe('renewal_unavailable')
  })

  it('ne déclare jamais un paiement réussi', async () => {
    const { default: handler } = await import('./renew')
    requestTaggoRenewal.mockResolvedValue({ ok: false, reason: 'renewal_unavailable' })

    const response = await handler(request({ method: 'POST' }))
    const body = bodyOf(response)

    // Jamais `ok: true`, jamais un statut de commande, jamais de Stripe.
    expect(body.ok).toBe(false)
    expect(body).not.toMatchObject({ paid: true })
    expect(body).not.toMatchObject({ status: 'paid' })
    expect(JSON.stringify(body)).not.toMatch(/stripe|payment_intent|checkout/i)
  })

  it('refuse une requête sans JWT', async () => {
    const { default: handler } = await import('./renew')
    resolveAuthenticatedUser.mockResolvedValue(null)

    const response = await handler(request({ method: 'POST', headers: {} }))

    expect(response.status).toBe(401)
    expect(requestTaggoRenewal).not.toHaveBeenCalled()
  })

  it('refuse une méthode autre que POST', async () => {
    const { default: handler } = await import('./renew')

    const response = await handler(request({ method: 'GET' }))

    expect(response.status).toBe(405)
    expect(requestTaggoRenewal).not.toHaveBeenCalled()
  })
})

describe('POST /api/subscriptions/auto-renew', () => {
  it('enregistre la préférence avec le propriétaire du JWT', async () => {
    const { default: handler } = await import('./auto-renew')
    setTaggoAutoRenew.mockResolvedValue({ ok: true })

    const response = await handler(
      request({ method: 'POST', query: { qr_id: QR_ID, enabled: 'true' } }),
    )

    expect(response.status).toBe(200)
    expect(setTaggoAutoRenew).toHaveBeenCalledWith(
      expect.anything(),
      { qrId: QR_ID, ownerId: USER_ID, autoRenew: true },
    )
  })

  it('accepte la désactivation', async () => {
    const { default: handler } = await import('./auto-renew')
    setTaggoAutoRenew.mockResolvedValue({ ok: true })

    await handler(request({ method: 'POST', query: { qr_id: QR_ID, enabled: 'false' } }))

    expect(setTaggoAutoRenew.mock.calls[0][1]).toMatchObject({ autoRenew: false })
  })

  it('refuse une valeur qui n’est pas true/false', async () => {
    const { default: handler } = await import('./auto-renew')

    for (const enabled of ['oui', '1', 'yes', '']) {
      const response = await handler(
        request({ method: 'POST', query: { qr_id: QR_ID, enabled } }),
      )
      expect(response.status, `enabled=${enabled}`).toBe(400)
    }
    expect(setTaggoAutoRenew).not.toHaveBeenCalled()
  })

  it('n’accepte pas d’activer le renouvellement pour le TAGGO de quelqu’un d’autre', async () => {
    const { default: handler } = await import('./auto-renew')
    setTaggoAutoRenew.mockResolvedValue({ ok: false, reason: 'not_owner' })

    const response = await handler(
      request({ method: 'POST', query: { qr_id: QR_ID, enabled: 'true' } }),
    )

    expect(response.status).toBe(403)
  })
})