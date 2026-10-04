import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  daysUntil,
  EXPIRING_SOON_DAYS,
  getTaggoSubscriptionState,
  RENEWAL_PRICE_CONFIGURED,
  requestTaggoRenewal,
  setTaggoAutoRenew,
  SUBSCRIPTION_PERIOD_MONTHS,
  TAGGO_PLAN_LABEL,
  toTaggoSubscriptionState,
} from './subscriptionServer'

/**
 * ÉTAPE 12 — Tests de la logique serveur des abonnements TAGGO.
 *
 * Les scénarios couvrent les deux propriétés qui protègent le modèle
 * commercial : le navigateur ne peut ni écrire une date, ni écrire un statut,
 * et aucune réponse n'invente un montant ni une période.
 */

const QR_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_QR_ID = '22222222-2222-4222-8222-222222222222'
const OWNER_ID = '33333333-3333-4333-8333-333333333333'

const NOW = Date.parse('2026-10-01T12:00:00.000Z')
const IN_10_DAYS = '2026-10-11T12:00:00.000Z'
const IN_200_DAYS = '2027-04-19T12:00:00.000Z'
const LAST_YEAR = '2025-10-01T12:00:00.000Z'

type RpcCall = { fn: string; args: Record<string, unknown> }

function fakeClient(result: { data?: unknown; error?: unknown } | ((args: Record<string, unknown>) => { data?: unknown; error?: unknown })) {
  const calls: RpcCall[] = []
  const client = {
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return typeof result === 'function' ? result(args) : result
    }),
  }
  return { client: client as unknown as SupabaseClient, calls }
}

describe('constantes commerciales', () => {
  it('fixe la période à un an, sans autre durée', () => {
    expect(SUBSCRIPTION_PERIOD_MONTHS).toBe(12)
  })

  it("ne déclare aucun prix de renouvellement configuré", () => {
    // Tant que TAGGO n'a pas arrêté de tarif, le renouvellement est indisponible.
    // C'est une valeur forcée, pas un oubli.
    expect(RENEWAL_PRICE_CONFIGURED).toBe(false)
  })

  it('n’utilise qu’un libellé technique de plan, jamais un nom d’offre', () => {
    expect(TAGGO_PLAN_LABEL).toBe('taggo_annual')
    expect(TAGGO_PLAN_LABEL).not.toMatch(/€|eur|centime|price/i)
  })

  it('expose un seuil d’alerte, pas une durée commerciale', () => {
    expect(EXPIRING_SOON_DAYS).toBeGreaterThan(0)
    expect(EXPIRING_SOON_DAYS).toBeLessThan(365)
  })
})

describe('calcul du temps restant', () => {
  it('compte les jours restants', () => {
    expect(daysUntil(IN_10_DAYS, NOW)).toBe(10)
  })

  it('vaut 0 pour une période déjà terminée, jamais un nombre négatif', () => {
    expect(daysUntil(LAST_YEAR, NOW)).toBe(0)
  })

  it('vaut null si aucune date n’est connue — pas de date inventée', () => {
    expect(daysUntil(null, NOW)).toBeNull()
    expect(daysUntil('pas-une-date', NOW)).toBeNull()
  })
})

describe('normalisation de l’état renvoyé par la base', () => {
  it('convertit une charge utile complète', () => {
    const state = toTaggoSubscriptionState(
      {
        managed: true,
        subscription_status: 'active',
        source: 'included',
        auto_renew: false,
        started_at: '2025-10-01T12:00:00.000Z',
        ends_at: IN_200_DAYS,
        expired_at: null,
        lifecycle_status: 'active',
      },
      false,
      NOW,
    )

    expect(state).toEqual({
      managed: true,
      subscriptionRequired: false,
      status: 'active',
      source: 'included',
      autoRenew: false,
      startedAt: '2025-10-01T12:00:00.000Z',
      endsAt: IN_200_DAYS,
      expiredAt: null,
      lifecycleStatus: 'active',
      expiringSoon: false,
      renewalAvailable: false,
    })
  })

  it('marque « expire bientôt » à 30 jours de la fin', () => {
    const build = (endsAt: string) =>
      toTaggoSubscriptionState(
        { managed: true, subscription_status: 'active', ends_at: endsAt },
        false,
        NOW,
      )

    expect(build(IN_10_DAYS).expiringSoon).toBe(true)
    expect(build(IN_200_DAYS).expiringSoon).toBe(false)
  })

  it('ne signale jamais « expire bientôt » une période déjà expirée', () => {
    const state = toTaggoSubscriptionState(
      { managed: true, subscription_status: 'expired', ends_at: LAST_YEAR },
      false,
      NOW,
    )

    expect(state.expiringSoon).toBe(false)
    expect(state.status).toBe('expired')
  })

  it('ne gère pas un TAGGO sans période plutôt que de dire « actif »', () => {
    const state = toTaggoSubscriptionState({ managed: false, lifecycle_status: 'active' }, false, NOW)

    expect(state.managed).toBe(false)
    expect(state.status).toBeNull()
    expect(state.expiringSoon).toBe(false)
  })

  it('ignore un statut ou une source non reconnus', () => {
    const state = toTaggoSubscriptionState(
      { managed: true, subscription_status: 'pending', source: 'premium', ends_at: 'boum' },
      false,
      NOW,
    )

    expect(state.status).toBeNull()
    expect(state.source).toBeNull()
    expect(state.endsAt).toBeNull()
  })

  it('traite une réponse vide comme non gérée — jamais comme un TAGGO actif', () => {
    const state = toTaggoSubscriptionState(null, false, NOW)

    expect(state.managed).toBe(false)
    expect(state.status).toBeNull()
    expect(state.autoRenew).toBe(false)
  })
})

