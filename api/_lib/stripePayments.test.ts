import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ÉTAPE 9 — Garde-fous vérifiables SANS exécution PostgreSQL.
 *
 * Ces tests lisent la migration et le code : ils échouent si une propriété de
 * sécurité est régressée (client pouvant payer, webhook rejouable, TAGGO
 * réservé avant paiement, secret versionné…).
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')

const MIGRATION = readFileSync(
  resolve(root, 'supabase/migrations/20260930000000_stripe_payments.sql'),
  'utf8',
)

const SERVERED_FILES = [
  'api/_lib/env.ts',
  'api/_lib/stripeGateway.ts',
  'api/_lib/webhook.ts',
  'api/_lib/checkout.ts',
  'api/_lib/http.ts',
  'api/_lib/supabaseAdmin.ts',
  'api/_lib/orderServer.ts',
  'api/stripe/create-checkout-session.ts',
  'api/stripe/webhook.ts',
  'api/stripe/config.ts',
  'api/orders/status.ts',
].map((path) => ({ path, content: readFileSync(resolve(root, path), 'utf8') }))

function readSrcFiles(dir: string, skipTests = false): { path: string; content: string }[] {
  const absolute = resolve(root, dir)
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
  const files: { path: string; content: string }[] = []

  for (const name of readdirSync(absolute)) {
    const full = `${absolute}/${name}`
    if (statSync(full).isDirectory()) {
      files.push(...readSrcFiles(`${dir}/${name}`, skipTests))
      continue
    }
    if (skipTests && name.includes('.test.')) continue
    if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      files.push({ path: `${dir}/${name}`, content: readFileSync(full, 'utf8') })
    }
  }

  return files
}

describe('migration stripe_payments — surface SQL', () => {
  it('déclare le statut paid et les colonnes Stripe', () => {
    expect(MIGRATION).toMatch(/'paid'/)
    expect(MIGRATION).toMatch(/stripe_checkout_session_id/)
    expect(MIGRATION).toMatch(/stripe_payment_intent_id/)
    expect(MIGRATION).toMatch(/stripe_event_id/)
  })

  it('n autorise qu’une seule session Stripe par commande', () => {
    expect(MIGRATION).toMatch(
      /create unique index if not exists idx_orders_stripe_session_unique[\s\S]*?unique[\s\S]*?stripe_checkout_session_id/,
    )
  })

  it('garantit l’idempotence du webhook par contrainte UNIQUE', () => {
    expect(MIGRATION).toMatch(/stripe_event_id text not null unique/)
  })

  it('autorise plusieurs TAGGO par commande (un par exemplaire vendu)', () => {
    expect(MIGRATION).toMatch(/drop index if exists public\.idx_taggo_assignments_order_id_unique/)
    expect(MIGRATION).toMatch(/idx_taggo_assignments_order_qr_unique/)
    expect(MIGRATION).not.toMatch(/idx_taggo_assignments_order_id_unique\s*\(\s*order_id\s*\)\s*unique/i)
  })

  it('interdit au client de passer une commande à paid', () => {
    const policy = MIGRATION.slice(MIGRATION.indexOf('create policy "Customers can update their own orders"'))
    const block = policy.slice(0, policy.indexOf(';'))

    expect(block).toMatch(/status in \('draft', 'pending'\)/)
    expect(block).not.toMatch(/'paid'/)
    expect(block).toMatch(/paid_at is null/)
    expect(block).toMatch(/stripe_checkout_session_id is null/)
    expect(block).toMatch(/subtotal_cents is null/)
  })

  it('réserve les écritures de paiement et de réservation au service_role', () => {
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.mark_shop_order_paid[\s\S]*?from public, anon, authenticated;\s*grant execute on function public\.mark_shop_order_paid[\s\S]*?to service_role;/,
    )
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.reserve_taggos_for_paid_order[\s\S]*?from public, anon, authenticated;\s*grant execute on function public\.reserve_taggos_for_paid_order[\s\S]*?to service_role;/,
    )
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.begin_stripe_event[\s\S]*?from public, anon, authenticated;\s*grant execute on function public\.begin_stripe_event[\s\S]*?to service_role;/,
    )
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.finish_stripe_event[\s\S]*?from public, anon, authenticated;\s*grant execute on function public\.finish_stripe_event[\s\S]*?to service_role;/,
    )
  })

  it('n’accorde create_shop_order qu’aux utilisateurs authentifiés', () => {
    expect(MIGRATION).toMatch(
      /revoke execute on function public\.create_shop_order[\s\S]*?from public, anon;\s*grant execute on function public\.create_shop_order[\s\S]*?to authenticated;/,
    )
  })

  it('contrôle le montant et la devise dans la fonction de paiement', () => {
    const start = MIGRATION.indexOf('create or replace function public.mark_shop_order_paid')
    const body = MIGRATION.slice(start, MIGRATION.indexOf('create or replace function public.reserve_taggos_for_paid_order'))

    expect(body).toMatch(/p_amount_total is distinct from target\.subtotal_cents/)
    expect(body).toMatch(/<> 'EUR'/)
    expect(body).toMatch(/p_currency/)
    expect(body).toMatch(/set status = 'paid'/)
  })

  it('ne réserve des TAGGO que sur une commande payée', () => {
    const start = MIGRATION.indexOf('create or replace function public.reserve_taggos_for_paid_order')
    const body = MIGRATION.slice(start, MIGRATION.indexOf('create or replace function public.begin_stripe_event'))

    expect(body).toMatch(/status\s*<>\s*'paid'/)
    expect(body).not.toMatch(/status\s*=\s*'pending'/)
  })

  it('ne publie aucun prix inventé dans le catalogue de départ', () => {
    const inserts = MIGRATION.slice(MIGRATION.indexOf('insert into public.products'))
    expect(inserts).toMatch(/values/i)
    expect(inserts).not.toMatch(/price_cents\s*values\s*\(\s*\d/i)
  })
})

