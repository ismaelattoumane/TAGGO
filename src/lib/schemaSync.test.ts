import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * F5 — `supabase/schema.sql` ne doit plus diverger des migrations.
 *
 * ORIGINE : `supabase/schema.sql` était un fichier écrit à la main. À l'audit
 * de l'étape 13.1, il s'était arrêté aux étapes 5 à 7 : ni catalogue, ni
 * paiements, ni scans, ni abonnements, ni durcissement. Il décrivait donc un
 * projet qui n'existait pas — et, pire, il décrivait encore des policies
 * supprimées ("Public can view active QR codes"), donc un lecteur pouvait en
 * déduire que l'anonyme lisait `qr_codes`.
 *
 * `supabase/schema.sql` est désormais un INSTANTANÉ GÉNÉRÉ. Ce test est le
 * garde-fou : il tourne dans `npm run test`, sans Docker ni base de données,
 * et vérifie que tout objet créé par une migration figure bien dans
 * l'instantané.
 *
 * Il ne remplace PAS `scripts/db-schema.sh check` (qui compare le fichier à la
 * sortie réelle de `pg_dump`, privilèges et définitions de fonction compris).
 * Il attrape le cas le plus fréquent — « une migration a été ajoutée, l've
 * instantané n'a pas été régénéré » — au moment du `npm run test`, donc avant
 * la livraison, et non au moment du déploiement.
 *
 * SENS UNIDIRECTIONNEL, ET C'EST DÉLIBÉRÉ : on vérifie que les migrations sont
 * dans l'instantané, pas l'inverse. Un objet supplémentaire dans l'instantané
 * serait un défaut nettement moins probable et beaucoup moins grave ; surtout,
 * l'inverse rendrait ce test dépendant de tout ce que PostgreSQL crée
 * lui-même dans `public`.
 */

const ROOT = process.cwd()
const MIGRATIONS_DIR = resolve(ROOT, 'supabase/migrations')
const SCHEMA_FILE = resolve(ROOT, 'supabase/schema.sql')
const SCRIPT_FILE = resolve(ROOT, 'scripts/db-schema.sh')

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => join(MIGRATIONS_DIR, file))
}

/** Code exécutable uniquement : les commentaires citent souvent la syntaxe. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n')
}

function allMigrationCode(): string {
  return migrationFiles().map(codeOf).join('\n')
}

/**
 * La migration d'origine du nom d'objet : indispensable pour que le message
 * d'échec dise QUELLE migration n'est pas représentée, et pas seulement
 * « un objet manque ».
 */
function originatingMigration(pattern: RegExp): Map<string, string> {
  const found = new Map<string, string>()
  for (const file of migrationFiles()) {
    for (const match of codeOf(file).matchAll(pattern)) {
      const key = match[1]!
      if (!found.has(key)) found.set(key, file.split('/').pop()!)
    }
  }
  return found
}

/**
 * Policies VIVANTES après toutes les migrations, avec la migration qui les a
 * créées.
 *
 * Le suivi des `drop policy` est indispensable : une policy supprimée en étape
 * 13.1 (`Public can view active QR codes`, qui exposait `owner_id` à l'anonyme)
 * est encore écrite dans la migration de l'étape 12. Sans ce suivi, ce test
 * exigerait sa présence dans l'instantané — c'est-à-dire qu'il finirait par
 * interdire de corriger la faille qu'il est censé couvrir.
 */
function livePolicies(): Map<string, string> {
  const live = new Map<string, string>()
  // Les deux motifs sont traités DANS L'ORDRE DU TEXTE, et non en deux passes.
  // Les migrations suivent le motif `drop policy if exists … ; create policy …` :
  // deux passes donneraient « créer tout, puis tout supprimer » et l'inventaire
  // sortirait vide.
  const statement = /(?<verb>create|drop)\s+policy\s+(?:if\s+exists\s+)?"?([^"\n]+?)"?\s+on\s+(public\.\w+)/gi
  for (const file of migrationFiles()) {
    const code = codeOf(file)
    const name = file.split('/').pop()!
    for (const match of code.matchAll(statement)) {
      const key = `${match[3]}|${match[2]}`
      if (match.groups!.verb!.toLowerCase() === 'create') live.set(key, name)
      else live.delete(key)
    }
  }
  return live
}

