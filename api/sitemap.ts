import { readServerEnv } from './_lib/env'
import { buildSitemapXml } from './_lib/sitemap'
import type { ApiRequest, ApiResponse } from './_lib/types'

/**
 * GET /sitemap.xml
 *
 * Sitemap XML des pages publiques indexables de TAGGO.
 * 404 tant que `APP_URL` n'est pas configurée : le domaine public de TAGGO n'est
 * pas connu, et aucune URL absolue n'est inventée.
 */
export default async function handler(_req: ApiRequest): Promise<ApiResponse> {
  const env = readServerEnv()
  if (!env.appUrl) {
    return { status: 404, body: { ok: false, error: 'app_url_not_configured' } }
  }

  return {
    status: 200,
    body: buildSitemapXml(env.appUrl),
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  }
}