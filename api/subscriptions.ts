import type { ApiRequest, ApiResponse } from './_lib/types'
import taggo from './_subscriptions/taggo'
import renew from './_subscriptions/renew'
import autoRenew from './_subscriptions/auto-renew'

function route(req: ApiRequest): string | undefined {
  const url = req.url ?? ''
  const path = url.split('?')[0] ?? ''
  const parts = path.split('/').filter(Boolean)
  const idx = parts.indexOf('subscriptions')
  return idx >= 0 ? parts[idx + 1] : parts[parts.length - 1]
}

export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  switch (route(req)) {
    case 'taggo':
      return taggo(req)
    case 'renew':
      return renew(req)
    case 'auto-renew':
      return autoRenew(req)
    default:
      return { status: 404, body: { ok: false, error: 'not_found' } }
  }
}
