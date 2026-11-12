import type { ApiRequest, ApiResponse } from './_lib/types'
import scan from './_analytics/scan'
import taggo from './_analytics/taggo'

function route(req: ApiRequest): string | undefined {
  const url = req.url ?? ''
  const path = url.split('?')[0] ?? ''
  const parts = path.split('/').filter(Boolean)
  const idx = parts.indexOf('analytics')
  return idx >= 0 ? parts[idx + 1] : parts[parts.length - 1]
}

export default async function handler(req: ApiRequest): Promise<ApiResponse> {
  switch (route(req)) {
    case 'scan':
      return scan(req)
    case 'taggo':
      return taggo(req)
    default:
      return { status: 404, body: { ok: false, error: 'not_found' } }
  }
}
