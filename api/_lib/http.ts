import { MAX_RAW_BODY_BYTES } from './limits'
import type { ApiRequest, ApiResponse } from './types'

/**
 * ÉTAPE 9 — Lecture du corps de requête.
 *
 * Le webhook Stripe exige le corps BRUT : le body ne doit jamais être parsé ni
 * modifié avant la vérification de signature. `readRawBody` lit donc le flux tel
 * quel, sans `JSON.parse`.
 */

export function getHeader(req: ApiRequest, name: string): string | null {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function readRawBody(req: ApiRequest): Promise<string> {
  const buffered = req.body

  if (typeof buffered === 'string') return buffered
  if (Buffer.isBuffer(buffered)) return buffered.toString('utf8')

  if (typeof req.read !== 'function') return ''

  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0

    req.setEncoding?.('utf8')
    req.on?.('data', (...args: unknown[]) => {
      const chunk = args[0]
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8')
      size += buffer.length
      if (size > MAX_RAW_BODY_BYTES) {
        reject(new Error('payload_too_large'))
        return
      }
      chunks.push(buffer)
    })
    req.on?.('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on?.('error', (...args: unknown[]) => reject(args[0]))
    req.read?.()
  })
}

export function jsonBody(req: ApiRequest): unknown {
  const raw = req.body
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return raw ?? null
}

export function json(status: number, body: unknown): ApiResponse {
  return {
    status,
    body,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  }
}

/** URL publique de l'application, servant à construire success_url / cancel_url. */
export function resolveAppUrl(req: ApiRequest, configuredAppUrl?: string): string {
  if (configuredAppUrl) return configuredAppUrl.replace(/\/+$/, '')

  const forwardedProto = getHeader(req, 'x-forwarded-proto') ?? 'https'
  const forwardedHost = getHeader(req, 'x-forwarded-host') ?? getHeader(req, 'host')
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`

  return 'http://localhost:5173'
}