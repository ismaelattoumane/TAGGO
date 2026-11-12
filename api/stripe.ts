import type { ApiRequest, ApiResponse } from './_lib/types'
import config from './_stripe/config'
import createCheckoutSession from './_stripe/create-checkout-session'
import webhook from './_stripe/webhook'

function route(req: ApiRequest): string | undefined {
  const url = req.url ?? ''
  const path = url.split('?')[0] ?? ''
  const parts = path.split('/').filter(Boolean)
  // /api/stripe/<action>
  const idx = parts.indexOf('stripe')
  return idx >= 0 ? parts[idx + 1] : parts[parts.length - 1]
}

export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  switch (route(req)) {
    case 'config':
      return config(req)
    case 'create-checkout-session':
      return createCheckoutSession(req)
    case 'webhook':
      return webhook(req)
    default:
      return { status: 404, body: { ok: false, error: 'not_found' } }
  }
}
