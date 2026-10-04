import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ÉTAPE 12 — Audit du contrat SQL des abonnements TAGGO.
 *
 * Ces tests ne remplacent pas une migration réellement exécutée : ils vérifient
 * que le SQL versionné DIT ce que le modèle commercial exige. Ils protègent
 * contre les régressions silencieuses les plus coûteuses :
 *
 *   - un propriétaire pourrait écrire `status`, `ends_at` ou `stripe_*` ;
 *   - un TAGGO expiré pourrait être réactivé sans renouvellement confirmé ;
 *   - une commande non payée pourrait ouvrir une période incluse ;
 *   - un webhook rejoué pourrait allonger deux fois la même période.
 */

const root = process.cwd()

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

const MIGRATION = 'supabase/migrations/20260931100000_taggo_subscriptions.sql'
const migration = read(MIGRATION)

describe('audit SQL — modèle d’abonnement', () => {
  it('réutilise la table existante au lieu d’en créer une seconde', () => {
    expect(migration).toMatch(/alter table public\.subscriptions/)
    // Aucune nouvelle table d'ABONNEMENT opérationnelle : un deuxième système
    // serait exactement ce que l'étape interdit.
    //
    // Seule exception tolérée : `subscriptions_unattached_archive`, qui n'est pas
    // une table d'abonnement mais l'ARCHIVE des lignes historiques non
    // rattachables (§ 1a). Elle n'est lisible que par service_role et n'est
    // jamais écrite par le code applicatif. Toute autre table d'abonnement
    // échoue ce test.
    const created = [...migration.matchAll(/create table (?:if not exists )?(public\.\w*)/g)].map((m) => m[1])
    expect(created).toEqual(['public.subscriptions_unattached_archive'])
  })

  it('n’écrit ends_at qu’à partir d’une année calendaire', () => {
    // Toute durée écrite dans la migration doit être UNE année calendaire.
    // `ends_at` n'est écrit que dans deux fonctions (période incluse et
    // renouvellement) et toujours via `starts + interval '1 year'`. Une écriture
    // dérivée d'une autre durée — typiquement « 365 jours » — échoue ici.
    const durations = [...migration.matchAll(/\+\s*interval '([^']+)'/g)].map((m) => m[1])
    expect(durations.length).toBeGreaterThan(0)
    for (const duration of durations) {
      expect(duration).toBe('1 year')
    }

    // Les sites d'écriture/calcul de `ends_at` (valeur incluse, valeur
    // renouvellement, mise à jour en cas de conflit, valeur renvoyée au
    // client) utilisent tous la même expression. Les commentaires sont exclus :
    // ils citent l'expression pour l'expliquer, ils ne l'appliquent pas.
    const sqlCode = migration
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
    const writeSites = [...sqlCode.matchAll(/starts \+ interval '1 year'/g)]
    expect(writeSites.length).toBe(4)

    // Aucun nombre de jours ne doit apparaître dans le CODE : une période est
    // une année calendaire, pas un nombre de jours. Les commentaires, eux,
    // expliquent précisément pourquoi « 365 jours » serait faux — ils doivent
    // donc pouvoir citer ce nombre.
    expect(sqlCode).not.toMatch(/interval '\d+ (day|days)'/i)
    expect(sqlCode).not.toMatch(/\b365\b/)
  })

  it('rattache la période au TAGGO et le rend unique', () => {
    expect(migration).toMatch(/add column if not exists qr_code_id uuid references public\.qr_codes\(id\) on delete cascade/)
    expect(migration).toMatch(/alter column qr_code_id set not null/)
    expect(migration).toMatch(/create unique index if not exists idx_subscriptions_qr_code_unique\s+on public\.subscriptions \(qr_code_id\)/)
  })

  it('ne détruit aucune donnée historique de subscriptions', () => {
    // Les lignes sans TAGGO rattachable sont MIS EN ARCHIVE, jamais supprimées
    // silencieusement. Un `delete` est toléré uniquement s'il est borné par la
    // présence de la ligne dans la table d'archive (donc réversible) et
    // accompagné du `insert ... select` de copie qui précède.
    expect(migration).toMatch(/insert into public\.subscriptions_unattached_archive/)

    const deletes = [...migration.matchAll(/delete from public\.subscriptions\b[\s\S]*?;/g)].map((m) => m[0])
    expect(deletes.length).toBeGreaterThan(0)
    for (const statement of deletes) {
      // borné à « qr_code_id is null » : jamais un delete large ou sans condition
      expect(statement).toMatch(/qr_code_id is null/)
      // et seulement si la ligne a DÉJÀ été copiée en archive (réversibilité)
      expect(statement).toMatch(/subscriptions_unattached_archive/)
    }

    // Aucun delete global ni suppression de colonne métier.
    expect(migration).not.toMatch(/delete from public\.subscriptions;\s*$/)
    expect(migration).not.toMatch(/drop column/i)
    expect(migration).not.toMatch(/truncate/i)
  })

  it('ne stocke que deux statuts, tous deux ayant un écrivain', () => {
    expect(migration).toMatch(/check \(status in \('active', 'expired'\)\)/)
    // `pending`, `cancelled` et `trial` seraient des statuts sans écrivain.
    expect(migration).not.toMatch(/check \(status in \([^)]*'(pending|cancelled|trial)'/)
  })

  it('ne crée aucun statut d’affichage stocké', () => {
    // « expire bientôt » est dérivé de ends_at côté client, jamais écrit en base.
    // Seule la contrainte de statut compte : les commentaires citent le mot.
    const statusConstraints = [...migration.matchAll(/check \(status in \([^)]*\)\)/g)].map((m) => m[0])
    for (const constraint of statusConstraints) {
      expect(constraint).not.toMatch(/expiring/)
    }
  })

  it('fixe la première année incluse à un an, sans paramètre commercial', () => {
    expect(migration).toMatch(/interval '1 year'/)
    // Aucune durée autre qu'un an ne doit apparaître.
    const durations = [...migration.matchAll(/interval '(\d+) (\w+)'/g)].map((m) => `${m[1]} ${m[2]}`)
    for (const duration of durations) {
      expect(['1 year', '7 days', '1 day', '30 days'], `durée inattendue : ${duration}`).toContain(duration)
    }
  })

  it('n’introduit aucun montant, aucune devise et aucun Price ID', () => {
    // Pas de prix, pas de frequency inventée : le tarif est À DÉCIDER.
    expect(migration).not.toMatch(/price_[A-Za-z0-9]{10,}/)
    expect(migration).not.toMatch(/prod_[A-Za-z0-9]{10,}/)
    expect(migration).not.toMatch(/\b\d+\s*(?:€|euros?)\b/i)
  })
})

