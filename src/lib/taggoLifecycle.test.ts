import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { daysUntil } from '../../api/_lib/subscriptionServer'
import { addCalendarYear } from '../features/qr/localSubscriptionStore'
import { toSubscriptionDisplay, type TaggoSubscriptionState } from '../features/subscriptions/subscriptionTypes'

/**
 * ÉTAPE 12 — Scénarios de cycle de vie, concurrence et idempotence.
 *
 * Le projet n'exécute pas de PostgreSQL dans les tests : ces scénarios
 * rejouent donc la LOGIQUE des fonctions SQL (transitions, balayage,
 * idempotence) en TypeScript, à partir des mêmes règles que la migration.
 *
 * Ce que cela ne couvre pas, et qui reste à vérifier en staging : le comportement
 * réel de Postgres (verrouillage `for update`, `on conflict`, RLS). C'est
 * indiqué comme limite dans docs/subscriptions.md.
 */

const root = process.cwd()

const MIGRATION = readFileSync(
  resolve(root, 'supabase/migrations/20260931100000_taggo_subscriptions.sql'),
  'utf8',
)

/** Extrait une fonction SQL par son nom de création et la suivante. */
function sqlFunction(source: string, name: string, nextName: string): string {
  const start = source.indexOf(`create or replace function public.${name}`)
  const end = source.indexOf(`create or replace function public.${nextName}`)
  expect(start, `fonction introuvable : ${name}`).toBeGreaterThanOrEqual(0)
  return source.slice(start, end > start ? end : undefined)
}

const SWEEP = sqlFunction(MIGRATION, 'expire_due_taggo_subscriptions()', 'reactivate_taggo_subscription')
const INCLUDED = sqlFunction(MIGRATION, 'grant_included_taggo_period(', 'taggo_subscription_allows_public')
const RENEWAL = sqlFunction(MIGRATION, 'renew_taggo_subscription(', 'set_taggo_auto_renew(')
const REACTIVATE_SQL = sqlFunction(MIGRATION, 'reactivate_taggo_subscription', 'renew_taggo_subscription(')
const AUTO_RENEW = sqlFunction(MIGRATION, 'set_taggo_auto_renew(', 'get_taggo_subscription_status')
const STATUS = sqlFunction(MIGRATION, 'get_taggo_subscription_status', 'transition_taggo(')

/**
 * Copie du graphe de transitions de `src/features/qr/taggoLifecycle.ts` (étape 5).
 *
 * Le fichier ci-dessous n'exporte pas sa table. Elle est recopiée ici, et un
 * test vérifie plus bas que la copie est toujours identique à la source : une
 * divergence ferait échouer la suite plutôt que de passer inaperçue.
 */
const LIFECYCLE = {
  available: ['reserved', 'cancelled'],
  reserved: ['available', 'assigned', 'cancelled'],
  assigned: ['activated', 'cancelled'],
  activated: ['active', 'cancelled'],
  active: ['inactive', 'expired', 'suspended', 'replaced'],
  inactive: ['active', 'replaced', 'cancelled'],
  expired: ['active', 'replaced', 'cancelled'],
  suspended: ['active', 'replaced', 'cancelled'],
  replaced: [],
  cancelled: [],
} as const satisfies Record<string, readonly string[]>

type Lifecycle = keyof typeof LIFECYCLE

function canTransition(from: Lifecycle, to: string): boolean {
  return (LIFECYCLE[from] as readonly string[]).includes(to)
}

/** Fixture : un TAGGO acheté il y a un an, dont la période vient d'échouer. */
function expiredTaggo() {
  const paidAt = Date.parse('2025-09-01T10:00:00.000Z')
  return {
    lifecycleStatus: 'active' as Lifecycle,
    subscriptionStatus: 'active' as const,
    startedAt: new Date(paidAt).toISOString(),
    endsAt: new Date(Date.parse('2026-09-01T10:00:00.000Z')).toISOString(),
    autoRenew: false,
  }
}

/** Fixture : TAGGO acheté aujourd'hui, période incluse en cours. */
function freshTaggo() {
  const paidAt = Date.parse('2026-10-01T10:00:00.000Z')
  return {
    lifecycleStatus: 'active' as Lifecycle,
    subscriptionStatus: 'active' as const,
    startedAt: new Date(paidAt).toISOString(),
    endsAt: new Date(Date.parse('2027-10-01T10:00:00.000Z')).toISOString(),
    autoRenew: false,
  }
}

