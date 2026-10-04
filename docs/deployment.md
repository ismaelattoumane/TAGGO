# TAGGO — Déploiement

## Cibles retenues

- **Vercel** est la cible principale pour la SPA TAGGO.
- **GitHub Pages** est conservé temporairement comme cible de secours. Son workflow existant n'est pas modifié par cette étape.
- Supabase utilise un projet distinct pour le staging et la production.

## Environnements

### Développement local

Le développement local utilise Vite :

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sans variables Supabase, l'application reste en mode démo local. Ce mode utilise `localStorage` et ne doit pas servir à des comptes réels.

Pour tester Supabase localement ou le staging, renseigner dans `.env.local` :

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Les fichiers `.env.local` et autres fichiers `.env*` contenant des valeurs réelles ne doivent jamais être commités.

### Supabase staging

Le staging doit être un projet Supabase séparé de la production. Il sert à tester les migrations et l'application avant publication.

La migration initiale versionnée se trouve dans `supabase/migrations/`. Elle reprend le schéma actuel sans modification fonctionnelle.

Le déploiement du schéma vers un projet staging doit être réalisé explicitement avec la Supabase CLI ou le mécanisme de migration approuvé par l'équipe. Cette étape ne déploie aucune ressource distante automatiquement.

### Supabase production

La production doit utiliser un projet Supabase distinct du staging. Les données et les clés des deux projets ne doivent pas être mélangées.

Les migrations doivent d'abord être validées en staging, puis appliquées explicitement en production.

## Vercel

### Vercel Preview / staging

Les déploiements Preview Vercel doivent utiliser les variables du projet Supabase staging :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Dans Vercel : **Project Settings → Environment Variables**, sélectionner l'environnement **Preview**.

### Vercel Production

Le déploiement Production Vercel doit utiliser les variables du projet Supabase production. Dans Vercel, sélectionner l'environnement **Production** pour ces variables.

Aucune clé `service_role`, aucun mot de passe, token privé ou secret serveur ne doit être défini avec le préfixe `VITE_`. Les variables `VITE_*` sont intégrées au bundle navigateur.

La configuration SPA de `vercel.json` redirige les routes vers `index.html` (compatible React Router et `base: '/'`). L'étape 10 ajoute une règle antérieure : `/sitemap.xml` est routé vers la fonction serveur `/api/sitemap`.

## Variables d'environnement

Le frontend n'utilise que deux variables, toutes deux publiques :

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Tout le reste est **serveur** (fonctions `/api`) et ne doit jamais être préfixé
par `VITE_` :