describe('audit SQL — première année incluse', () => {
  it('ouvre la période depuis une attribution de commande payée', () => {
    expect(migration).toMatch(/create or replace function public\.reserve_taggos_for_paid_order\(p_order_id uuid, p_quantity integer\)/)
    expect(migration).toMatch(/if target\.status <> 'paid' then\s+raise exception 'order_not_paid'/)
    expect(migration).toMatch(/perform public\.grant_included_taggo_period\(selected_qr\.id, included_starts\)/)
  })

  it('rattache le début de période au paiement confirmé, pas au checkout', () => {
    expect(migration).toMatch(/included_starts := coalesce\(target\.paid_at, now\(\)\)/)
  })

  it('ouvre aussi la période sur le chemin de rejeu du webhook', () => {
    expect(migration).toMatch(/foreach index in array assigned_ids loop\s+perform public\.grant_included_taggo_period\(index, included_starts\)/)
  })

  it('rend l’ouverture idempotente — un rejeu n’allonge pas la période', () => {
    expect(migration).toMatch(/on conflict \(qr_code_id\) do nothing/)
  })

  it('n’invente aucune période pour un TAGGO sans propriétaire', () => {
    expect(migration).toMatch(/if owner is null then\s+return false/)
  })
})

describe('audit SQL — expiration', () => {
  it('n’écrit jamais l’expiration depuis le client', () => {
    expect(migration).toMatch(/revoke execute on function public\.expire_due_taggo_subscriptions\(\) from public, anon, authenticated/)
    expect(migration).toMatch(/grant execute on function public\.expire_due_taggo_subscriptions\(\) to service_role/)
  })

  it('balaye uniquement les périodes déjà échues', () => {
    expect(migration).toMatch(/where s\.status = 'active'\s+and s\.ends_at is not null\s+and s\.ends_at <= now\(\)/)
  })

  it('fait dépendre la lecture publique d’un prédicat de validité', () => {
    expect(migration).toMatch(/create or replace function public\.taggo_subscription_allows_public\(p_qr_id uuid\)/)
    // Le prédicat DOIT rester appelable par anon/authenticated : il est évalué
    // dans les politiques RLS. Sans cela, aucune expiration ne s'appliquerait.
    expect(migration).toMatch(
      /grant execute on function public\.taggo_subscription_allows_public\(uuid\) to anon, authenticated, service_role/,
    )
  })

  it('applique le prédicat aux deux politiques de lecture publique', () => {
    const publicQrPolicy = migration.slice(
      migration.indexOf('create policy "Public can view active QR codes"'),
      migration.indexOf('create policy "Public can view public QR profile data"'),
    )
    expect(publicQrPolicy).toMatch(/public\.taggo_subscription_allows_public\(id\)/)

    const publicProfilePolicy = migration.slice(
      migration.indexOf('create policy "Public can view public QR profile data"'),
    )
    expect(publicProfilePolicy).toMatch(/public\.taggo_subscription_allows_public\(q\.id\)/)
  })

  it('n’introduit aucun cron ni aucune dépendance à une tâche planifiée', () => {
    // L'expiration ne doit dépendre d'aucune infrastructure absente.
    expect(migration).not.toMatch(/pg_cron|cron\.schedule|net\.http_post/)
  })

  it('déclenche le balayage à la lecture publique et à la lecture propriétaire', () => {
    expect(migration).toMatch(/perform public\.expire_due_taggo_subscriptions\(\)/)
    expect(migration).toMatch(/sweep := public\.expire_due_taggo_subscriptions\(\)/)
  })
})