describe('côté serveur — règles non négociables', () => {
  it('refuse toute clé Stripe qui n’est pas en mode test', () => {
    const env = SERVERED_FILES.find((file) => file.path === 'api/_lib/env.ts')

    expect(env?.content).toMatch(/startsWith\('sk_test_'\)/)
    expect(env?.content).toMatch(/stripe_live_key_not_allowed/)
  })

  it('vérifie la signature Stripe avant tout traitement', () => {
    const webhook = SERVERED_FILES.find((file) => file.path === 'api/stripe/webhook.ts')

    expect(webhook?.content).toMatch(/constructWebhookEvent\(rawBody, signature, env\.stripeWebhookSecret/)
    const signatureCheck = webhook?.content.lastIndexOf('constructWebhookEvent') ?? -1
    const processing = webhook?.content.lastIndexOf('processStripeEvent(') ?? -1
    expect(signatureCheck).toBeGreaterThan(-1)
    expect(signatureCheck).toBeLessThan(processing)
  })

  it('lit le corps brut du webhook sans le parser au préalable', () => {
    const http = SERVERED_FILES.find((file) => file.path === 'api/_lib/http.ts')

    expect(http?.content).toMatch(/export async function readRawBody/)
  })

  it('n’écrit jamais paid depuis le checkout', () => {
    const checkout = SERVERED_FILES.find((file) => file.path === 'api/_lib/checkout.ts')

    expect(checkout?.content).not.toMatch(/mark_shop_order_paid/)
    expect(checkout?.content).not.toMatch(/reserve_taggos_for_paid_order/)
  })

  it('refuse une clé live au moment de créer la passerelle Stripe', () => {
    const gateway = SERVERED_FILES.find((file) => file.path === 'api/_lib/stripeGateway.ts')

    expect(gateway?.content).toMatch(/assertTestModeKey\(secretKey\)/)
  })

  it('ne renvoie jamais de secret au navigateur', () => {
    for (const file of SERVERED_FILES.filter((item) => item.path.endsWith('.ts') && !item.path.startsWith('api/_lib/env'))) {
      expect(file.content).not.toMatch(/stripeSecretKey:\s*env|supabaseServiceRoleKey:\s*env|stripeWebhookSecret:\s*env/)
      expect(file.content).not.toMatch(/body:[\s\S]{0,80}SecretKey/)
    }
  })
})

describe('côté frontend — aucune fuite de serveur', () => {
  const SRC_FILES = readSrcFiles('src')

  it('n’importe jamais le SDK Stripe', () => {
    for (const file of SRC_FILES) {
      expect(file.content).not.toMatch(/from ['"]stripe['"]/)
    }
  })

  it('n’a aucune référence aux secrets serveur', () => {
    for (const file of SRC_FILES) {
      expect(file.content).not.toMatch(/STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY/)
      expect(file.content).not.toMatch(/sk_(test|live)_|whsec_/)
    }
  })

  it('n’écrit aucun statut de commande payée depuis le navigateur', () => {
    for (const file of readSrcFiles('src', true)) {
      expect(file.content).not.toMatch(/updateOrderStatus\([^)]*'paid'/)
      expect(file.content).not.toMatch(/status:\s*'paid'/)
      expect(file.content).not.toMatch(/'paid'\s*:\s*true/)
    }
  })

  it('n’envoie au serveur que des références et des quantités', () => {
    const client = SRC_FILES.find((file) => file.path === 'src/features/payments/checkoutClient.ts')

    expect(client?.content).toMatch(/items: items\.map\(\(item\) => \(\{ \.\.\.item \}\)\)/)
    expect(client?.content).not.toMatch(/subtotalCents:\s*\d|unitPriceCents:\s*\d/)
  })
})

describe('dépôt — aucun secret versionné', () => {
  const TRACKED_TEXT = [
    ...SERVERED_FILES,
    ...readSrcFiles('src'),
    { path: '.env.example', content: readFileSync(resolve(root, '.env.example'), 'utf8') },
  ]

  it('ne contient aucune clé Stripe ni secret Supabase', () => {
    for (const file of TRACKED_TEXT) {
      expect(file.content).not.toMatch(/sk_(test|live)_[A-Za-z0-9]{8,}/)
      expect(file.content).not.toMatch(/whsec_[A-Za-z0-9]{8,}/)
      expect(file.content).not.toMatch(/service_role[_-]key['"]?\s*[:=]\s*['"][A-Za-z0-9._-]{12,}/)
    }
  })
})
