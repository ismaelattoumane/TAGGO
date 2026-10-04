import { describe, expect, it } from 'vitest'
import { assertTestModeKey, isServerDatabaseConfigured, isStripeConfigured, readServerEnv } from './env'

const TEST_ENV = {
  STRIPE_SECRET_KEY: 'sk_test_placeholder',
  STRIPE_WEBHOOK_SECRET: 'whsec_placeholder',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-placeholder',
  APP_URL: 'https://taggo.test',
}

describe('readServerEnv', () => {
  it('lit les variables serveur sans valeur par défaut', () => {
    expect(readServerEnv(TEST_ENV as NodeJS.ProcessEnv)).toEqual({
      stripeSecretKey: 'sk_test_placeholder',
      stripeWebhookSecret: 'whsec_placeholder',
      supabaseUrl: 'https://project.supabase.co',
      supabaseServiceRoleKey: 'service-role-placeholder',
      appUrl: 'https://taggo.test',
    })
  })

  it('accepte VITE_SUPABASE_URL en repli', () => {
    const env = readServerEnv({ VITE_SUPABASE_URL: 'https://fallback.supabase.co' } as NodeJS.ProcessEnv)
    expect(env.supabaseUrl).toBe('https://fallback.supabase.co')
  })

  it('ne manufacture aucune valeur manquante', () => {
    const env = readServerEnv({} as NodeJS.ProcessEnv)
    expect(env.stripeSecretKey).toBeUndefined()
    expect(env.stripeWebhookSecret).toBeUndefined()
    expect(env.supabaseServiceRoleKey).toBeUndefined()
  })
})

describe('assertTestModeKey', () => {
  it('accepte une clé de test', () => {
    expect(() => assertTestModeKey('sk_test_abc123')).not.toThrow()
  })

  it('refuse toute clé live', () => {
    expect(() => assertTestModeKey('sk_live_abc123')).toThrow('stripe_live_key_not_allowed')
  })

  it('refuse une clé vide ou d’un autre format', () => {
    expect(() => assertTestModeKey('')).toThrow()
    expect(() => assertTestModeKey('rk_test_abc123')).toThrow()
    expect(() => assertTestModeKey('sk_test')).toThrow()
  })

  it('ne peut pas être contournée par une clé commençant par sk_test_', () => {
    // `sk_test_` est le seul préfixe accepté : une clé live ne peut pas le porter.
    expect(() => assertTestModeKey('sk_live_sk_test_fake')).toThrow('stripe_live_key_not_allowed')
  })
})

describe('isStripeConfigured', () => {
  it('exige la clé secrète ET le secret de webhook', () => {
    expect(isStripeConfigured(readServerEnv(TEST_ENV as NodeJS.ProcessEnv))).toBe(true)
    expect(
      isStripeConfigured(readServerEnv({ STRIPE_SECRET_KEY: 'sk_test_x' } as NodeJS.ProcessEnv)),
    ).toBe(false)
    expect(
      isStripeConfigured(readServerEnv({ STRIPE_WEBHOOK_SECRET: 'whsec_x' } as NodeJS.ProcessEnv)),
    ).toBe(false)
  })
})

describe('isServerDatabaseConfigured', () => {
  it('exige URL et clé de service', () => {
    expect(isServerDatabaseConfigured(readServerEnv(TEST_ENV as NodeJS.ProcessEnv))).toBe(true)
    expect(isServerDatabaseConfigured(readServerEnv({} as NodeJS.ProcessEnv))).toBe(false)
  })
})