describe('audit SQL — réactivation', () => {
  it('interdit toute réactivation sans abonnement valide', () => {
    // Test central de l'étape : un renouvellement non confirmé ne réactive rien.
    expect(migration).toMatch(/create or replace function public\.reactivate_taggo_subscription\(/)
    expect(migration).toMatch(/if not exists \(\s+select 1 from public\.subscriptions s\s+where s\.qr_code_id = p_qr_id\s+and s\.status = 'active'\s+and s\.ends_at is not null\s+and s\.ends_at > now\(\)\s+\) then\s+return jsonb_build_object\('ok', false, 'reason', 'no_valid_subscription'\)/)
  })

  it('revérifie l’appartenance du TAGGO en base', () => {
    expect(migration).toMatch(/where q\.id = p_qr_id and q\.owner_id = p_owner_id/)
  })

  it('respecte le graphe de transitions existant', () => {
    expect(migration).toMatch(/q\.lifecycle_status in \('expired', 'suspended', 'inactive'\)/)
  })

  it('refuse toute réactivation depuis le client', () => {
    expect(migration).toMatch(
      /revoke execute on function public\.reactivate_taggo_subscription\(uuid, uuid\) from public, anon, authenticated/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.reactivate_taggo_subscription\(uuid, uuid\) to service_role/,
    )
  })

  it('ferme le contournement par transition_taggo', () => {
    // transition_taggo est accordée à `authenticated`. Sans garde-fou, un
    // propriétaire pourrait réactiver son TAGGO expiré par une simple requête.
    expect(migration).toMatch(
      /if p_target_status = 'active' and not public\.taggo_subscription_allows_public\(p_qr_id\) then\s+return null/,
    )
  })
})

describe('audit SQL — renouvellement', () => {
  it('rejette un propriétaire qui ne possède pas le TAGGO', () => {
    expect(migration).toMatch(/create or replace function public\.renew_taggo_subscription\(/)
    expect(migration).toMatch(/return jsonb_build_object\('ok', false, 'reason', 'not_owner'\)/)
  })

  it('ne peut pas allonger deux fois la même période', () => {
    // Une seule ligne par TAGGO, et la fin est recalculée depuis un début fourni
    // par le serveur — jamais depuis la fin précédente.
    expect(migration).toMatch(/on conflict \(qr_code_id\) do update\s+set status = 'active'/)
    expect(migration).toMatch(/ends_at = starts \+ interval '1 year'/)
  })

  it('n’expose ni le renouvellement ni la préférence au client', () => {
    expect(migration).toMatch(
      /revoke execute on function public\.renew_taggo_subscription\([^)]*\) from public, anon, authenticated/,
    )
    expect(migration).toMatch(
      /revoke execute on function public\.set_taggo_auto_renew\([^)]*\) from public, anon, authenticated/,
    )
  })

  it('ne modifie que le booléen de préférence', () => {
    expect(migration).toMatch(/set auto_renew = p_auto_renew, updated_at = now\(\)/)
  })
})

