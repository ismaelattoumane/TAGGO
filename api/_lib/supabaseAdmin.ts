import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isServerDatabaseConfigured, type ServerEnv } from './env'

/**
 * ÉTAPE 9 — Client Supabase côté serveur (service_role).
 *
 * RÈGLES :
 * - utilisé uniquement par les fonctions `/api` ;
 * - la clé de service ne quitte JAMAIS le serveur (pas de logs, pas de réponse) ;
 * - il contourne la RLS, donc chaque fonction serveur doit vérifier elle-même
 *   l'identité et le droit d'accès (authentification par JWT pour le checkout,
 *   signature Stripe pour le webhook).
 */
export function createServerSupabase(env: ServerEnv): SupabaseClient {
  if (!isServerDatabaseConfigured(env)) {
    throw new Error('server_database_not_configured')
  }

  return createClient(env.supabaseUrl as string, env.supabaseServiceRoleKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Résout l'utilisateur réel à partir du JWT fourni par le navigateur.
 * Le `customerId` n'est JAMAIS lu depuis le corps de la requête.
 */
export async function resolveAuthenticatedUser(
  client: SupabaseClient,
  bearerToken: string | null,
): Promise<{ id: string; email: string | null } | null> {
  if (!bearerToken) return null

  const { data, error } = await client.auth.getUser(bearerToken)
  if (error || !data?.user) return null

  return { id: data.user.id, email: data.user.email ?? null }
}

export function extractBearerToken(authorization: string | string[] | undefined): string | null {
  const header = Array.isArray(authorization) ? authorization[0] : authorization
  if (!header) return null
  if (!header.toLowerCase().startsWith('bearer ')) return null
  const token = header.slice(7).trim()
  return token.length > 0 ? token : null
}