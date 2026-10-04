# TAGGO

## Description

TAGGO est une application de gestion de QR codes publics pour marques et collections. Le MVP permet de créer, éditer et suivre des codes TAGGO, de sécuriser l’accès côté dashboard, et d’afficher une page publique filtrée selon le statut du QR.

## Stack

- React 19 + TypeScript + Vite
- React Router 7 pour la navigation SPA
- Supabase Auth + PostgreSQL avec RLS
- Vitest + Testing Library pour les tests automatisés
- localStorage uniquement en mode démo hors production

## Installation locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Variables d’environnement

Le frontend attend au minimum :

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Aucune clé service role, secret, ou token privé ne doit être exposée dans le frontend. Seule la clé publique anon de Supabase est utilisée côté client.

## Développement

```bash
npm run dev
npm run typecheck
npm run test
npm run lint
npm run build
```

## Mode local démo

Sans variables Supabase configurées, l’application fonctionne en mode local demo. Ce mode ne doit pas être utilisé pour des comptes réels ni pour la production. Les données de test sont stockées dans localStorage et ne remplacent pas l’authentification Supabase.

## Base de données Supabase

La source de vérité du schéma est le dossier `supabase/migrations` : les fichiers
sont appliqués **dans l’ordre du dépôt**. Pour un projet Supabase neuf,
[l’instantané](supabase/schema.sql) peut être appliqué tel quel ; pour un projet
existant, ce sont les migrations qui font foi.

[supabase/schema.sql](supabase/schema.sql) est un **fichier généré**, jamais
édité à la main. Il couvre l’ensemble du schéma : profils, TAGGO, profils
publics, abonnements, catalogue, commandes, paiements Stripe, scans,
anti-abus, la vue publique et toutes les policies RLS — **avec leurs
privilèges**, qui font partie du modèle de sécurité autant que les policies.

### Empêcher une nouvelle divergence

```bash
npm run db:stack:up        # pile locale : PostgreSQL + GoTrue + PostgREST
npm run db:schema:check    # échoue si l’instantané a dérivé des migrations
npm run db:schema          # régénère l’instantané
npm run db:schema:replay   # vérifie que l’instantané rejoué redonne le même schéma
```

`npm run test` contient aussi un garde-fou statique (`src/lib/schemaSync.test.ts`)
qui vérifie que tout objet créé par une migration figure dans l’instantané. Il
n’a besoin ni de Docker ni de base : ajouter une migration sans régénérer
l’instantané fait échouer `npm run test`, donc avant la livraison et non au
moment du déploiement.

Si `check` échoue, la seule correction légitime est de régénérer. Modifier les
migrations ou l’instantané pour faire disparaître la divergence supprimerait la
preuve du problème au lieu de le traiter.

### Tests de sécurité

```bash
npm run test:db
```

Rejoue les migrations sur une base propre, puis exécute les tests PostgreSQL/RLS
avec les vrais rôles clients et de vrais JWT, puis les tests HTTP contre PostgREST.
Voir [supabase/tests/README.md](supabase/tests/README.md).

## Routes principales

- / : landing page
- /about : page À propos
- /faq : questions fréquentes
- /contact : contact TAGGO
- /shipping : livraison et retours
- /legal/notice : mentions légales
- /legal/terms : conditions générales de vente
- /legal/privacy : politique de confidentialité (RGPD)
- /legal/cookies : politique cookies
- /shop et /shop/:slug : boutique
- /cart, /checkout, /checkout/success, /checkout/cancel : parcours de commande
- /login, /register, /forgot-password, /reset-password : accès au compte
- /dashboard et ses sous-routes : espace privé
- /t/:tag : page publique d'un QR actif
- /qr/:publicId : redirection de compatibilité vers la route canonique
- /404 : page non trouvée

Pages indexables : `/`, `/about`, `/faq`, `/contact`, `/shipping`, `/legal/*`,
`/shop`, `/t/:tag`.
Pages hors index : `/login`, `/register`, `/forgot-password`, `/reset-password`,
`/dashboard/*`, `/cart`, `/checkout/*`, `/404`.

## Étape 10 — contenu public, légal et emails

### Où modifier quoi

| Sujet | Fichier |
| --- | --- |
| Informations légales unknowns (SIRET, forme juridique, hébergeur, médiateur…) | `src/config/business.ts` |
| Mentions légales | `src/content/legal/notice.ts` |
| Politique de confidentialité | `src/content/legal/privacy.ts` |
| CGV | `src/content/legal/terms.ts` |
| Politique cookies + catégories | `src/content/legal/cookies.ts` |
| Livraison et retours | `src/content/legal/shipping.ts` |
| FAQ | `src/content/faq/faqContent.ts` |
| Page À propos | `src/content/about/aboutContent.ts` |
| Page contact | `src/content/contact/contactContent.ts` |
| Templates d'emails | `src/emails/templates/` |
| Déclenchement serveur des emails | `api/_lib/emailTriggers.ts` |

### Placeholders

Aucune donnée juridique, aucun prix, aucun délai, aucun médiateur, aucune
certification n'est inventé. Tant que TAGGO n'a pas validé une information, sa
valeur est `null` dans `src/config/business.ts` et les pages publiques affichent
`[À COMPLÉTER — <champ>]`.

`pendingFields()` liste tout ce qui reste à compléter. Les textes juridiques sont
des bases de travail : ils doivent être validés par TAGGO et par un conseil
juridique avant toute commercialisation.

### Emails

Voir [docs/emails.md](docs/emails.md). En résumé :

- les emails ne sont jamais déclenchés depuis le navigateur ;
- un événement métier n'envoie qu'un seul email (réservation atomique de
  `dedupe_key` dans `email_events`) ;