| Variable | Rôle | Étape |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | clé secrète Stripe (`sk_test_` uniquement à ce jour) | 9 |
| `STRIPE_WEBHOOK_SECRET` | signature du webhook Stripe | 9 |
| `SUPABASE_URL` | projet Supabase côté serveur | 9 |
| `SUPABASE_SERVICE_ROLE_KEY` | rôle `service_role` (webhook, journal d'emails) | 9 |
| `APP_URL` | domaine public : `success_url`, `cancel_url`, liens d'email, sitemap | 9 |
| `EMAIL_PROVIDER_NAME` | provider d'emails transactionnels (vide = aucun envoi) | 10 |
| `EMAIL_PROVIDER_API_KEY` | secret du provider d'emails | 10 |

## Sitemap

`/sitemap.xml` est produit par la fonction serveur `api/sitemap.ts`, routée dans
`vercel.json`. Le sitemap est construit à partir de `APP_URL` : tant que le
domaine public n'est pas connu, la fonction répond **404** et aucune URL absolue
n'est inventée. Une fois `APP_URL` définie :

1. déployer ;
2. vérifier que `https://<domaine>/sitemap.xml` renvoie bien le XML ;
3. ajouter `Sitemap: https://<domaine>/sitemap.xml` dans `public/robots.txt`
   (la ligne est volontairement absente tant que le domaine n'est pas validé).

## Emails transactionnels

Aucun prestataire email n'est installé par défaut : les emails sont rendus,
dédupliqués et journalisés, mais aucun message n'est émis tant que
`EMAIL_PROVIDER_NAME` est vide.

Le branchement d'un service réel est décrit dans [emails.md](emails.md).

Avant toute émission :

- renseigner `APP_URL` (les liens des emails en dépendent) ;
- configurer SPF, DKIM et DMARC du domaine d'envoi ;
- appliquer la migration `supabase/migrations/20260930100000_email_events.sql`.

## Emails d'authentification (Supabase Auth)

Les emails de confirmation, de réinitialisation et de changement d'adresse sont
envoyés par **Supabase**, pas par le système ci-dessus. Ils n'utilisent aucune
variable Vercel. Voir [supabase-auth-emails.md](supabase-auth-emails.md).

Avant la production, dans Supabase Dashboard :

- copier les templates de `supabase/templates/auth/` dans
  **Authentication → Email Templates** ;
- renseigner **Site URL** et **Redirect URLs** avec les origines de production
  et de preview — le flux `/forgot-password` échoue si l'origine du lien
  n'est pas autorisée ;
- vérifier que **Confirm email** est activé ;
- configurer l'identité d'expéditeur, puis le SMTP si le quota intégré est
  insuffisant ;
- relever la durée de vie des liens dans **Authentication → Email → OTP** ;
- tester le parcours complet avec une adresse réelle.

Aucun secret SMTP ou Supabase n'est versionné : `supabase/config.toml` ne
contient aucune section `[auth.email.smtp]`, ce qui est vérifié par un test.

## Migrations

Ordre d'application : les migrations sont versionnées et s'appliquent dans l'ordre
des noms de fichier. Les étapes 10 ajoutent :

- `20260930100000_email_events.sql` : journal `email_events` et RPC de
  déduplication, accessibles uniquement à `service_role`.
- `20260931000000_taggo_scans.sql` : tables `taggo_scans` et
  `taggo_scan_settings`, RLS de lecture propriétaire, RPC d'écriture
  (`record_taggo_scan`) et d'agrégation (`get_taggo_scan_stats`), toutes deux
  réservées à `service_role`.
- `20260931100000_taggo_subscriptions.sql` : complète la table `subscriptions`
  (colonne `qr_code_id` unique, `auto_renew`, `source`, `stripe_*`), ajoute les
  RPC d'abonnement et le prédicat d'expiration, et redéfinit
  `transition_taggo`, `get_public_taggo_state` et `record_taggo_scan` pour tenir
  compte de l'expiration.

La migration `email_events` ne modifie aucune table ni aucune politique RLS des
étapes précédentes. La migration `taggo_scans` est également additive : elle ne
modifie aucune table existante, mais ajoute une politique RLS en lecture sur sa
propre table.

**La migration `taggo_subscriptions` est la seule qui redéfinisse des fonctions
existantes** : `transition_taggo`, `get_public_taggo_state` et
`record_taggo_scan` sont recréées à l'identique, plus la règle d'abonnement.
C'est le point à relire en priorité en staging. Les droits d'exécution de
`transition_taggo` sont inchangés (`authenticated` uniquement).

Ces trois fonctions ont été appliquées et exercées sur une instance PostgreSQL
16 avec les 9 migrations du projet, y compris sous les rôles `anon` et
`authenticated` (voir `docs/subscriptions.md` § 15.1). Ce qui reste à refaire en
staging est la vérification avec de vrais JWT Supabase et la politique RLS
Supabase.

**Note importante pour l'étape 11** : `20260931000000_taggo_scans.sql` a été
corrigé (deux blocs `if` se terminaient par `end;` au lieu de `end if;`, ce qui
rendait le fichier inapplicable). Si cette migration a déjà été poussée en
production avant la correction, la base ne contient ni `taggo_scans`, ni
`record_taggo_scan`, ni les RPC d'analytics : vérifier ce point avant de considérer
l'étape 11 comme déployée.

Avant toute chose, vérifier deux points :

1. **Les lignes historiques sans `qr_code_id` sont MIS EN ARCHIVE, pas
   supprimées.** Elles sont copiées dans `public.subscriptions_unattached_archive`
   (clé `row_id` = ancien `id`), puis retirées de `subscriptions` — cette étape
   est nécessaire et uniquement justifiée par la contrainte `NOT NULL`. Le nombre
   de lignes concernées apparaît dans les logs de déploiement sous la forme
   `TAGGO etape 12 : N ligne(s) …`. La stratégie est réversible : voir
   `docs/subscriptions.md` § 13.1. Une sauvegarde reste recommandée si des
   données ont été saisies à la main, mais aucune donnée n'est perdue.
2. **Les TAGGO sans abonnement deviennent publiquement indisponibles.** C'est le
   comportement voulu : l'accès public exige une période `active` et non échue.
   Un TAGGO créé hors boutique (dashboard, import) passe donc à l'état
   `subscription_required` et sa page publique affiche « temporairement
   indisponible ». **Ce n'est pas une expiration rétrospective** : aucun statut
   n'est réécrit, seule la visibilité change. Les TAGGO achetés, eux, reçoivent
   leur première année incluse au moment du paiement confirmé.

Avant d'activer les analytics en production, lire `docs/analytics.md`. Avant
d'activer les abonnements, lire `docs/subscriptions.md` : le tarif de
renouvellement n'est pas défini et aucun renouvellement n'est possible tant
qu'il ne l'est pas.

## Build et vérifications

Avant un déploiement :

```bash
npm test -- --run
npm run typecheck
npm run lint
npm run build
```

La commande de build produit le dossier `dist/` :

```bash
npm run build
```

Vercel peut ensuite utiliser le script `npm run build` et publier `dist/` selon sa configuration de projet.

## Déploiement

1. Valider les changements et les tests en local.
2. Vérifier que les variables Preview pointent vers Supabase staging.
3. Pousser la branche et vérifier le déploiement Preview Vercel.
4. Tester les routes SPA et les fonctionnalités prévues sur Preview.
5. Promouvoir explicitement la version validée vers Vercel Production.
6. Vérifier que les variables Production pointent vers Supabase production.

Aucun déploiement n'est déclenché par ce document.

## Rollback

En cas de problème applicatif :

1. Identifier le déploiement Vercel Production concerné.
2. Revenir au déploiement précédent validé depuis l'historique Vercel.
3. Vérifier les routes publiques et privées.
4. Vérifier la compatibilité avec le schéma Supabase déjà déployé.
5. Corriger la branche et reproduire la validation en Preview avant une nouvelle promotion.

Une migration de base déjà appliquée ne doit pas être annulée par une simple réversion frontend. Toute migration corrective doit être versionnée séparément et testée en staging.

## Secrets et fichiers ignorés

- Seules l'URL Supabase et la clé publique `anon` sont utilisées côté frontend.
- Une clé `service_role` reste exclusivement côté serveur ou dans les secrets d'un environnement backend autorisé.
- Les fichiers `.env*` sont ignorés par Git, à l'exception de `.env.example`.
- Ne jamais placer de secret dans le code source, dans `public/`, dans `VITE_*` ou dans un commit.
- En cas de fuite, révoquer immédiatement la clé concernée et vérifier l'historique Git.
