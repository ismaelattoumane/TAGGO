import { describe, expect, it } from 'vitest'
import { getHeader, json, jsonBody, readRawBody, resolveAppUrl } from './http'
import { MAX_RAW_BODY_BYTES } from './limits'
import type { ApiRequest } from './types'

function request(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return { method: 'POST', headers: {}, ...overrides }
}

function streamRequest(chunks: string[]): ApiRequest {
  const listeners = new Map<string, (...args: unknown[]) => void>()
  return {
    method: 'POST',
    headers: {},
    on(event, listener) {
      listeners.set(event, listener)
      if (event === 'end') {
        queueMicrotask(() => {
          for (const chunk of chunks) listeners.get('data')?.(chunk)
          listeners.get('end')?.()
        })
      }
    },
    read: () => undefined,
  }
}

describe('getHeader', () => {
  it('lit un en-tête par son nom', () => {
    expect(getHeader(request({ headers: { 'stripe-signature': 't=1,v1=abc' } }), 'stripe-signature')).toBe(
      't=1,v1=abc',
    )
  })

  it('tolère une liste d’en-têtes', () => {
    expect(getHeader(request({ headers: { 'stripe-signature': ['a', 'b'] } }), 'stripe-signature')).toBe('a')
  })

  it('renvoie null si l’en-tête est absent', () => {
    expect(getHeader(request(), 'stripe-signature')).toBeNull()
  })
})

describe('readRawBody', () => {
  it('renvoie un corps string tel quel', async () => {
    await expect(readRawBody(request({ body: '{"id":"evt_1"}' }))).resolves.toBe('{"id":"evt_1"}')
  })

  it('convertit un corps Buffer', async () => {
    await expect(
      readRawBody(request({ body: Buffer.from('{"id":"evt_1"}', 'utf8') })),
    ).resolves.toBe('{"id":"evt_1"}')
  })

  it('agrège un corps en flux sans le modifier', async () => {
    await expect(readRawBody(streamRequest(['{"id":', '"evt_1"}']))).resolves.toBe('{"id":"evt_1"}')
  })

  it('refuse un corps trop volumineux', async () => {
    const huge = 'x'.repeat(MAX_RAW_BODY_BYTES + 1024)
    await expect(readRawBody(streamRequest([huge]))).rejects.toThrow('payload_too_large')
  })

  it('renvoie une chaîne vide si le corps est absent', async () => {
    await expect(readRawBody(request())).resolves.toBe('')
  })
})

describe('jsonBody', () => {
  it('parse un corps JSON string', () => {
    expect(jsonBody(request({ body: '{"items":[]}' }))).toEqual({ items: [] })
  })

  it('renvoie null pour un JSON invalide', () => {
    expect(jsonBody(request({ body: 'pas du json' }))).toBeNull()
  })

  it('laisse passer un corps déjà parsé', () => {
    expect(jsonBody(request({ body: { items: [] } }))).toEqual({ items: [] })
  })
})

describe('json', () => {
  it('interdit la mise en cache des réponses de paiement', () => {
    expect(json(200, { ok: true })).toEqual({
      status: 200,
      body: { ok: true },
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
  })
})

describe('resolveAppUrl', () => {
  it('privilégie APP_URL', () => {
    expect(resolveAppUrl(request(), 'https://taggo.test/')).toBe('https://taggo.test')
  })

  it('reconstruit l’URL depuis les en-têtes de transfert', () => {
    const req = request({ headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'taggo.vercel.app' } })
    expect(resolveAppUrl(req)).toBe('https://taggo.vercel.app')
  })

  it('retombe sur localhost en développement', () => {
    expect(resolveAppUrl(request())).toBe('http://localhost:5173')
  })
})
