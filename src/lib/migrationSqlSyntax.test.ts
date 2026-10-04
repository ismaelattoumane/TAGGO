import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Garde-fou SQL : les migrations de ce projet ne sont contrôlées ni par le
 * typecheck ni par les tests, car aucune base n'est disponible pendant
 * `npm run test`.
 *
 * Cette famille ne remplace PAS une exécution réelle sur PostgreSQL — elle ne
 * peut pas couvrir la sémantique PL/pgSQL. Elle couvre la classe d'erreur la
 * plus coûteuse et la plus silencieuse : une faute de frappe qui rend un
 * fichier de migration INAPPLICABLE, découverte au moment du déploiement.
 *
 * ORIGINE DE CE TEST : la migration `20260931000000_taggo_scans.sql` (étape 11)
 * terminait deux blocs `if` par `end;` au lieu de `end if;`. PL/pgSQL rejette
 * cela, donc le fichier entier ne s'appliquait pas — table des scans, fonction
 * d'enregistrement et RPC d'analytics compris. Le bug était invisible pour
 * tous les tests existants et pour le typecheck.
 *
 * MÉTHODE : les migrations du projet indentent de façon homogène (2 espaces par
 * niveau). On s'appuie dessus pour retrouver, devant chaque `end;`, le
 * constructeur de bloc de même indentation. C'est plus robuste qu'une
 * expression régulière sur `if ... end;`, qui confond `create extension if not
 * exists` avec un bloc `if`.
 */

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => join(MIGRATIONS_DIR, file))
}

function read(file: string): string {
  return readFileSync(file, 'utf8')
}

/** Retire les commentaires SQL pour ne travailler que sur du code exécutable. */
function codeOf(file: string): string[] {
  return read(file)
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
}

/**
 * Bloc ouvert juste au-dessus d'une ligne donnée, à la même indentation.
 * Renvoie l'indicateur du constructeur (`if`, `elsif`, `case`, `loop`,
 * `begin`) ou `null` si aucun bloc n'est trouvé — typiquement pour un `end;`
 * qui termine une expression `case` affectée à une variable.
 */
function enclosingBlockKind(lines: string[], index: number): string | null {
  const indent = lines[index]!.match(/^\s*/)![0].length

  for (let back = index - 1; back >= 0; back -= 1) {
    const line = lines[back]!
    if (!line.trim()) { continue }
    if ((line.match(/^\s*/)![0].length !== indent)) { continue }

    const opener = line.trim().match(/^(if|elsif|case|loop|begin)\b/i)
    return opener ? opener[1]!.toLowerCase() : null
  }

  return null
}

describe('migrations — syntaxe PL/pgSQL vérifiable sans base', () => {
  const files = migrationFiles()

  it('le répertoire de migrations est bien peuplé et trié', () => {
    // Sans ce test, un dossier vide ferait passer silencieusement les suivants.
    expect(files.length).toBeGreaterThan(0)
    const names = files.map((file) => file.split('/').pop()!)
    expect(names).toEqual([...names].sort())
  })

  it('aucun bloc IF n’est terminé par `end;` au lieu de `end if;`', () => {
    const offenders: string[] = []

    for (const file of files) {
      const lines = codeOf(file)
      for (const [index, line] of lines.entries()) {
        if (!/^\s*end\s*;\s*$/i.test(line)) continue

        const kind = enclosingBlockKind(lines, index)
        if (kind === 'if' || kind === 'elsif') {
          offenders.push(`${file}:${index + 1} — « end; » ferme un bloc ${kind}, il faut « end if; »`)
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('les `end;` restants sont des terminaisons de CASE ou de bloc, pas des IF', () => {
    // Contre-test du précédent : il ne faut pas « corriger » les `end;`
    // légitimes. On vérifie qu'il en existe bien, sinon la détection ci-dessus
    // ne prouverait rien.
    const bareEnds = files.flatMap((file) =>
      codeOf(file)
        .map((line, index) => ({ file, line, index }))
        .filter(({ line }) => /^\s*end\s*;\s*$/i.test(line)),
    )

    expect(bareEnds.length).toBeGreaterThan(0)
    for (const { file, index } of bareEnds) {
      const kind = enclosingBlockKind(codeOf(file), index)
      expect(['case', 'begin', 'loop', null]).toContain(kind)
    }
  })

  it('aucune migration ne laisse un dollar-quote non fermé', () => {
    // Un `$$` manquant rend le fichier entier invalide et coupe la migration en
    // silence, sans message clair.
    for (const file of files) {
      const occurrences = codeOf(file).join('\n').match(/\$\$/g)?.length ?? 0
      expect(occurrences % 2, `${file}: ${occurrences} occurrence(s) de $$ (doit être pair)`).toBe(0)
    }
  })

  it('aucune migration ne combine `security definer` sans `search_path`', () => {
    // Sans `set search_path`, une fonction `security definer` est
    // recherchable dans le schéma d'un attaquant : c'est l'escalade de
    // privilèges la plus classique sur des fonctions SQL exposées.
    const withDefiner = files.filter((file) => /security\s+definer/i.test(read(file)))
    expect(withDefiner.length).toBeGreaterThan(0)

    for (const file of withDefiner) {
      const code = codeOf(file).join('\n')
      const definers = (code.match(/security\s+definer/gi) ?? []).length
      const searchPaths = (code.match(/set\s+search_path/gi) ?? []).length
      expect(
        searchPaths,
        `${file}: ${definers} « security definer » pour ${searchPaths} « set search_path »`,
      ).toBeGreaterThanOrEqual(definers)
    }
  })

  it('exclut les commentaires, qui peuvent citer la syntaxe fautive', () => {
    // Les contrôles ci-dessus ignorent volontairement les lignes `--`. Cette
    // migration explique pourquoi `end if;` est obligatoire, et cite aussi des
    // `end;` légitimes : un contrôle qui analyserait les commentaires
    // signalerait des fautes inexistantes.
    const source = read(join(MIGRATIONS_DIR, '20260931000000_taggo_scans.sql'))
    expect(source.split('\n').some((line) => line.trimStart().startsWith('--'))).toBe(true)
    expect(codeOf(join(MIGRATIONS_DIR, '20260931000000_taggo_scans.sql')).length).toBeLessThan(
      source.split('\n').length,
    )
  })
})