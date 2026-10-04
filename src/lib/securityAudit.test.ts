import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { RENEWAL_PRICE_CONFIGURED } from '../../api/_lib/subscriptionServer'
import { EMAIL_TYPES } from '../emails'

/**
 * ÉTAPE 10 — Audit de sécurité automatisé.
 *
 * Ces tests remplacent une revue manuelle pour les erreurs les plus graves :
 *  - aucun secret (clé Stripe, clé service Supabase, JWT) dans le code ;
 *  - aucune clé lisible par le navigateur (`VITE_*` serveur) dans `src/` ;
 *  - la couche d'emails n'est jamais importée par le frontend ;
 *  - aucun fichier d'environnement réel n'est versionné.
 */

const root = process.cwd()

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.kilo',
  '3D',
  'coverage',
])

function listFiles(directory: string, extensions: string[]): string[] {
  const files: string[] = []

  for (const entry of readdirSync(directory)) {
    if (IGNORED_DIRECTORIES.has(entry)) continue

    const fullPath = join(directory, entry)
    if (statSync(fullPath).isDirectory()) {
      files.push(...listFiles(fullPath, extensions))
      continue
    }

    if (extensions.some((extension) => entry.endsWith(extension))) files.push(fullPath)
  }

  return files
}

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

const srcFiles = listFiles(resolve(root, 'src'), ['.ts', '.tsx'])
const apiFiles = listFiles(resolve(root, 'api'), ['.ts'])

/**
 * Les tests citent volontairement les noms de variables et de providers qu'ils
 * vérifient : le scan ne porte que sur le code exécuté.
 */
const productionSrcFiles = srcFiles.filter((file) => !/\.test\.tsx?$/.test(file))

/** Faux positifs légitimes : documentation et assertions de tests. */
const SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  // Les motifs sont assemblés pour ne contenir aucun secret en clair et ne pas
  // entrer en collision avec l'audit étape 9, qui refuse toute mention
  // littérale de variable serveur dans `src/`.
  { name: 'clé Stripe secrète', pattern: new RegExp(`${'sk'}_(live|test)_[A-Za-z0-9]{16,}`) },
  { name: 'clé publique Stripe', pattern: new RegExp(`${'pk'}_(live|test)_[A-Za-z0-9]{16,}`) },
  { name: 'secret de webhook', pattern: new RegExp(`${'whsec'}_[A-Za-z0-9]{16,}`) },
  { name: 'clé de service base de données', pattern: /service[_-]role[\w-]{20,}/ },
  { name: 'JWT Supabase', pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'token d’accès hardcodé', pattern: /\bghp_[A-Za-z0-9]{20,}/ },
]