- aucun prestataire email n'est intégré : sans `EMAIL_PROVIDER_NAME`, aucun
  message n'est émis ;
- le seul email branché à un événement réel est `ORDER_CONFIRMED`, déclenché par
  le webhook Stripe après passage réel de la commande à `paid`.

### Emails d'authentification (Supabase Auth)

Voir [docs/supabase-auth-emails.md](docs/supabase-auth-emails.md). En résumé :

- les emails de confirmation, de réinitialisation et de changement d'adresse sont
  rendus et envoyés par **Supabase**, en amont de l'application : TAGGO n'y
  touche pas ;
- les templates prêts à l'emploi sont dans `supabase/templates/auth/` (HTML +
  version texte) ;
- aucun token de récupération n'est créé, stocké ni journalisé par TAGGO ;
- Magic Link, OAuth et invitation ne sont pas utilisés ;
- les redirections Auth sont limitées à `/login` et `/reset-password` par une
  liste blanche ; aucun `returnTo` utilisateur n'est accepté.

## Fonctionnement QR

Un QR public utilise le format TGG-XXXXXXX. La route publique n’expose que les enregistrements actifs, publics, avec une destination HTTP ou HTTPS valide. Les QR inactifs, non publiés, ou sans destination valide affichent un état explicite au lieu de rediriger.

## Déploiement Vercel

Le projet est prêt pour un déploiement Vercel en SPA. Une configuration fallback est fournie dans [vercel.json](vercel.json) pour garantir que les routes React Router restent accessibles après rechargement direct.

Variables à définir dans Vercel :

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

Variables **serveur** des fonctions `/api` (jamais préfixées par `VITE_`) :

- STRIPE_SECRET_KEY — clé secrète Stripe. L’étape 9 n’accepte que `sk_test_` ; une clé `sk_live_` est refusée par le serveur.
- STRIPE_WEBHOOK_SECRET — secret de signature du endpoint `/api/stripe/webhook`.
- SUPABASE_URL — URL du projet Supabase (serveur).
- SUPABASE_SERVICE_ROLE_KEY — clé de service, usage serveur uniquement.
- APP_URL — URL publique de l’application (`success_url` / `cancel_url`, liens d’email, sitemap).
- EMAIL_PROVIDER_NAME — provider d’emails transactionnels (vide = aucun envoi).
- EMAIL_PROVIDER_API_KEY — secret du provider d’emails (serveur uniquement).

Sans ces variables, le paiement reste indisponible : aucune Checkout Session n’est créée et aucun secret n’est versionné.

Les emails d’authentification n’ajoutent **aucune** variable : ils sont envoyés par Supabase. Si un SMTP personnalisé est requis, il se configure dans Supabase Dashboard → Authentication → Email → SMTP, jamais dans ce dépôt ni dans Vercel.

## Paiement Stripe (étape 9)

Le paiement passe exclusivement par des fonctions serveur Vercel (`/api`) :

| Endpoint | Rôle |
| --- | --- |
| `POST /api/stripe/create-checkout-session` | authentifie l’utilisateur (JWT), retarife le panier, crée la commande `pending` puis la Checkout Session Stripe |
| `POST /api/stripe/webhook` | vérifie la signature Stripe sur le corps brut, applique `paid`, attribue les TAGGO et déclenche l’email de confirmation (idempotent) |
| `GET /api/stripe/config` | indique au frontend si le paiement est réellement disponible |
| `GET /api/orders/status` | lit l’état réel d’une commande (propriétaire uniquement) |
| `GET /sitemap.xml` | sitemap XML des pages publiques (404 tant que `APP_URL` n’est pas configurée) |

Règles non négociables :

- le navigateur n’envoie que `variantId` + `quantity` : prix, devise et totaux sont recalculés par le serveur ;
- aucun montant n’est inventé : sans prix officiel publié, le paiement reste bloqué ;
- le statut `paid` n’est écrit que par le webhook Stripe, via des fonctions SQL réservées à `service_role` ;
- aucun TAGGO n’est réservé avant confirmation serveur du paiement ;
- la clé Stripe secrète n’entre jamais dans le bundle navigateur (le SDK `stripe` n’est importé que sous `/api`).

## Sécurité

- Authentification gérée par Supabase
- Sessions persistées automatiquement
- validation des destinations limitées à http et https
- accès propriétaire vérifié côté frontend et côté base
- aucune donnée sensible exposée dans le bundle
- RLS conservé et non désactivé

## Sécurité

Le durcissement RLS de l’étape 13.1 — protection du cycle de vie d’un TAGGO,
retrait de `owner_id` de l’accès anonyme, verrouillage des colonnes financières
d’une commande — est décrit dans [docs/security-hardening-13.1.md](docs/security-hardening-13.1.md),
avec les six défauts trouvés et la façon de les revérifier.

## Limitations du MVP

- le paiement Stripe n’est actif qu’en mode test et tant que les prix officiels ne sont pas publiés
- la gestion avancée de profil n’est pas encore connectée à Supabase
- l’authentification de changement de mot de passe et la suppression de compte restent à brancher selon le workflow Supabase final
- aucun template d’email Supabase Auth n’est encore copié dans le Dashboard : les fichiers prêts à l’emploi sont dans `supabase/templates/auth/`, la procédure dans `docs/supabase-auth-emails.md`
- les documents juridiques sont des bases de travail : ils doivent être complétés et validés avant commercialisation
- seul l’email de confirmation de commande est branché à un événement réel ; les autres templates attendent leur déclencheur serveur
- aucun prestataire d’emails transactionnels n’est intégré : sans `EMAIL_PROVIDER_NAME`, aucun email n’est émis
- le formulaire de contact prépare un `mailto:` : aucune donnée n’est transmise à un serveur TAGGO