describe('audit SQL — RLS et sécurité', () => {
  it('autorise le propriétaire à lire son abonnement', () => {
    expect(migration).toMatch(/create policy "Users can view their own subscriptions" on public\.subscriptions\s+for select using \(auth\.uid\(\) = user_id\)/)
  })

  it('interdit toute écriture client sur la table', () => {
    expect(migration).toMatch(/revoke insert, update, delete on public\.subscriptions from authenticated/)
    expect(migration).not.toMatch(/create policy[\s\S]*?on public\.subscriptions\s+for (insert|update|delete)/)
  })

  it('ne retire pas la lecture au client authentifié', () => {
    expect(migration).toMatch(/grant select on public\.subscriptions to authenticated/)
  })

  it('n’accorde l’écriture de la période qu’au service_role', () => {
    for (const fn of [
      'grant_included_taggo_period',
      'renew_taggo_subscription',
      'set_taggo_auto_renew',
      'get_taggo_subscription_status',
    ]) {
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`),
      )
    }
  })

  it('ne stocke aucune donnée de carte bancaire ni donnée personnelle nouvelle', () => {
    const subscriptionsBlock = migration.slice(
      migration.indexOf('alter table public.subscriptions\n  add column if not exists qr_code_id'),
      migration.indexOf('-- Index du balayage'),
    )

    for (const forbidden of [
      'card',
      'cvc',
      'cvv',
      'iban',
      'pan',
      'billing_details',
      'email',
      'first_name',
      'last_name',
      'address',
      'phone',
    ]) {
      expect(subscriptionsBlock, `colonne ${forbidden} interdite`).not.toMatch(
        new RegExp(`add column[^;]*\\b${forbidden}\\b`, 'i'),
      )
    }
  })

  it('ne conserve que des identifiants Stripe-if, sans donnée de paiement', () => {
    // Trois colonnes stripe_* : ce sont des RÉFÉRENCES techniques, fournies par
    // le serveur. Aucune donnée de carte n'est présente.
    const stripeColumns = [...migration.matchAll(/add column if not exists (stripe_\w+)/g)].map((m) => m[1])
    expect(stripeColumns.sort()).toEqual(['stripe_customer_id', 'stripe_price_id', 'stripe_subscription_id'])
  })
})

describe('audit SQL — cycle de vie préservé', () => {
  it('ne recrée aucun second système de statut TAGGO', () => {
    expect(migration).not.toMatch(/create type .* as enum/i)
    expect(migration).not.toMatch(/add constraint qr_codes_lifecycle_status_check/)
    expect(migration).not.toMatch(/lifecycle_status = '[a-z_]+'::/)
  })

  it('n’altère la contrainte de cycle de vie existante', () => {
    // Les 10 valeurs existantes restent valides : aucune n'est retirée.
    expect(migration).not.toMatch(/drop constraint if exists qr_codes_lifecycle_status_check/)
  })

  it('conserve la transition active → expired du graphe existant', () => {
    expect(migration).toMatch(/set lifecycle_status = 'expired',\s+status = 'inactive'/)
    // Seuls les TAGGO actifs sont concernés : les autres n'ont pas de page
    // publique, et le graphe interdit de les passer directement à `expired`.
    expect(migration).toMatch(/and q\.lifecycle_status = 'active'/)
  })

  it('ne touche ni aux commandes, ni aux articles, ni aux affectations', () => {
    expect(migration).not.toMatch(/alter table public\.orders/)
    expect(migration).not.toMatch(/alter table public\.order_items/)
    expect(migration).not.toMatch(/alter table public\.taggo_assignments/)
  })
})

describe('audit SQL — emails d’abonnement', () => {
  it('déclare les trois événements sans en câbler le déclenchement', () => {
    expect(migration).toMatch(/'SUBSCRIPTION_EXPIRING'/)
    expect(migration).toMatch(/'SUBSCRIPTION_EXPIRED'/)
    expect(migration).toMatch(/'SUBSCRIPTION_RENEWED'/)
    // Aucun envoi automatique : pas de job planifié, donc pas d'email.
    expect(migration).not.toMatch(/insert into public\.email_events/)
  })

  it('conserve les sept types d’email existants', () => {
    for (const type of [
      'ORDER_CONFIRMED',
      'ORDER_SHIPPED',
      'ORDER_DELIVERED',
      'REVIEW_REQUEST',
      'CART_ABANDONED',
      'WELCOME',
      'PASSWORD_RESET',
    ]) {
      expect(migration).toMatch(new RegExp(`'${type}'`))
    }
  })
})

describe('audit SQL — continuité des étapes précédentes', () => {
  it('conserve les politiques RLS propriétaire des TAGGO', () => {
    expect(migration).not.toMatch(/drop policy if exists "Owners can view their own QR codes"/)
    expect(migration).not.toMatch(/drop policy if exists "Owners can update their QR codes"/)
    expect(migration).not.toMatch(/drop policy if exists "Owners can insert their QR codes"/)
    expect(migration).not.toMatch(/drop policy if exists "Owners can delete their QR codes"/)
  })

  it('conserve la politique de commande payée', () => {
    expect(migration).not.toMatch(/drop policy if exists "Customers can update their own orders"/)
  })

  it('conserve le comptage des scans et son réglage', () => {
    expect(migration).toMatch(/create or replace function public\.record_taggo_scan\(\s+p_public_id text\s+\)/)
    expect(migration).toMatch(/select coalesce\(max\(s\.min_interval_seconds\), 30\)/)
  })

  it('conserve la journalisation des emails', () => {
    expect(migration).not.toMatch(/drop table public\.email_events/)
    expect(migration).not.toMatch(/alter table public\.email_events drop column/)
  })
})

describe('audit SQL — order des migrations', () => {
  it('s’applique après les scans et après les paiements', () => {
    const own = MIGRATION.split('/').pop() as string
    expect(own > '20260931000000_taggo_scans.sql').toBe(true)
    expect(own > '20260930100000_email_events.sql').toBe(true)
    expect(own > '20260930000000_stripe_payments.sql').toBe(true)
  })

  it('n’est redéfinie par aucune migration ultérieure', () => {
    // Intention d'origine : la migration des abonnements ne doit pas être
    // « shadowée » — c'est-à-dire qu'aucun fichier.versionné plus tard ne doit
    // redéfinir une de ses fonctions, sous peine que le graphe appliqué ne soit
    // plus celui qui a été audité. Une migration de durcissement peut donc bien
    // être ajoutée APRÈS, à condition de ne redefinir aucun de ces RPC.
    //
    // EXCEPTION DÉCLARÉE, ET UNIQUEMENT CELLE-LÀ :
    // `20260931130000_taggo_hardening_followup.sql` recrée
    // `reserve_taggos_for_paid_order`, parce que son chemin de rejeu de webhook
    // était cassé (`foreach` sur un `uuid[]` avec une variable `integer` : voir
    // le défaut expliqué en tête de cette migration). Sans cette correction, la
    // garantie d'idempotence annoncée par l'étape 12 n'était pas tenue.
    //
    // L'exception reste dans le test, et non dans la nature du test : une
    // migration future qui redéfinirait une autre fonction de l'étape 12
    // échouerait toujours. `expect(Object.keys(...))` interdit en outre qu'on
    //transforme l'exception en passe-partout en ajoutant un fichier à la liste.
    const { readdirSync } = require('node:fs') as typeof import('node:fs')
    const dir = join(root, 'supabase/migrations')
    const files = readdirSync(dir).filter((file) => file.endsWith('.sql')).sort()
    const own = MIGRATION.split('/').pop() as string
    const later = files.slice(files.indexOf(own) + 1)
    expect(later.length).toBeGreaterThan(0)

    const justifiedShadows: Record<string, string[]> = {
      '20260931130000_taggo_hardening_followup.sql': ['reserve_taggos_for_paid_order'],
      '20260931141000_step141_security_corrections.sql': ['get_public_taggo_state'],
    }
    expect(Object.keys(justifiedShadows)).toEqual([
      '20260931130000_taggo_hardening_followup.sql',
      '20260931141000_step141_security_corrections.sql',
    ])

    const defined = [...migration.matchAll(/create or replace function public\.(\w+)/g)].map((m) => m[1])
    expect(defined.length).toBeGreaterThan(0)

    for (const file of later) {
      const content = read(join(dir, file))
      const allowed = justifiedShadows[file] ?? []
      for (const fn of defined) {
        if (!content.includes(`create or replace function public.${fn}`)) continue
        // Redéfinition effective : elle n'est admise que si elle est listée
        // comme justifiée ci-dessus. Toute autre redéfinition échoue, et le
        // message nomme la fonction ET le fichier fautif.
        expect(
          allowed,
          `${file} redéfinit public.${fn} sans justification : ce qui ombrage ${own}`,
        ).toContain(fn)
      }
    }
  })
})
describe('audit SQL — record_taggo_scan (garanties de l’étape 11 préservées)', () => {
  /** Corps de la fonction, hors commentaires, pour un audit structurel. */
  const scanBody = (() => {
    const start = migration.indexOf('create or replace function public.record_taggo_scan')
    const open = migration.indexOf('as $$', start) + 'as $$'.length
    const close = migration.indexOf('$$;', open)
    return migration
      .slice(open, close)
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
  })()

  /** Index de chaque garantie, dans le code (hors commentaires). */
  const at = {
    emptyInput: scanBody.indexOf("nullif(trim(coalesce(p_public_id, '')), '') is null"),
    resolution: scanBody.indexOf('select * into target'),
    subscriptionCheck: scanBody.indexOf('taggo_subscription_allows_public(target.id)'),
    notFoundBranch: scanBody.indexOf('if not found then'),
    antiAbus: scanBody.indexOf('from public.taggo_scans sc'),
    insert: scanBody.indexOf('insert into public.taggo_scans'),
  }

  it('conserve la résolution serveur du code public, sans modification', () => {
    // Étape 11 : seul un TAGGO public, actif et destiné est retenu.
    expect(scanBody).toMatch(/q\.public_id = upper\(trim\(p_public_id\)\)/)
    expect(scanBody).toMatch(/q\.status = 'active'/)
    expect(scanBody).toMatch(/q\.is_public = true/)
    expect(scanBody).toMatch(/q\.destination_url is not null/)
  })

  it('place le contrôle d’abonnement APRÈS la résolution et AVANT la fenêtre anti-abus', () => {
    expect(at.subscriptionCheck).toBeGreaterThan(at.resolution)
    expect(at.subscriptionCheck).toBeLessThan(at.antiAbus)
  })

  it('ne consume pas la fenêtre anti-abus quand le scan est refusé', () => {
    // Le refus doit avoir lieu avant la lecture de `taggo_scans` : sinon un TAGGO
    // bloqué « consommerait » son quota et un scan légitime ultérieur serait
    // rejeté en `duplicate` sans raison.
    expect(at.subscriptionCheck).toBeLessThan(at.antiAbus)
  })

  it('renvoie not_active pour une période échue ET pour une période absente', () => {
    // Le prédicat couvre les deux cas d'un seul coup, donc une seule sortie.
    const refusals = [...scanBody.matchAll(/return 'not_active'/g)]
    expect(refusals.length).toBeGreaterThanOrEqual(1)
    // Le refus est conditionné au prédicat, pas seulement à `not found`.
    expect(scanBody).toMatch(
      /if found and not public\.taggo_subscription_allows_public\(target\.id\) then\s+return 'not_active';/,
    )
  })

  it('conserve la distinction not_found / not_active de l’étape 11', () => {
    expect(scanBody).toMatch(/if not found then\s+return case[\s\S]*?then 'not_active'\s+else 'not_found'/)
  })

  it('conserve la fenêtre anti-abus temporelle par TAGGO', () => {
    expect(scanBody).toMatch(/select coalesce\(max\(s\.min_interval_seconds\), 30\)/)
    expect(scanBody).toMatch(/sc\.scanned_at > now\(\) - make_interval\(secs => min_interval\)/)
    expect(scanBody).toMatch(/if latest is not null then\s+return 'duplicate';/)
  })

  it('ne stocke aucune donnée personnelle supplémentaire', () => {
    // Étape 11 : anti-abus purement temporel. L'étape 12 ne doit rien y ajouter.
    for (const forbidden of ['ip', 'user_agent', 'useragent', 'cookie', 'visitor', 'fingerprint', 'hash']) {
      expect(scanBody.toLowerCase(), `colonne ${forbidden} interdite`).not.toMatch(
        new RegExp(`insert into public\\.taggo_scans[^;]*\\b${forbidden}\\b`, 'i'),
      )
    }
    // La seule insertion reste (qr_code_id, scanned_at).
    expect(scanBody).toMatch(/insert into public\.taggo_scans \(qr_code_id, scanned_at\)/)
  })

  it('ne lit la période qu’après avoir résolu le TAGGO', () => {
    // Aucune lecture de `subscriptions` avant la résolution : un code public
    // inexistant ne doit pas provoquer de lecture de table d'abonnement.
    expect(scanBody.indexOf('public.subscriptions')).toBe(-1)
  })
})

describe('audit SQL — protection du cycle de vie contre le contournement', () => {
  const transitionBody = (() => {
    const start = migration.indexOf('create or replace function public.transition_taggo')
    const open = migration.indexOf('as $$', start) + 'as $$'.length
    const close = migration.indexOf('$$;', open)
    return migration.slice(open, close)
  })()

  it('interdit toute entrée en active sans période valide', () => {
    expect(transitionBody).toMatch(
      /if p_target_status = 'active' and not public\.taggo_subscription_allows_public\(p_qr_id\) then\s+return null;/,
    )
  })

  it('couvre toutes les transitions vers active, pas seulement expired', () => {
    // Le graphe de l'étape 5 permet expired/inactive/suspended -> active.
    // Le garde-fou est posé sur la CIBLE, donc il couvre les quatre chemins.
    expect(transitionBody).toMatch(/p_target_status = 'active'/)
    for (const from of ['expired', 'inactive', 'suspended']) {
      expect(
        transitionBody,
        `${from} -> active doit exister dans le graphe`,
      ).toMatch(new RegExp(`q\\.lifecycle_status = '${from}' and p_target_status in \\('active'`))
    }
  })

  it('laisse toujours possible la sortie de active', () => {
    // Un propriétaire doit pouvoir désactiver son TAGGO même sans abonnement.
    expect(transitionBody).toMatch(
      /q\.lifecycle_status = 'active' and p_target_status in \('inactive', 'expired', 'suspended', 'replaced'\)/,
    )
  })

  it('conserve le contrôle de propriété par auth.uid()', () => {
    expect(transitionBody).toMatch(/and q\.owner_id = auth\.uid\(\)/)
  })

  it('ne peut pas être élargi à anon par cette migration', () => {
    expect(migration).toMatch(
      /revoke execute on function public\.transition_taggo\(uuid, text\) from public, anon;\s+grant execute on function public\.transition_taggo\(uuid, text\) to authenticated;/,
    )
  })

  it('laisse une voie de service pour la réactivation après renouvellement', () => {
    // `reactivate_taggo_subscription` est service_role et RE-VÉRIFIE la période :
    // c'est la seule voie qui puisse passer un TAGGO expiré à `active`.
    expect(migration).toMatch(/revoke execute on function public\.reactivate_taggo_subscription\(uuid, uuid\) from public, anon, authenticated;/)
    expect(migration).toMatch(/s\.ends_at > now\(\)[\s\S]*?then\s+return jsonb_build_object\('ok', false, 'reason', 'no_valid_subscription'\)/)
  })
})

describe('audit SQL — archive des abonnements non rattachables', () => {
  it('copie les lignes avant de les retirer', () => {
    // L'ordre insert-then-delete est la garantie d'absence de perte.
    const insertAt = migration.indexOf('insert into public.subscriptions_unattached_archive')
    const deleteAt = migration.indexOf('delete from public.subscriptions')
    expect(insertAt).toBeGreaterThan(-1)
    expect(deleteAt).toBeGreaterThan(insertAt)
  })

  it('conserve les colonnes permettant une restauration', () => {
    for (const column of ['row_id', 'user_id', 'status', 'plan_name', 'started_at', 'ends_at']) {
      expect(migration).toMatch(new RegExp(`\\b${column}\\b`))
    }
    // La clé primaire de la table d'archive est l'ancien `id` : la restauration
    // est un simple update, pas une réinsertion à réinventer.
    expect(migration).toMatch(/row_id uuid primary key/)
  })

  it('reste invisible au client', () => {
    expect(migration).toMatch(/alter table public\.subscriptions_unattached_archive enable row level security/)
    expect(migration).toMatch(/revoke all on public\.subscriptions_unattached_archive from anon, authenticated/)
    expect(migration).not.toMatch(/create policy[^;]*on public\.subscriptions_unattached_archive/i)
  })

  it('signale le nombre de lignes archivées dans les logs', () => {
    // Un archivage doit être VISIBLE, jamais silencieux.
    expect(migration).toMatch(/raise notice/)
    expect(migration).toMatch(/subscriptions_unattached_archive/)
  })

  it('ne rattache jamais une ligne historique par supposition', () => {
    // Rattacher au hasard créerait une période active sur un TAGGO arbitraire.
    expect(migration).not.toMatch(/update public\.subscriptions\s+set qr_code_id/)
    expect(migration).not.toMatch(/qr_code_id\s*=\s*s\.user_id/)
  })
})
