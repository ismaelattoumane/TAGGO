import { beforeEach, describe, expect, it } from 'vitest'
import {
  addCalendarYear,
  clearLocalSubscription,
  grantLocalIncludedPeriod,
  localSubscriptionAllowsPublic,
  readLocalSubscriptions,
  sweepLocalSubscriptions,
  writeLocalSubscriptions,
  type LocalSubscription,
} from './localSubscriptionStore'

/**
 * ÉTAPE 12 — Règles de période et de visibilité publique, en mode démo.
 *
 * Ces tests verrouillent les DEUX règles que la migration applique en base, afin
 * que le comportement observable en développement local soit exactement celui
 * qui s'applique en production :
 *
 *   1. une période est UNE ANNÉE CALENDAIRE, jamais un nombre de jours ;
 *   2. l'accès public exige une période `active` ET non échue — « pas de
 *      période » ne vaut PAS « accès libre ».
 */

beforeEach(() => {
  window.localStorage.clear()
})

describe('durée : une année calendaire, pas 365 jours', () => {
  const cases: Array<[string, string, string]> = [
    ['2025-10-01T12:00:00', '2026-10-01T12:00:00', 'année normale : 365 jours'],
    ['2026-10-01T12:00:00', '2027-10-01T12:00:00', 'année normale : 365 jours'],
    ['2027-03-01T12:00:00', '2028-03-01T12:00:00', '2028 est bissextile mais le 29/02 n’est pas atteint'],
    ['2028-03-01T12:00:00', '2029-03-01T12:00:00', 'période de 366 JOURS : +365 jours serait trop tôt'],
    ['2029-03-01T12:00:00', '2030-03-01T12:00:00', 'période de 365 jours : +366 jours serait trop tard'],
    ['2028-02-29T12:00:00', '2029-02-28T12:00:00', 'le 29/02 est recalé sur le dernier jour valide'],
    ['2024-02-29T12:00:00', '2025-02-28T12:00:00', 'idem sur un autre cycle bissextile'],
    ['2028-12-31T23:00:00', '2029-12-31T23:00:00', 'passage d’année'],
  ]

  for (const [start, expected, reason] of cases) {
    it(`${start} -> ${expected} (${reason})`, () => {
      const result = addCalendarYear(new Date(start))

      expect(result.getFullYear()).toBe(Number(expected.slice(0, 4)))
      expect(result.getMonth()).toBe(Number(expected.slice(5, 7)) - 1)
      expect(result.getDate()).toBe(Number(expected.slice(8, 10)))
      // L'heure n'est jamais touchée : seule la durée compte.
      expect(result.getHours()).toBe(new Date(start).getHours())
      expect(result.getMinutes()).toBe(new Date(start).getMinutes())
    })
  }

  it('ne déborde jamais sur le mois suivant quand le jour n’existe pas', () => {
    // Une implémentation naïve (`setFullYear` + recalage vers le haut) donnerait
    // le 1er mars 2029 : la période expirerait un mois trop tard, tous les 4 ans.
    const result = addCalendarYear(new Date(2028, 1, 29))
    expect(result.getMonth()).toBe(1)
    expect(result.getDate()).toBe(28)
  })

  it('diffère d’une journée d’un « + 365 jours » sur les années bissextiles', () => {
    // C'est la période qui CONTIENT le 29 février qui dure 366 jours — pas celle
    // qui le suit. Inverter ces deux cas est l'erreur classique ici.
    const start = new Date(2027, 2, 1) // 01/03/2027 -> 01/03/2028
    const calendarYear = addCalendarYear(start)
    const naive = new Date(start.getTime() + 365 * 86_400_000)

    expect(calendarYear.getTime() - start.getTime()).toBe(366 * 86_400_000)
    expect(naive.getTime()).toBeLessThan(calendarYear.getTime())
    expect(calendarYear.getTime() - naive.getTime()).toBe(86_400_000)
  })

  it('aligne « + 365 jours » quand l’intervalle ne contient pas de 29 février', () => {
    const start = new Date(2028, 2, 1) // 01/03/2028 -> 01/03/2029
    const calendarYear = addCalendarYear(start)
    const naive = new Date(start.getTime() + 365 * 86_400_000)

    expect(calendarYear.getTime()).toBe(naive.getTime())
  })
})