describe('lecture de l’état d’abonnement', () => {
  it('transmet le propriétaire déduit du JWT et le TAGGO', async () => {
    const { client, calls } = fakeClient({
      data: { ok: true, managed: true, subscription_status: 'active' },
    })

    const result = await getTaggoSubscriptionState(client, {
      qrId: QR_ID,
      ownerId: OWNER_ID,
      renewalAvailable: false,
    })

    expect(result.ok).toBe(true)
    expect(calls[0].fn).toBe('get_taggo_subscription_status')
    expect(calls[0].args).toEqual({ p_qr_id: QR_ID, p_owner_id: OWNER_ID })
  })

  it('refuse un TAGGO appartenant à quelqu’un d’autre', async () => {
    const { client } = fakeClient({ data: { ok: false, reason: 'not_owner' } })

    const result = await getTaggoSubscriptionState(client, {
      qrId: OTHER_QR_ID,
      ownerId: OWNER_ID,
      renewalAvailable: false,
    })

    expect(result).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('ne transforme jamais une panne en « aucune période »', async () => {
    const { client } = fakeClient({ error: new Error('timeout') })

    const result = await getTaggoSubscriptionState(client, {
      qrId: QR_ID,
      ownerId: OWNER_ID,
      renewalAvailable: false,
    })

    // Renvoyer un état vide ferait croire à un TAGGO sans abonnement : le
    // propriétaire verrait son TAGGO basculer en « aucune période gérée ».
    expect(result).toEqual({ ok: false, reason: 'subscription_unavailable' })
  })

  it('absorbe une exception réseau', async () => {
    const client = {
      rpc: vi.fn(async () => {
        throw new Error('ECONNRESET')
      }),
    } as unknown as SupabaseClient

    await expect(
      getTaggoSubscriptionState(client, { qrId: QR_ID, ownerId: OWNER_ID, renewalAvailable: false }),
    ).resolves.toEqual({ ok: false, reason: 'subscription_unavailable' })
  })

  it('refuse des identifiants malformés sans appeler la base', async () => {
    const { client, calls } = fakeClient({ data: { ok: true } })

    await expect(
      getTaggoSubscriptionState(client, { qrId: 'TGG-ABCD234', ownerId: OWNER_ID, renewalAvailable: false }),
    ).resolves.toEqual({ ok: false, reason: 'invalid_request' })
    await expect(
      getTaggoSubscriptionState(client, { qrId: QR_ID, ownerId: 'moi', renewalAvailable: false }),
    ).resolves.toEqual({ ok: false, reason: 'invalid_request' })
    expect(calls).toHaveLength(0)
  })
})

describe('renouvellement manuel', () => {
  it('refuse tant qu’aucun tarif n’est configuré, sans créer de commande', async () => {
    const { client, calls } = fakeClient({ data: { ok: true, managed: true, subscription_status: 'expired' } })

    const result = await requestTaggoRenewal(client, { qrId: QR_ID, ownerId: OWNER_ID })

    expect(result).toEqual({ ok: false, reason: 'renewal_unavailable' })
    // Aucune écriture : ni statut, ni date, ni appel Stripe.
    expect(calls).toHaveLength(0)
  })

  it('ne renvoie aucun montant, aucune devise et aucune durée commerciale', async () => {
    const { client } = fakeClient({ data: { ok: true } })

    const result = await requestTaggoRenewal(client, { qrId: QR_ID, ownerId: OWNER_ID })

    expect(JSON.stringify(result)).not.toMatch(/€|eur|cents|amount|price|prix/i)
  })

  it('refuse un identifiant malformé', async () => {
    const result = await requestTaggoRenewal({} as SupabaseClient, { qrId: 'nope', ownerId: OWNER_ID })

    expect(result).toEqual({ ok: false, reason: 'invalid_request' })
  })
})

describe('préférence de renouvellement automatique', () => {
  it('n’envoie que l’intention et le TAGGO', async () => {
    const { client, calls } = fakeClient({ data: true })

    const result = await setTaggoAutoRenew(client, { qrId: QR_ID, ownerId: OWNER_ID, autoRenew: true })

    expect(result).toEqual({ ok: true })
    expect(calls[0].fn).toBe('set_taggo_auto_renew')
    // Aucune date, aucun statut, aucun identifiant Stripe transmis : le
    // navigateur ne peut pas les modifier même s'il le voulait.
    expect(Object.keys(calls[0].args).sort()).toEqual(['p_auto_renew', 'p_owner_id', 'p_qr_id'])
  })

  it('refuse si le TAGGO n’appartient pas au propriétaire', async () => {
    const { client } = fakeClient({ data: false })

    const result = await setTaggoAutoRenew(client, {
      qrId: OTHER_QR_ID,
      ownerId: OWNER_ID,
      autoRenew: true,
    })

    expect(result).toEqual({ ok: false, reason: 'not_owner' })
  })

  it('remonte une panne plutôt que de dire que la préférence est enregistrée', async () => {
    const { client } = fakeClient({ error: new Error('boom') })

    await expect(
      setTaggoAutoRenew(client, { qrId: QR_ID, ownerId: OWNER_ID, autoRenew: false }),
    ).resolves.toEqual({ ok: false, reason: 'subscription_unavailable' })
  })
})
/**
 * ÉTAPE 12 — Le navigateur ne peut pas fabriquer un état financier.
 *
 * Ces tests ferment la surface d'attaque la plus coûteuse du modèle commercial :
 * si un client pouvait écrire `paid`, `renewed` ou `active`, il pourrait s'attribuer
 * des années d'abonnement gratuites avec une seule requête PostgREST.
 *
 * La garantie est vérifiée à trois niveaux : les arguments réellement envoyés,
 * les seules fonctions RPC appelées, et l'absence de tout chemin d'écriture.
 */
describe('le client ne peut pas écrire d’état financier', () => {
  const FORBIDDEN_ARGUMENT = /^(status|subscription_status|paid|renewed|payment|price|amount|starts_at|ends_at|expired_at|stripe_)/

  it('la lecture n’envoie ni statut, ni date, ni identifiant Stripe', async () => {
    const { client, calls } = fakeClient({ data: { ok: true, managed: true, subscription_status: 'active' } })

    await getTaggoSubscriptionState(client, { qrId: QR_ID, ownerId: OWNER_ID, renewalAvailable: false })

    expect(calls).toHaveLength(1)
    expect(calls[0].fn).toBe('get_taggo_subscription_status')
    for (const key of Object.keys(calls[0].args)) {
      expect(key, `argument ${key} interdit`).not.toMatch(FORBIDDEN_ARGUMENT)
    }
    // Le propriétaire vient du JWT, il n'est pas transmis comme une intention.
    expect(calls[0].args).toEqual({ p_qr_id: QR_ID, p_owner_id: OWNER_ID })
  })

  it('la préférence de renouvellement n’envoie qu’un booléen d’intention', async () => {
    const { client, calls } = fakeClient({ data: true })

    await setTaggoAutoRenew(client, { qrId: QR_ID, ownerId: OWNER_ID, autoRenew: true })

    expect(calls).toHaveLength(1)
    expect(calls[0].fn).toBe('set_taggo_auto_renew')
    expect(calls[0].args).toEqual({ p_qr_id: QR_ID, p_owner_id: OWNER_ID, p_auto_renew: true })
    for (const key of Object.keys(calls[0].args)) {
      expect(key, `argument ${key} interdit`).not.toMatch(FORBIDDEN_ARGUMENT)
    }
  })

  it('le renouvellement manuel n’appelle aucune fonction d’écriture du tout', async () => {
    const { client, calls } = fakeClient({ data: true })

    const outcome = await requestTaggoRenewal(client, { qrId: QR_ID, ownerId: OWNER_ID })

    // Aucune commande créée, aucune période prolongée, aucun statut déclaré.
    expect(calls).toHaveLength(0)
    expect(outcome).toEqual({ ok: false, reason: 'renewal_unavailable' })
  })

  it('aucune fonction n’écrit la période depuis une intention du client', async () => {
    // `set_taggo_auto_renew` ne touche QUE `auto_renew` : c'est la seule et unique
    // fonction d'écriture atteignable depuis une intention du client. Aucune
    // fonction de période, d'expiration ou de réactivation n'est exposée.
    const { client, calls } = fakeClient({ data: true })

    await setTaggoAutoRenew(client, { qrId: QR_ID, ownerId: OWNER_ID, autoRenew: false })

    expect(calls[0].fn).toBe('set_taggo_auto_renew')
    expect(calls[0].args).not.toHaveProperty('p_starts_at')
    expect(calls[0].args).not.toHaveProperty('p_ends_at')
  })

  it('marque « abonnement requis » dès qu’aucune période n’est renvoyée', () => {
    const unmanaged = toTaggoSubscriptionState({ managed: false, subscription_required: true }, false, NOW)
    const incomplete = toTaggoSubscriptionState({}, false, NOW)

    // Le défaut est prudent : le navigateur ne doit jamais croire qu’un TAGGO
    // sans période est publiquement accessible.
    expect(unmanaged.managed).toBe(false)
    expect(unmanaged.subscriptionRequired).toBe(true)
    expect(incomplete.subscriptionRequired).toBe(true)
  })

  it('ne signale pas « abonnement requis » quand une période existe', () => {
    const managed = toTaggoSubscriptionState(
      { managed: true, subscription_required: false, subscription_status: 'active', ends_at: IN_200_DAYS },
      false,
      NOW,
    )

    expect(managed.subscriptionRequired).toBe(false)
  })
})