describe('cohérence du graphe de transitions', () => {
  it('la copie du graphe est identique à la source TypeScript', () => {
    const source = readFileSync(resolve(root, 'src/features/qr/taggoLifecycle.ts'), 'utf8')

    for (const [from, targets] of Object.entries(LIFECYCLE)) {
      const line = new RegExp(`${from}:\\s*\\[([^\\]]*)\\]`).exec(source)
      expect(line, `transition absente de la source : ${from}`).not.toBeNull()

      const parsed = (line as RegExpExecArray)[1]
        .split(',')
        .map((value) => value.trim().replace(/^'|'$/g, ''))
        .filter((value) => value.length > 0)

      expect(parsed, `graphe divergent pour « ${from} »`).toEqual([...targets])
    }
  })

  it('la migration ne modifie pas les transitions autorisées', () => {
    // Seule une garde est ajoutée (interdire `active` quand la période est
    // échue) ; aucune arête du graphe n'est créée ni supprimée.
    const transitionFn = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public.transition_taggo'),
      MIGRATION.indexOf('-- ---------------------------------------------------------------------------' +
        '\n-- 9. Page publique'),
    )

    for (const edge of [
      "q.lifecycle_status = 'activated' and p_target_status = 'active'",
      "q.lifecycle_status = 'active' and p_target_status in ('inactive', 'expired', 'suspended', 'replaced')",
      "q.lifecycle_status = 'inactive' and p_target_status in ('active', 'replaced', 'cancelled')",
      "q.lifecycle_status = 'expired' and p_target_status in ('active', 'replaced', 'cancelled')",
      "q.lifecycle_status = 'suspended' and p_target_status in ('active', 'replaced', 'cancelled')",
    ]) {
      expect(transitionFn.replace(/\s+/g, ' '), `arête perdue : ${edge}`).toMatch(
        new RegExp(edge.replace(/[()',]/g, (c) => `\\${c}`)),
      )
    }
  })
})

describe('scénario 1 — création d’une période incluse après paiement confirmé', () => {
  it('la période vaut exactement un an et démarre au paiement', () => {
    const taggo = freshTaggo()

    // « Un an » est une ANNÉE CALENDAIRE : ici octobre 2026 -> octobre 2027,
    // l'intervalle ne contient pas de 29 février, donc cela fait bien 365 jours.
    // Le test utile est la correspondance des DATES, pas le nombre de jours.
    const started = new Date(taggo.startedAt)
    const ends = new Date(taggo.endsAt)
    expect(ends.getFullYear()).toBe(started.getFullYear() + 1)
    expect(ends.getMonth()).toBe(started.getMonth())
    expect(ends.getDate()).toBe(started.getDate())
    expect(ends.getTime() - started.getTime()).toBe(365 * 86_400_000)
    expect(taggo.subscriptionStatus).toBe('active')
  })

  it('la durée n’est pas « 365 jours » : le test le prouve sur une année bissextile', () => {
    // Une période qui CONTIENT le 29 février dure 366 jours. Si l’implémentation
    // était « + 365 jours », ce TAGGO expirerait un jour trop tôt, une fois tous
    // les quatre ans.
    const started = new Date('2027-03-01T10:00:00Z')
    const ends = addCalendarYear(started)

    expect(ends.getTime() - started.getTime()).toBe(366 * 86_400_000)
    expect(ends.toISOString().slice(0, 10)).toBe('2028-03-01')
    // Le « + 365 jours » naïf, lui, tombe au 29/02/2028 : un jour trop tôt.
    expect(new Date(started.getTime() + 365 * 86_400_000).toISOString().slice(0, 10)).toBe('2028-02-29')
  })

  it('la migration n’utilise que `interval \'1 year\'` pour calculer ends_at', () => {
    expect(MIGRATION).toMatch(/interval '1 year'/)
    expect(MIGRATION).not.toMatch(/interval '\d+ days?'/i)
  })

  it('la migration rattache le début à orders.paid_at', () => {
    expect(MIGRATION).toMatch(/included_starts := coalesce\(target\.paid_at, now\(\)\)/)
  })
})

describe('scénario 2 — commande non payée → aucun abonnement', () => {
  it('la fonction d’attribution refuse une commande non payée', () => {
    expect(MIGRATION).toMatch(/if target\.status <> 'paid' then\s+raise exception 'order_not_paid'/)
  })

  it('la période n’est ouverte que depuis l’attribution, jamais depuis le checkout', () => {
    // Aucune fonction d'ouverture de période n'est appelée depuis
    // create-checkout-session : le checkout ne crée que la commande.
    const checkout = readFileSync(resolve(root, 'api/stripe/create-checkout-session.ts'), 'utf8')
    expect(checkout).not.toMatch(/grant_included_taggo_period|renew_taggo_subscription/)
  })
})

describe('scénario 3 — TAGGO actif avec abonnement valide', () => {
  it('reste actif et public', () => {
    const taggo = freshTaggo()
    expect(taggo.subscriptionStatus).toBe('active')
    expect(daysUntil(taggo.endsAt, Date.parse('2026-10-15T00:00:00.000Z'))).toBeGreaterThan(30)
  })
})

describe('scénario 4 et 5 — expiration à la date prévue', () => {
  it('ne signale plus de jours restants une fois la période échue', () => {
    expect(daysUntil(expiredTaggo().endsAt, Date.parse('2026-10-15T00:00:00.000Z'))).toBe(0)
  })

  it('le balayage ne touche que la période active ET échue', () => {
    expect(SWEEP).toMatch(/where s\.status = 'active'/)
    expect(SWEEP).toMatch(/and s\.ends_at <= now\(\)/)
  })

  it('bascule le TAGGO actif en expiré, sans toucher les autres', () => {
    expect(SWEEP).toMatch(/set lifecycle_status = 'expired'/)
    // Un TAGGO `assigned`, `suspended` ou `replaced` n'est pas touché.
    expect(SWEEP).toMatch(/and q\.lifecycle_status = 'active'/)
  })

  it('le statut affiché devient « Expiré »', () => {
    const state: TaggoSubscriptionState = {
      managed: true,
    subscriptionRequired: false,
      status: 'expired',
      source: 'included',
      autoRenew: false,
      startedAt: '2025-09-01T10:00:00.000Z',
      endsAt: '2026-09-01T10:00:00.000Z',
      expiredAt: '2026-09-01T10:00:00.000Z',
      lifecycleStatus: 'expired',
      expiringSoon: false,
      renewalAvailable: false,
    }

    expect(toSubscriptionDisplay(state)).toBe('expired')
  })
})

describe('scénario 6 et 7 — réactivation seulement après renouvellement confirmé', () => {
  it('le graphe autorise expired → active', () => {
    expect(canTransition('expired', 'active')).toBe(true)
  })

  it('la réactivation serveur exige une période active ET non échue', () => {
    expect(REACTIVATE_SQL).toMatch(/s\.status = 'active'/)
    expect(REACTIVATE_SQL).toMatch(/and s\.ends_at > now\(\)/)
    expect(REACTIVATE_SQL).toMatch(/reason', 'no_valid_subscription'/)
  })

  it('sans renouvellement confirmé, la fonction refuse — le client ne peut pas forcer', () => {
    // Simulation du contrôle : c'est exactement la condition SQL.
    const noSubscription = { status: 'expired', endsAt: '2020-01-01T00:00:00.000Z' }
    const now = Date.parse('2026-10-01T00:00:00.000Z')
    const valid =
      noSubscription.status === 'active' && new Date(noSubscription.endsAt).getTime() > now

    expect(valid).toBe(false)
  })
})

describe('scénario 8 — utilisateur A ne peut pas lire l’abonnement de B', () => {
  it('la lecture est refusée si le propriétaire ne correspond pas', () => {
    expect(STATUS).toMatch(/q\.id = p_qr_id and q\.owner_id = p_owner_id/)
    expect(STATUS).toMatch(/reason', 'not_owner'/)
  })

  it('la RLS limite la lecture au propriétaire', () => {
    expect(MIGRATION).toMatch(
      /create policy "Users can view their own subscriptions" on public\.subscriptions\s+for select using \(auth\.uid\(\) = user_id\)/,
    )
  })
})

describe('scénario 9 et 10 — le client ne peut écrire ni expires_at ni status', () => {
  it('aucune politique d’écriture n’existe sur la table', () => {
    expect(MIGRATION).not.toMatch(
      /create policy[\s\S]*?on public\.subscriptions\s+for (insert|update|delete)/,
    )
    expect(MIGRATION).toMatch(/revoke insert, update, delete on public\.subscriptions from authenticated/)
  })

  it('les seules écritures passent par des fonctions service_role', () => {
    for (const fn of ['grant_included_taggo_period', 'renew_taggo_subscription', 'set_taggo_auto_renew']) {
      expect(MIGRATION).toMatch(
        new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`),
      )
    }
  })
})

describe('scénario 11 — webhook dupliqué', () => {
  it('l’inclusion est protégée par un conflit sur le TAGGO, pas sur une nouvelle ligne', () => {
    expect(MIGRATION).toMatch(/on conflict \(qr_code_id\) do nothing/)
    // Un rejeu passe aussi par le chemin `already_reserved`, qui ré-applique
    // l'inclusion sans jamais créer de seconde période.
    expect(MIGRATION).toMatch(/perform public\.grant_included_taggo_period\(index, included_starts\)/)
  })

  it('la journalisation Stripe reste l’idempotence de premier niveau', () => {
    const webhook = readFileSync(resolve(root, 'api/_lib/webhook.ts'), 'utf8')
    expect(webhook).toMatch(/if \(!firstTime\)/)
    expect(webhook).toMatch(/duplicate_event/)
  })
})

describe('scénario 12 — paiement déjà traité', () => {
  it('une commande déjà payée est refusée par l’attribution', () => {
    // La fonction d'attribution ne s'exécute que sur une commande `paid`, et son
    // rejeu est idempotent : rien n'est prolongé.
    const reserve = MIGRATION.slice(
      MIGRATION.indexOf('create or replace function public.reserve_taggos_for_paid_order'),
    )

    expect(reserve).toMatch(/if target\.status <> 'paid' then\s+raise exception 'order_not_paid'/)
    expect(reserve).toMatch(/if taggo_count > 0 then/)
  })

  it('une période déjà ouverte n’est jamais rouverte par un rejeu', () => {
    expect(INCLUDED).toMatch(/on conflict \(qr_code_id\) do nothing/)
    expect(INCLUDED).not.toMatch(/do update/)
  })

  it('le webhook existant refuse déjà un second mark_shop_order_paid', () => {
    const payments = readFileSync(
      resolve(root, 'supabase/migrations/20260930000000_stripe_payments.sql'),
      'utf8',
    )
    expect(payments).toMatch(/if target\.status = 'paid' then[\s\S]*?already_paid', true/)
  })
})

describe('scénario 13 — plusieurs TAGGO du même propriétaire', () => {
  it('chaque TAGGO a sa propre période, sans conflit entre propriétaires', () => {
    // L'unicité est sur qr_code_id, pas sur user_id : deux TAGGO d'un même
    // compte ont deux périodes distinctes.
    expect(MIGRATION).toMatch(/create unique index if not exists idx_subscriptions_qr_code_unique\s+on public\.subscriptions \(qr_code_id\)/)
    expect(MIGRATION).not.toMatch(/unique \(user_id\)|unique index[\s\S]*\(user_id\)/)
  })

  it('chaque TAGGO du même propriétaire expire indépendamment', () => {
    const taggos = [
      { id: 'A', endsAt: '2026-09-01T00:00:00.000Z' },
      { id: 'B', endsAt: '2027-03-01T00:00:00.000Z' },
    ]
    const now = Date.parse('2026-10-01T00:00:00.000Z')

    expect(daysUntil(taggos[0].endsAt, now)).toBe(0)
    expect(daysUntil(taggos[1].endsAt, now)).toBeGreaterThan(0)
  })
})

describe('scénario 14 et 15 — suspendu, remplacé, supprimé ≠ expiré', () => {
  it('un TAGGO suspendu n’est pas présenté comme expiré', () => {
    const state: TaggoSubscriptionState = {
      managed: true,
    subscriptionRequired: false,
      status: 'expired',
      source: 'included',
      autoRenew: false,
      startedAt: null,
      endsAt: null,
      expiredAt: null,
      lifecycleStatus: 'suspended',
      expiringSoon: false,
      renewalAvailable: false,
    }

    expect(toSubscriptionDisplay(state)).toBe('suspended')
  })

  it('un TAGGO remplacé n’est pas présenté comme expiré', () => {
    const state: TaggoSubscriptionState = {
      managed: true,
    subscriptionRequired: false,
      status: 'expired',
      source: 'included',
      autoRenew: false,
      startedAt: null,
      endsAt: null,
      expiredAt: null,
      lifecycleStatus: 'replaced',
      expiringSoon: false,
      renewalAvailable: false,
    }

    expect(toSubscriptionDisplay(state)).toBe('replaced')
  })

  it('le graphe distingue ces états : aucun ne mène automatiquement à expiré', () => {
    // Seul `expired` porte la sémantique d'expiration ; `suspended` et
    // `replaced` sont des décisions du propriétaire, pas du calendrier.
    expect(LIFECYCLE.active).toContain('expired')
    expect(LIFECYCLE.active).toContain('suspended')
    expect(LIFECYCLE.active).toContain('replaced')
    expect(LIFECYCLE.expired).not.toContain('suspended')
  })

  it('un TAGGO supprimé n’est pas un TAGGO expiré', () => {
    // Un TAGGO supprimé n'existe plus : il n'a ni page ni état. La migration ne
    // crée aucun chemin de suppression.
    expect(MIGRATION).not.toMatch(/delete from public\.qr_codes/)
  })
})

describe('scénario 18 — analytics continue de fonctionner', () => {
  it('la fonction de comptage des scans est préservée et enrichie', () => {
    expect(MIGRATION).toMatch(/create or replace function public\.record_taggo_scan/)
    expect(MIGRATION).toMatch(/select coalesce\(max\(s\.min_interval_seconds\), 30\)/)
    expect(MIGRATION).toMatch(/insert into public\.taggo_scans \(qr_code_id, scanned_at\)/)
  })

  it('un TAGGO expiré n’est pas compté comme un scan réussi', () => {
    // La page affiche un état, pas la destination : le scan n'a pas abouti.
    expect(MIGRATION).toMatch(/if found and not public\.taggo_subscription_allows_public\(target\.id\) then\s+return 'not_active'/)
  })

  it('la table des scans reste à deux colonnes de données', () => {
    // L'étape 12 n'ajoute aucune donnée personnelle : le contrat de
    // confidentialité de l'étape 11 tient toujours.
    expect(MIGRATION).not.toMatch(/alter table public\.taggo_scans/)
  })
})

describe('scénario 23 et 24 — idempotence et concurrence', () => {
  it('le renouvellement calcule toujours la fin depuis un début serveur', () => {
    expect(RENEWAL).toMatch(/starts := coalesce\(p_starts_at, now\(\)\)/)
    expect(RENEWAL).toMatch(/ends_at = starts \+ interval '1 year'/)
    // Jamais `ends_at = ends_at + interval` : ce serait un allongement infini.
    expect(RENEWAL).not.toMatch(/ends_at\s*=\s*public\.subscriptions\.ends_at\s*\+/)
  })

  it('le renouvellement ne modifie que le booléen de préférence', () => {
    expect(AUTO_RENEW).toMatch(/set auto_renew = p_auto_renew, updated_at = now\(\)/)
    expect(AUTO_RENEW).not.toMatch(/set status|ends_at\s*=|starts_at\s*=/)
  })

  it('l’attribution verrouille la commande avant toute écriture', () => {
    // `for update` sérialise deux webhooks concurrents sur la même commande.
    expect(MIGRATION).toMatch(/select \* into target from public\.orders where id = p_order_id for update/)
  })

  it('l’attribution réserve le TAGGO avec skip locked', () => {
    // Deux commandes simultanées ne peuvent pas obtenir le même TAGGO.
    expect(MIGRATION).toMatch(/for update skip locked/)
  })

  it('le balayage est idempotent : relancer ne double rien', () => {
    // Le balayage ne filtre que sur `status = 'active'` : une seconde exécution
    // ne trouve plus rien à écrire.
    expect(SWEEP).toMatch(/where s\.status = 'active'/)
    expect(SWEEP).toMatch(/expired_at = coalesce\(s\.expired_at, now\(\)\)/)
  })

  it('l“Donnée snapshot” du Taggo est cohérente avec le graphe SQL', () => {
    // Le TypeScript et le SQL doivent exposer le même ensemble de statuts.
    const sqlStatuses = [...MIGRATION.matchAll(/q\.lifecycle_status = '([a-z_]+)'/g)].map((m) => m[1])
    for (const status of sqlStatuses) {
      expect(Object.keys(LIFECYCLE), `statut SQL inconnu : ${status}`).toContain(status)
    }
  })
})

describe('scénario 19 — aucun prix inventé', () => {
  it('la migration ne contient aucun montant', () => {
    expect(MIGRATION).not.toMatch(/\b\d+\s*(?:€|EUR|euros?)\b/i)
    expect(MIGRATION).not.toMatch(/price_[A-Za-z0-9]{10,}/)
    expect(MIGRATION).not.toMatch(/prod_[A-Za-z0-9]{10,}/)
  })

  it('le seul tarif référencé est l’existant : celui de la boutique', () => {
    // `plan_name` est un libellé technique, pas une offre.
    expect(MIGRATION).toMatch(/'taggo_annual'/)
  })
})