describe('visibilité publique : une période est obligatoire', () => {
  const NOW = new Date('2026-06-01T12:00:00Z')

  it('refuse l’accès quand aucune période n’existe', () => {
    // CAS CENTRAL DE LA CORRECTION : l'absence de période n'est pas une
    // autorisation. Un TAGGO sans abonnement est publiquement indisponible.
    expect(localSubscriptionAllowsPublic(undefined, NOW)).toBe(false)
  })

  it('refuse l’accès quand la période est expirée', () => {
    const expired: LocalSubscription = {
      status: 'expired',
      startedAt: '2025-01-01T00:00:00Z',
      endsAt: '2026-01-01T00:00:00Z',
      autoRenew: false,
    }
    expect(localSubscriptionAllowsPublic(expired, NOW)).toBe(false)
  })

  it('refuse l’accès quand `endsAt` est exactement atteinte', () => {
    // La borne est `ends_at > now()` : à l'instant exact de l'échéance, l'accès
    // est déjà fermé. Une seconde de grâce serait une dérogation.
    const boundary: LocalSubscription = {
      status: 'active',
      startedAt: '2025-06-01T12:00:00Z',
      endsAt: NOW.toISOString(),
      autoRenew: false,
    }
    expect(localSubscriptionAllowsPublic(boundary, NOW)).toBe(false)
  })

  it('refuse l’accès quand `endsAt` est illisible', () => {
    // Une date corrompue ne vaut pas preuve d'abonnement : le défaut est fermé.
    const corrupt: LocalSubscription = {
      status: 'active',
      startedAt: '2025-06-01T12:00:00Z',
      endsAt: 'pas-une-date',
      autoRenew: false,
    }
    expect(localSubscriptionAllowsPublic(corrupt, NOW)).toBe(false)
  })

  it('refuse l’accès quand le statut stocké n’est pas `active`', () => {
    const expired: LocalSubscription = {
      status: 'expired',
      startedAt: '2026-05-01T12:00:00Z',
      // Une date future sur une période expirée ne doit rien rouvrir.
      endsAt: '2027-05-01T12:00:00Z',
      autoRenew: false,
    }
    expect(localSubscriptionAllowsPublic(expired, NOW)).toBe(false)
  })

  it('autorise l’accès pour une période active et non échue', () => {
    const active: LocalSubscription = {
      status: 'active',
      startedAt: '2026-05-01T12:00:00Z',
      endsAt: '2027-05-01T12:00:00Z',
      autoRenew: false,
    }
    expect(localSubscriptionAllowsPublic(active, NOW)).toBe(true)
  })
})

describe('ouverture de la première année incluse', () => {
  it('ouvre une période d’une année calendaire à partir de l’instant fourni', () => {
    const start = new Date('2028-03-01T12:00:00Z')
    const granted = grantLocalIncludedPeriod('qr-1', start)

    expect(granted.status).toBe('active')
    expect(granted.startedAt).toBe(start.toISOString())
    expect(granted.endsAt).toBe(addCalendarYear(start).toISOString())
    expect(granted.autoRenew).toBe(false)
  })

  it('nrochit jamais la période en cas de rejeu', () => {
    // Idempotence, comme `on conflict (qr_code_id) do nothing` en base : un
    // rejeu du webhook ne peut pas allonger une période déjà ouverte.
    const first = grantLocalIncludedPeriod('qr-1', new Date('2026-01-01T00:00:00Z'))
    const replay = grantLocalIncludedPeriod('qr-1', new Date('2026-06-01T00:00:00Z'))

    expect(replay).toEqual(first)
    expect(readLocalSubscriptions()['qr-1'].endsAt).toBe(first.endsAt)
  })

  it('n’invente aucun prix, aucune fréquence et aucun identifiant Stripe', () => {
    writeLocalSubscriptions({})
    const granted = grantLocalIncludedPeriod('qr-1', new Date('2026-01-01T00:00:00Z'))

    const forbidden = ['price', 'amount', 'currency', 'stripe', 'interval', 'billing', 'invoice']
    for (const key of forbidden) {
      expect(Object.keys(granted), `champ ${key} interdit`).not.toContain(key)
    }
  })
})

describe('balayage d’expiration', () => {
  it('porte une période échue à `expired` sans toucher aux autres', () => {
    writeLocalSubscriptions({
      'qr-due': { status: 'active', startedAt: '2025-01-01T00:00:00Z', endsAt: '2026-01-01T00:00:00Z', autoRenew: false },
      'qr-live': { status: 'active', startedAt: '2026-01-01T00:00:00Z', endsAt: '2027-01-01T00:00:00Z', autoRenew: false },
      'qr-dead': { status: 'expired', startedAt: '2024-01-01T00:00:00Z', endsAt: '2025-01-01T00:00:00Z', autoRenew: false },
    })

    expect(sweepLocalSubscriptions(new Date('2026-06-01T12:00:00Z'))).toBe(1)

    const store = readLocalSubscriptions()
    expect(store['qr-due'].status).toBe('expired')
    expect(store['qr-live'].status).toBe('active')
    expect(store['qr-dead'].status).toBe('expired')
  })

  it('est idempotent : un second balayage ne change plus rien', () => {
    writeLocalSubscriptions({
      'qr-due': { status: 'active', startedAt: '2025-01-01T00:00:00Z', endsAt: '2026-01-01T00:00:00Z', autoRenew: false },
    })

    expect(sweepLocalSubscriptions(new Date('2026-06-01T12:00:00Z'))).toBe(1)
    expect(sweepLocalSubscriptions(new Date('2026-06-01T12:00:00Z'))).toBe(0)
  })

  it('ne rend pas la visibilité dépendante du balayage', () => {
    // Barrière (1) : la visibilité dépend de `endsAt`, jamais du statut stocké.
    // Même sans balayage, une période échue est déjà inaccessible.
    const store = readLocalSubscriptions()
    expect(store['qr-due']).toBeUndefined()

    writeLocalSubscriptions({
      'qr-due': { status: 'active', startedAt: '2025-01-01T00:00:00Z', endsAt: '2026-01-01T00:00:00Z', autoRenew: false },
    })

    expect(localSubscriptionAllowsPublic(readLocalSubscriptions()['qr-due'], new Date('2026-06-01T12:00:00Z'))).toBe(
      false,
    )
  })

  it('permet de retirer une période pour tester l’état « sans abonnement »', () => {
    grantLocalIncludedPeriod('qr-1', new Date('2026-01-01T00:00:00Z'))
    clearLocalSubscription('qr-1')

    expect(readLocalSubscriptions()['qr-1']).toBeUndefined()
    expect(localSubscriptionAllowsPublic(readLocalSubscriptions()['qr-1'])).toBe(false)
  })
})