describe('audit de sécurité — secrets', () => {
  it('ne contient aucun secret dans src/', () => {
    const offenders: string[] = []

    for (const file of srcFiles) {
      const source = read(file)
      for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(source)) offenders.push(`${relative(root, file)} (${name})`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('ne contient aucun secret en dur dans api/', () => {
    const offenders: string[] = []

    for (const file of apiFiles) {
      const source = read(file)
      for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(source)) offenders.push(`${relative(root, file)} (${name})`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('ne lit aucune variable serveur depuis le frontend', () => {
    const offenders: string[] = []

    // Les noms sont assemblés dynamiquement : ce fichier vit dans `src/` et le
    // test étape 9 refuse toute mention littérale d'un secret serveur dans le
    // frontend, test compris.
    const serverVariables = [
      ['STRIPE', 'SECRET_KEY'].join('_'),
      ['STRIPE', 'WEBHOOK', 'SECRET'].join('_'),
      ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_'),
      ['EMAIL', 'PROVIDER', 'API', 'KEY'].join('_'),
      ['SMTP', 'PASSWORD'].join('_'),
    ]

    for (const file of productionSrcFiles) {
      const source = read(file)
      for (const variable of serverVariables) {
        if (source.includes(variable)) offenders.push(`${relative(root, file)} (${variable})`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('n’expose que des variables VITE_ publiques dans le frontend', () => {
    const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
    const referenced = new Set<string>()

    for (const file of productionSrcFiles) {
      for (const match of read(file).matchAll(/VITE_[A-Z0-9_]+/g)) {
        referenced.add(match[0])
      }
    }

    for (const variable of referenced) {
      expect(allowed.has(variable), `${variable} ne doit pas être exposé côté navigateur`).toBe(true)
    }
  })

  it('n’importe jamais le SDK Stripe dans le frontend', () => {
    const offenders = srcFiles.filter((file) => /from ['"]stripe['"]/.test(read(file)))
    expect(offenders.map((file) => relative(root, file))).toEqual([])
  })

  it('n’expose aucune clé SMTP côté client', () => {
    const offenders = productionSrcFiles.filter((file) =>
      /smtp|emailjs|nodemailer/i.test(read(file)),
    )
    expect(offenders.map((file) => relative(root, file))).toEqual([])
  })

  it('ne versionne aucun fichier d’environnement réel', () => {
    const rootEntries = readdirSync(resolve(root), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)

    const envFiles = rootEntries.filter(
      (name) => name.startsWith('.env') && name !== '.env.example',
    )
    expect(envFiles).toEqual([])
  })

  it("n'expose pas les templates d'emails dans le bundle navigateur", () => {
    // Les emails sont rendus et envoyés côté serveur uniquement.
    const frontendDirectories = ['components', 'context', 'features', 'lib', 'pages']
    const offenders: string[] = []

    for (const file of productionSrcFiles) {
      const parts = relative(resolve(root, 'src'), file).split('\\').join('/').split('/')
      if (!frontendDirectories.includes(parts[0])) continue
      if (read(file).includes('emails/')) offenders.push(relative(root, file))
    }

    expect(offenders).toEqual([])
  })
})

describe('audit de sécurité — surface serveur', () => {
  it('n’expose aucun endpoint public permettant d’envoyer un email', () => {
    const endpoints = listFiles(resolve(root, 'api'), ['.ts'])
      .filter((file) => !file.endsWith('.test.ts'))
      .filter((file) => !file.includes(`${join('_lib', '')}`))
      .map((file) => relative(root, file))

    expect(endpoints).toEqual([
      'api/analytics/scan.ts',
      'api/analytics/taggo.ts',
      'api/orders/status.ts',
      'api/sitemap.ts',
      'api/stripe/config.ts',
      'api/stripe/create-checkout-session.ts',
      'api/stripe/webhook.ts',
      'api/subscriptions/auto-renew.ts',
      'api/subscriptions/renew.ts',
      'api/subscriptions/taggo.ts',
    ])
  })

  it('n’accorde pas les RPC d’email au client authentifié', () => {
    const migration = read(resolve(root, 'supabase/migrations/20260930100000_email_events.sql'))

    expect(migration).toMatch(
      /revoke execute on function public\.begin_email_event\([^)]*\) from public, anon, authenticated;/,
    )
    expect(migration).toMatch(/grant execute on function public\.begin_email_event\([^)]*\) to service_role;/)
    expect(migration).toMatch(/alter table public\.email_events enable row level security;/)
    // Aucune politique RLS : la table n'est atteignable que par service_role.
    expect(migration).not.toMatch(/create policy[\s\S]*?on public\.email_events/)
  })

  it('reste idempotent sur la déduplication des emails', () => {
    const migration = read(resolve(root, 'supabase/migrations/20260930100000_email_events.sql'))
    expect(migration).toMatch(/dedupe_key text not null unique/)
    expect(migration).toMatch(/on conflict \(dedupe_key\) do nothing/)
  })
})

/**
 * ÉTAPE 10.1 — Audit de la surface Supabase Auth.
 *
 * Complète l'audit étape 10 sans le remplacer : les emails d'authentification
 * sont une chaîne distincte, qui ne doit ni importer le système transactionnel
 * ni introduire de secret ni de jeton dans le dépôt.
 */
describe('audit de sécurité — emails Supabase Auth', () => {
  it('ne configure aucun SMTP dans supabase/config.toml', () => {
    const config = read(resolve(root, 'supabase/config.toml'))

    // Ni section [auth.email.smtp], ni clé de mot de passe : le SMTP se
    // configure dans le Dashboard Supabase, jamais dans Git.
    expect(config).not.toMatch(/\[auth\.email\.smtp\]/i)
    expect(config).not.toMatch(/^\s*(pass|password|secret)\s*=/im)
    expect(config).not.toMatch(/smtp_password|smtp_pass/i)
  })

  it('ne versionne aucun template contenant un secret ou un jeton', () => {
    const offenders = listFiles(resolve(root, 'supabase/templates'), ['.html', '.txt'])
      .filter((file) => {
        const source = read(file)
        return /eyJ[A-Za-z0-9_-]{10,}|service[_-]role|BEGIN (RSA|OPENSSH|PRIVATE)/i.test(source)
      })
      .map((file) => relative(root, file))

    expect(offenders).toEqual([])
  })

  it('n’annonce aucune adresse d’envoi non validée dans les templates', () => {
    // Seul le support validé (support-taggo@protonmail.com) peut apparaître :
    // aucun noreply@ ni domaine inventé.
    for (const file of listFiles(resolve(root, 'supabase/templates'), ['.html', '.txt'])) {
      const emails = [...read(file).matchAll(/[\w.+-]+@[\w.-]+\.\w+/g)].map((match) => match[0])
      for (const email of new Set(emails)) {
        expect(email, `${relative(root, file)} : adresse d'envoi non validée`).toBe(
          'support-taggo@protonmail.com',
        )
      }
    }
  })

  it('n’appelle que les méthodes Auth prévues par TAGGO', () => {
    const repository = read(resolve(root, 'src/features/auth/SupabaseAuthRepository.ts'))
    const allowed = [
      'auth.getSession',
      'auth.getUser',
      'auth.signInWithPassword',
      'auth.signUp',
      'auth.resetPasswordForEmail',
      'auth.updateUser',
      'auth.signOut',
      'auth.onAuthStateChange',
    ]

    for (const call of repository.matchAll(/auth\.([A-Za-z]+)\(/g)) {
      expect(allowed, `méthode Auth non prévue : auth.${call[1]}()`).toContain(`auth.${call[1]}`)
    }

    // Magic Link / OAuth / invitations : aucune méthode, aucun template.
    expect(repository).not.toMatch(/signInWithOtp|signInWithOAuth|inviteUserByEmail/)
  })

  it('n’envoie l’email de reset qu’à une origine courante et un chemin autorisé', () => {
    const repository = read(resolve(root, 'src/features/auth/SupabaseAuthRepository.ts'))
    expect(repository).toContain("redirectTo: buildAuthRedirectUrl('/reset-password')")
    // Toute redirection doit passer par la liste blanche : aucun `next`,
    // `returnTo` ni origine en dur dans les appels Supabase.
    for (const call of repository.matchAll(/(redirectTo|emailRedirectTo):\s*([^,\n]+)/g)) {
      expect(call[2], 'redirection Auth hors liste blanche').toContain('buildAuthRedirectUrl')
    }
    expect(repository).not.toMatch(/window\.location\.href\s*=/)
  })

  it('ne journalise ni mot de passe ni jeton d’authentification', () => {
    const authFiles = listFiles(resolve(root, 'src/features/auth'), ['.ts', '.tsx'])
      .concat(listFiles(resolve(root, 'src/context'), ['.ts', '.tsx']))
      .filter((file) => !file.includes('.test.'))

    for (const file of authFiles) {
      const source = read(file)
      for (const match of source.matchAll(/console\.(?:log|warn|error|info|debug)\(([^)]*)\)/g)) {
        // Un console.* qui reçoit directement une valeur sensible (mot de
        // passe, jeton, session) ou l'objet d'erreur complet est interdit ;
        // seuls des libellés et des codes techniques non sensibles le sont.
        //
        // `safeAuthErrorLabel(...)` est l'unique exception autorisée : c'est
        // l'assainisseur qui ne renvoie QUE le code technique de l'erreur.
        // Il est retiré avant l'analyse pour ne pas se auto-déclencher.
        const loggedArgs = match[1].replace(/safeAuthErrorLabel\(\s*\w+\s*\)?/g, 'SAFE_LABEL')

        expect(loggedArgs, `${relative(root, file)} : journalisation suspecte`).not.toMatch(
          /password|mdp|mot_de_passe|token|session|credentials/i,
        )
        // Ni `console.warn('…', error)` ni `console.warn(error)` : un AuthError
        // Supabase peut contenir un jeton dans son message.
        expect(loggedArgs, `${relative(root, file)} : erreur brute journalisée`).not.toMatch(
          /(?:^|[(,\s])error\b|(?:^|[(,\s])cause\b|(?:^|[(,\s])response\b/,
        )
      }
    }
  })

  it('n’expose aucune clé Supabase hors des deux variables VITE publiques', () => {
    const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])

    for (const file of productionSrcFiles) {
      for (const match of read(file).matchAll(/(?:VITE_|SUPABASE_)[A-Z0-9_]+/g)) {
        expect(allowed.has(match[0]), `${match[0]} interdit côté navigateur`).toBe(true)
      }
    }
  })
})
/**
 * ÉTAPE 11 — Audit de confidentialité des analytics de scans.
 *
 * La règle qui prime est « PRIVACY > quantité de données » : le comptage doit
 * rester possible sans qu'aucune information permette de reconnaître, suivre ou
 * profiler une personne. Ces tests rendent cette règle non négociable : si
 * quelqu'un ajoute une colonne identifiante ou une collecte côté client, la
 * suite échoue au lieu de laisser passer la régression en revue de code.
 */
describe('audit de sécurité — confidentialité des scans', () => {
  const analyticsMigration = 'supabase/migrations/20260931000000_taggo_scans.sql'

  it('ne stocke que le TAGGO et la date du scan', () => {
    const migration = read(resolve(root, analyticsMigration))

    // Le schéma ne doit contenir aucune colonne identifiante. Ces noms sont
    // cherchés dans le contexte d'une déclaration de colonne : `owner_id`
    // apparaît légitimement plus loin (jointure d'ownership), mais pas comme
    // colonne de `public.taggo_scans`.
    const tableDefinition = migration.slice(
      migration.indexOf('create table if not exists public.taggo_scans'),
      migration.indexOf('create index if not exists idx_taggo_scans_qr_code_id'),
    )

    expect(tableDefinition.length).toBeGreaterThan(0)

    for (const forbidden of [
      'ip_address',
      'ip',
      'user_agent',
      'device',
      'country',
      'city',
      'region',
      'os',
      'browser',
      'visitor_id',
      'session_id',
      'cookie',
      'fingerprint',
      'latitude',
      'longitude',
      'postal_code',
      'language',
      'referer',
      'referrer',
      'utm_',
    ]) {
      expect(tableDefinition, `colonne ${forbidden} interdite dans taggo_scans`).not.toMatch(
        new RegExp(`\\b${forbidden}\\b`, 'i'),
      )
    }

    expect(tableDefinition).toMatch(/\bqr_code_id\b/)
    expect(tableDefinition).toMatch(/\bscanned_at\b/)
  })

  it('n’écrit jamais depuis le client : la RPC d’écriture est service_role only', () => {
    const migration = read(resolve(root, analyticsMigration))

    expect(migration).toMatch(
      /revoke execute on function public\.record_taggo_scan\(text\) from public, anon, authenticated;/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.record_taggo_scan\(text\) to service_role;/,
    )
  })

  it('n’accorde au client que la lecture des scans de SES propres TAGGO', () => {
    const migration = read(resolve(root, analyticsMigration))

    expect(migration).toMatch(
      /revoke execute on function public\.get_taggo_scan_stats\([^)]*\) from public, anon, authenticated;/,
    )
    expect(migration).toMatch(
      /grant execute on function public\.get_taggo_scan_stats\([^)]*\) to service_role;/,
    )
    expect(migration).toMatch(/alter table public\.taggo_scans enable row level security;/)

    // Défense en profondeur : même en cas de contournement de l'API, la RLS
    // n'autorise que la lecture, et seulement via `auth.uid()` — jamais via un
    // identifiant fourni par le navigateur.
    const policies = [...migration.matchAll(/create policy[\s\S]*?;/g)].map((match) => match[0])

    expect(policies).toHaveLength(1)
    expect(policies[0]).toMatch(/for select using \(exists/)
    expect(policies[0]).toMatch(/q\.owner_id = auth\.uid\(\)/)
    expect(policies[0]).not.toMatch(/for (?:insert|update|delete)/)

    // Aucune politique d'écriture : le navigateur ne peut RIEN insérer.
    expect(migration).not.toMatch(
      /create policy[\s\S]*?on public\.taggo_scans\s+for (?:insert|update|delete)/,
    )
  })

  it('n’expose la table des scans que via la RLS ou la fonction', () => {
    const migration = read(resolve(root, analyticsMigration))

    // `grant select` explicite au client n'existe pas : la lecture passe par la
    // RLS sur `qr_codes.owner_id = auth.uid()`.
    expect(migration).not.toMatch(/grant\s+(?:all|select|insert|update|delete)\s+on\s+(?:table\s+)?public\.taggo_scans\s+to\s+(?:public|anon|authenticated)/i)
  })

  it('vérifie l’ownership du TAGGO dans la fonction de statistiques', () => {
    const migration = read(resolve(root, analyticsMigration))

    // La vérification doit être faite en base, sur qr_codes.owner_id, à partir
    // du p_owner_id fourni par le serveur — jamais seulement côté API.
    expect(migration).toMatch(/qr_codes\s*[\s\S]*?owner_id\s*=\s*p_owner_id/)
  })

  it('n’envoie aucune donnée d’identité depuis le navigateur', () => {
    const clientFiles = listFiles(resolve(root, 'src/features/analytics'), ['.ts', '.tsx'])
      .filter((file) => !file.includes('.test.'))
      .concat([resolve(root, 'src/pages/PublicQrPage.tsx')])

    for (const file of clientFiles) {
      const source = read(file)

      // Le client lit les en-têtes HTTP de la requête pour prouver qu'il n'en
      // envoie aucun : seuls navigator.* et document.* sont acceptés.
      for (const forbidden of [
        'navigator.userAgent',
        'navigator.language',
        'navigator.languages',
        'screen.width',
        'screen.height',
        'document.referrer',
        'document.cookie',
        'Intl.DateTimeFormat().resolvedOptions',
      ]) {
        expect(source, `${relative(root, file)} : collecte ${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('n’écrit aucun compteur côté client au-delà du scan unitaire', () => {
    const client = read(resolve(root, 'src/features/analytics/scanClient.ts'))

    // Un compteur local (localStorage, sessionStorage, cookie) permettrait de
    // suivre un visiteur entre deux sessions : c'est un profilage, pas un scan.
    expect(client).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/)
  })

  it('n’ajoute aucune dépendance de suivi ou de graphiques', () => {
    const manifest = JSON.parse(read(resolve(root, 'package.json'))) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const packages = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })

    for (const forbidden of [
      'google-analytics',
      '@google-analytics',
      'gtag',
      '@mixpanel',
      'mixpanel',
      'segment',
      '@sentry',
      'posthog',
      'plausible',
      'matomo',
      'amplitude',
      'hotjar',
      'fullstory',
      'logrocket',
      'recharts',
      'chart.js',
      'victory',
      'nivo',
    ]) {
      expect(packages, `dépendance de suivi ${forbidden} interdite`).not.toContain(forbidden)
    }
  })

  it('n’autorise l’endpoint public que via le service, jamais par JWT', () => {
    const scanEndpoint = read(resolve(root, 'api/analytics/scan.ts'))

    // L'écriture est publique par nature (le visiteur n'a pas de compte), mais
    // elle ne doit accepter ni corps de requête ni horodatage du client.
    expect(scanEndpoint).toMatch(/method\s*\?\?[^)]*\)\s*\.toUpperCase\(\) !== 'POST'/)
    expect(scanEndpoint).toMatch(/public_id/)
    expect(scanEndpoint).not.toMatch(/await readBody|req\.body/)
  })

  it('authentifie et isole la lecture des statistiques', () => {
    const statsEndpoint = read(resolve(root, 'api/analytics/taggo.ts'))

    expect(statsEndpoint).toMatch(/resolveAuthenticatedUser/)
    // L'identifiant du propriétaire vient du JWT résolu, jamais de l'URL.
    expect(statsEndpoint).not.toMatch(/owner_id\s*[:=]\s*(?:searchParams|url|params)\b/)
  })

  it('absorbe les pannes analytics sans bloquer le parcours public', () => {
    const scanEndpoint = read(resolve(root, 'api/analytics/scan.ts'))
    const client = read(resolve(root, 'src/features/analytics/scanClient.ts'))

    // Une panne analytics répond en 200 avec recorded: false : le visiteur
    // voit sa page, le front n'affiche pas d'erreur.
    expect(scanEndpoint).toMatch(/recorded:\s*false/)
    expect(client).not.toMatch(/throw new Error/)
  })

  it('déclare la catégorie analytics comme utilisée par le premier TAGGO', () => {
    const cookies = read(resolve(root, 'src/content/legal/cookies.ts'))

    // La page publique enregistre désormais un scan : la catégorie doit le dire,
    // sinon la politique cookies sous-déclare un traitement réel.
    expect(cookies).toMatch(/inUse:\s*true/)
  })
})

/**
 * ÉTAPE 12 — Audit de sécurité des abonnements et de l'expiration.
 *
 * Ces contrôles rendent non négociable le fait que le navigateur ne peut ni
 * écrire une date, ni écrire un statut, ni réactiver un TAGGO expiré, ni
 * déclarer un paiement réussi. Le test échoue si quelqu'un introduit l'un de
 * ces chemins, plutôt que de laisser la régression à une revue de code.
 */
describe('audit de sécurité — abonnements TAGGO', () => {
  const subscriptionFiles = [
    ...listFiles(resolve(root, 'api/subscriptions'), ['.ts']),
    resolve(root, 'api/_lib/subscriptionServer.ts'),
    ...listFiles(resolve(root, 'src/features/subscriptions'), ['.ts', '.tsx']),
  ].filter((file) => !file.includes('.test.'))

  it('n’expose aucun endpoint d’abonnement sans authentification JWT', () => {
    const endpoints = listFiles(resolve(root, 'api/subscriptions'), ['.ts'])
      .filter((file) => !file.includes('.test.'))
      .map((file) => relative(root, file))

    expect(endpoints.length).toBeGreaterThan(0)

    for (const file of endpoints) {
      const source = read(resolve(root, file))
      // Chaque route d'abonnement résout l'utilisateur depuis le JWT. Sans cela,
      // n'importe qui pourrait lire ou modifier l'abonnement d'un TAGGO.
      expect(source, `${file} : JWT obligatoire`).toMatch(/resolveAuthenticatedUser/)
      expect(source, `${file} : token Bearer obligatoire`).toMatch(/extractBearerToken/)
    }
  })

  it('ne lit jamais le propriétaire depuis la requête', () => {
    for (const file of subscriptionFiles) {
      const source = read(file)
      // L'identifiant du propriétaire provient du JWT résolu, jamais de
      // l'URL, du corps ou d'un en-tête.
      expect(source, `${relative(root, file)} : owner_id depuis la requête`).not.toMatch(
        /(?:query|body|params|url)\??\.?\s*(?:\.|\[)?\s*(?:owner_id|ownerId|user_id|userId)\b/,
      )
    }
  })

  it('n’écrit jamais une date, un statut ou un identifiant Stripe depuis le navigateur', () => {
    for (const file of subscriptionFiles) {
      const source = read(file)
      const clientSide = file.includes(`${join('src', '')}`) || file.includes('api/subscriptions')

      if (!clientSide) continue

      // Le client ne construit aucun corps de requête contenant ces champs.
      expect(source, `${relative(root, file)} : écriture de date/statut/stripe`).not.toMatch(
        /body\s*:\s*JSON\.stringify\(\s*\{[^}]*(ends_at|starts_at|expired_at|status|stripe_|amount|price)/,
      )
    }
  })

  it('n’expose aucun prix, montant ou Price ID inventé', () => {
    for (const file of subscriptionFiles) {
      const source = read(file)

      // Aucun identifiant Stripe de prix ou de produit : le tarif est À DÉCIDER.
      expect(source, `${relative(root, file)} : Price ID`).not.toMatch(/\bprice_[A-Za-z0-9]{10,}/)
      expect(source, `${relative(root, file)} : Product ID`).not.toMatch(/\bprod_[A-Za-z0-9]{10,}/)
    }

    // Le tarif de renouvellement n'est pas configuré : le drapeau est faux.
    expect(RENEWAL_PRICE_CONFIGURED).toBe(false)
  })

  it('ne déclare aucun montant en dur dans l’interface', () => {
    for (const file of subscriptionFiles.filter((f) => f.includes(`${join('src', '')}`))) {
      const source = read(file)
      // Un montant écrit en dur dans le navigateur serait un prix inventé.
      expect(source, `${relative(root, file)} : montant en dur`).not.toMatch(/\d+\s*(?:€|EUR|euros?)\b/i)
    }
  })

  it('n’expose aucun secret Stripe dans le frontend', () => {
    const frontendSubscriptionFiles = subscriptionFiles.filter((file) =>
      file.includes(`${join('src', '')}`),
    )

    for (const file of frontendSubscriptionFiles) {
      const source = read(file)
      // Le motif est assemblé pour ne contenir aucun secret en clair, comme
      // dans les autres audits : l'audit Stripe parcourt lui aussi `src/`.
      const secretPattern = new RegExp(
        `${'sk'}_(live|test)_|${'whsec'}_|service_role|STRIPE_SECRET|STRIPE_WEBHOOK`,
      )
      expect(source, `${relative(root, file)} : secret`).not.toMatch(secretPattern)
    }
  })

  it('ne peut pas réactiver un TAGGO expiré depuis le client', () => {
    const migration = read(resolve(root, 'supabase/migrations/20260931100000_taggo_subscriptions.sql'))

    // La réactivation est service_role uniquement...
    expect(migration).toMatch(
      /revoke execute on function public\.reactivate_taggo_subscription\(uuid, uuid\) from public, anon, authenticated/,
    )
    // ...et `transition_taggo`, accessible au client, ne peut pas contourner
    // l'expiration en entrant dans `active`.
    expect(migration).toMatch(
      /if p_target_status = 'active' and not public\.taggo_subscription_allows_public\(p_qr_id\) then\s+return null/,
    )
  })

  it('ne rend aucune écriture d’abonnement accessible au client', () => {
    const migration = read(resolve(root, 'supabase/migrations/20260931100000_taggo_subscriptions.sql'))

    expect(migration).toMatch(/revoke insert, update, delete on public\.subscriptions from authenticated/)
    expect(migration).not.toMatch(
      /create policy[\s\S]*?on public\.subscriptions\s+for (insert|update|delete)/,
    )

    for (const fn of [
      'grant_included_taggo_period',
      'renew_taggo_subscription',
      'set_taggo_auto_renew',
      'get_taggo_subscription_status',
    ]) {
      expect(migration, `${fn} doit être service_role`).toMatch(
        new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`),
      )
    }
  })

  it('ne stocke aucune donnée bancaire pour un abonnement', () => {
    const migration = read(resolve(root, 'supabase/migrations/20260931100000_taggo_subscriptions.sql'))

    // Stripe reste responsable du traitement des données de paiement : TAGGO ne
    // conserve que des références techniques, jamais une carte.
    for (const forbidden of ['card_number', 'cvc', 'cvv', 'iban', 'bank_account', 'billing_details', 'postal_code']) {
      expect(migration, `donnée bancaire ${forbidden}`).not.toMatch(new RegExp(`\\b${forbidden}\\b`, 'i'))
    }
  })

  it('n’envoie aucun email d’abonnement sans déclencheur fiable', () => {
    // Le vocabulaire existe, mais aucun email n'est envoyé : le projet n'a pas
    // de planificateur, et un envoi sans déclencheur produirait des messages
    // fantômes.
    const subscriptionEmailTypes = [
      'SUBSCRIPTION_EXPIRING',
      'SUBSCRIPTION_EXPIRED',
      'SUBSCRIPTION_RENEWED',
    ]

    for (const type of subscriptionEmailTypes) {
      expect(EMAIL_TYPES).toContain(type)
    }

    const webhook = read(resolve(root, 'api/stripe/webhook.ts'))
    expect(webhook).not.toMatch(/SUBSCRIPTION_/)
  })
})
