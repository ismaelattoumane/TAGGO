/**
 * ÉTAPE 9 — Configuration serveur (Vercel Functions).
 *
 * RÈGLE ABSOLUE : ce module n'est importé QUE par les fonctions `/api`.
 * Les valeurs des secrets ne sont jamais renvoyées au navigateur : seules des
 * informations booléennes (`stripeConfigured`) peuvent sortir.
 *
 * Aucune clé n'est versionnée : tout provient des variables d'environnement.
 */

export type ServerEnv = {
  stripeSecretKey: string | undefined
  stripeWebhookSecret: string | undefined
  supabaseUrl: string | undefined
  supabaseServiceRoleKey: string | undefined
  appUrl: string | undefined
  /**
   * Étape 10 — Nom du provider d'emails transactionnels.
   * Vide par défaut : aucun email n'est envoyé tant que TAGGO n'a pas choisi
   * son prestataire. Ce n'est PAS un secret, mais il reste côté serveur.
   */
  emailProviderName: string | undefined
  /**
   * Étape 10 — Secret du provider d'emails. Serveur uniquement : ne jamais
   * le préfixer par `VITE_` (ce prefixe est embarqué dans le bundle navigateur).
   */
  emailProviderApiKey: string | undefined
}

export function readServerEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  return {
    stripeSecretKey: source.STRIPE_SECRET_KEY,
    stripeWebhookSecret: source.STRIPE_WEBHOOK_SECRET,
    supabaseUrl: source.SUPABASE_URL ?? source.VITE_SUPABASE_URL,
    supabaseServiceRoleKey: source.SUPABASE_SERVICE_ROLE_KEY,
    appUrl: source.APP_URL,
    emailProviderName: source.EMAIL_PROVIDER_NAME,
    emailProviderApiKey: source.EMAIL_PROVIDER_API_KEY,
  }
}

/** Clé Stripe présente ET utilisable (mode test uniquement tant qu'on est en étape 9). */
export function isStripeConfigured(env: ServerEnv): boolean {
  return Boolean(env.stripeSecretKey && env.stripeWebhookSecret)
}

export function isServerDatabaseConfigured(env: ServerEnv): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey)
}

/**
 * Garde-fou étape 9 : seules les clés de TEST sont acceptées tant que TAGGO
 * n'est pas passé en production. Aucune clé `sk_live_` n'est donc exploitable
 * par accident depuis ce code.
 */
export function assertTestModeKey(stripeSecretKey: string): void {
  if (!stripeSecretKey.startsWith('sk_test_')) {
    throw new Error('stripe_live_key_not_allowed')
  }
}