const schema = readFileSync(SCHEMA_FILE, 'utf8')

describe('F5 — instantané du schéma synchronisé avec les migrations', () => {
  it('supabase/schema.sql existe et se déclare généré', () => {
    expect(existsSync(SCHEMA_FILE)).toBe(true)
    // Sans cet en-tête, une retouche manuelle passerait inaperçue et l'instantané
    // redeviendrait une source de vérité concurrente des migrations.
    expect(schema).toContain('FICHIER GÉNÉRÉ, NE PAS ÉDITER À LA MAIN')
    expect(schema).toContain('scripts/db-schema.sh dump')
  })

  it('le script de génération et de vérification existe et couvre dump/check/replay', () => {
    expect(existsSync(SCRIPT_FILE)).toBe(true)
    const script = readFileSync(SCRIPT_FILE, 'utf8')
    expect(script).toMatch(/command_dump\(\)/)
    expect(script).toMatch(/command_check\(\)/)
    expect(script).toMatch(/command_replay\(\)/)
    // La source de vérité doit être écrite dans l'outil, pas seulement dans les
    // commentaires d'un document.
    expect(script).toMatch(/MIGRATIONS_DIR|SOURCE DE VÉRITÉ/)
  })

  it('l’instantané contient toutes les tables créées par les migrations', () => {
    const tables = originatingMigration(/create\s+table\s+(?:if\s+not\s+exists\s+)?(public\.\w+)/gi)
    expect(tables.size).toBeGreaterThan(0)

    const missing = [...tables].filter(([name]) => !schema.includes(`CREATE TABLE ${name} (`))
    expect(missing, missing.map(([name, file]) => `${name} (${file})`).join('\n')).toEqual([])
  })

  it('l’instantané contient toutes les vues créées par les migrations', () => {
    const views = originatingMigration(/create\s+(?:or\s+replace\s+)?view\s+(public\.\w+)/gi)
    expect(views.size).toBeGreaterThan(0)

    const missing = [...views].filter(([name]) => !schema.includes(`CREATE VIEW ${name} AS`))
    expect(missing, missing.map(([name, file]) => `${name} (${file})`).join('\n')).toEqual([])
  })

  it('l’instantané contient toutes les fonctions créées par les migrations', () => {
    // Comparaison par NOM : pg_dump réécrit la signature avec les types
    // qualifiés (`qr_id uuid`) alors que la migration la déclare (`uuid`). Seule
    // l'identité de la fonction est stable entre les deux écritures.
    // `CREATE FUNCTION` et `CREATE OR REPLACE FUNCTION` sont tous deux acceptés :
    // pg_dump choisit le premier pour une fonction qu'il n'a pas remplacée, le
    // second pour une fonction redefine par une migration ultérieure.
    const functions = originatingMigration(/create\s+(?:or\s+replace\s+)?function\s+(public\.\w+)\s*\(/gi)
    expect(functions.size).toBeGreaterThan(0)

    const missing = [...functions].filter(
      ([name]) => !new RegExp(`CREATE (?:OR REPLACE )?FUNCTION ${name}\\(`).test(schema),
    )
    expect(missing, missing.map(([name, file]) => `${name} (${file})`).join('\n')).toEqual([])
  })

  it('l’instantané contient toutes les policies RLS vivantes, et seulement celles-là', () => {
    const policies = livePolicies()
    expect(policies.size).toBeGreaterThan(0)

    const missing = [...policies].filter(([key]) => {
      const [table, name] = key.split('|')
      return !new RegExp(`CREATE POLICY "${name}" ON ${table}\\b`).test(schema)
    })
    expect(missing, missing.map(([key, file]) => `${key} (${file})`).join('\n')).toEqual([])

    // Contre-test : la policy retirée en étape 13.1 ne doit surtout pas être
    // dans l'instantané. C'est elle qui rendait `owner_id` lisible par l'anonyme.
    expect(schema).not.toContain('Public can view active QR codes')
  })

  it('l’instantané contient les triggers posés sur les tables applicatives', () => {
    // La table est capturée jusqu'à `for each row` : sans cette borne, le
    // `public.` de `execute function public.handle_new_user()` serait pris pour
    // un nom de table, et le trigger de plateforme — posé sur `auth.users`, donc
    // hors du périmètre d'un dump de `public` — serait signalé à tort.
    const triggers = new Map<string, string>()
    for (const file of migrationFiles()) {
      const code = codeOf(file)
      for (const match of code.matchAll(
        /create\s+trigger\s+(\w+)[\s\S]{0,300}?\bon\s+((?:public|auth)\.\w+)[\s\S]{0,60}?\bfor\s+each\s+row/gi,
      )) {
        if (!match[2]!.startsWith('public.')) continue
        triggers.set(`${match[2]}|${match[1]}`, file.split('/').pop()!)
      }
    }
    expect(triggers.size).toBeGreaterThan(0)

    const missing = [...triggers].filter(([key]) => {
      const [, name] = key.split('|')
      return !new RegExp(`CREATE TRIGGER ${name}\\b`).test(schema)
    })
    expect(missing, missing.map(([key, file]) => `${key} (${file})`).join('\n')).toEqual([])

    // `pg_dump --schema=public` omits triggers attached to Supabase-owned
    // auth.users, so the schema generator appends these application triggers.
    expect(schema).toMatch(/CREATE TRIGGER on_auth_user_created[\s\S]*?public\.handle_new_user\(\)/)
    expect(schema).toMatch(/CREATE TRIGGER trg_sync_auth_email_to_profile[\s\S]*?public\.sync_profile_email_from_auth\(\)/)
  })

  it('l’instantané conserve les privilèges, qui sont la barrière de sécurité', () => {
    // C'est l'absence de `REVOKE` qui avait permis à `anon` d'écrire dans
    // `qr_codes` via la vue publique. Un instantané sans ACL perdrait cette
    // information, alors qu'elle est au moins aussi importante que les policies.
    expect(schema).toMatch(/REVOKE ALL ON FUNCTION public\.protect_qr_codes_server_fields\(\) FROM PUBLIC;/)
    expect(schema).toMatch(/GRANT\s+SELECT ON TABLE public\.public_taggo_cards TO anon;/)
    expect(schema).toMatch(/GRANT UPDATE\(title\) ON TABLE public\.qr_codes TO authenticated;/)
    // Et surtout : l'anonyme ne doit pas pouvoir écrire dans la vue publique.
    const viewGrants = schema.match(/GRANT[^;]*ON TABLE public\.public_taggo_cards TO anon;/g) ?? []
    expect(viewGrants).toHaveLength(1)
    expect(viewGrants[0]).toMatch(/GRANT SELECT /)
  })

  it('les régressions de l’étape 13.1 sont visibles dans l’instantané', () => {
    // Si une de ces vérifications échoue, c'est que l'instantané a été régénéré
    // à partir d'une base qui n'a pas les migrations de l'étape 13.1.
    expect(allMigrationCode()).toMatch(/revoke execute on function public\.assign_taggo_to_user\(uuid\) from public, anon, authenticated;/)
    // pg_dump qualifie la signature : `public.assign_taggo_to_user(p_qr_id uuid)`.
    expect(schema).toMatch(/REVOKE ALL ON FUNCTION public\.assign_taggo_to_user\([^)]*uuid\) FROM PUBLIC;/)
    expect(schema).toMatch(/CREATE VIEW public\.public_taggo_cards AS/)
    expect(schema).toMatch(/GRANT UPDATE\(status\) ON TABLE public\.orders TO authenticated;/)
  })
})