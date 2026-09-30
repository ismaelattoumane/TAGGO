# Revue des modifications non commitées

Date : 2026-09-30
Branche : `chore/logo-system` (dernier commit : `e20bd34` "Prepare commercial TAGGO lifecycle")
Portée : 27 fichiers modifiés, 25 fichiers ajoutés (+760 / -85 lignes sur le suivi)

Vérifications exécutées avant commit :

| Commande | Résultat |
| --- | --- |
| `npm run typecheck` | OK, aucune erreur |
| `npm run lint` | 4 warnings, 0 error |
| `npm test` | 28 fichiers / 127 tests passés |
| `npm run build` | OK, bundle 1 372 kB (avertissement de taille de chunk) |

---

## Vue d'ensemble

Le travail non commité correspond à une étape « pré-commercialisation » du projet TAGGO. Il touche six domaines :

1. **Récupération de mot de passe** (nouveau parcours complet)
2. **Profil utilisateur** (nouvelle feature verticale complète)
3. **Commandes et réservation de TAGGO** (nouvelle feature verticale complète)
4. **Cycle de vie TAGGO** (durcissement du modèle d'état + horodatages)
5. **Sécurité et robustesse** (open redirect, propriété des données)
6. **Infrastructure Supabase** (migrations versionnées, RLS, RPC)

Aucun secret n'a été trouvé dans les fichiers à commiter. `.env.example` ne contient plus que des valeurs vides.

---

## 1. Récupération de mot de passe (nouveau)

Parcours d'authentification complet, de la demande de lien à la mise à jour du mot de passe.

- `src/features/auth/AuthRepository.ts` — l'interface gagne deux méthodes : `requestPasswordReset(email)` et `updatePassword(password)`. Les deux sont implémentées dans les trois implémentations (Supabase, locale, indisponible), donc le contrat reste total.
- `src/features/auth/SupabaseAuthRepository.ts` — implémentation réelle via `auth.resetPasswordForEmail` avec `redirectTo` construit par `buildAuthRedirectUrl('/reset-password')`, et `auth.updateUser({ password })`.
- `src/features/auth/LocalAuthRepository.ts` — lève une erreur explicite : la functionality est réservée à Supabase Auth.
- `src/context/AuthContext.tsx` / `authContextValue.ts` — exposition de `requestPasswordReset` et `updatePassword` dans le contexte.
- `src/pages/PasswordResetPage.tsx` (nouveau) — formulaire email, refuse de fonctionner hors mode `supabase`, message volontairement neutre (« Si ce compte existe… ») pour ne pas révéler l'existence d'un compte.
- `src/pages/PasswordUpdatePage.tsx` (nouveau) — nouveau mot de passe + confirmation, validation via `isValidPassword`, puis redirection vers `/login` avec un state `passwordUpdated`.
- `src/pages/LoginPage.tsx` — le lien « Mot de passe oublié ? » n'apparaît qu'en mode `supabase`.
- `src/features/auth/SupabaseAuthRepository.test.ts` (nouveau) — 5 tests sur les deux nouveaux appels.

**Point d'attention** : `PasswordUpdatePage` redirige vers `/login` après succès, ce qui force l'utilisateur à se reconnecter. C'est un choix cohérent (Supabase invalide la session lors d'un changement de mot de passe par email), mais le state `passwordUpdated` n'est pas consommé par `LoginPage` — aucun message de confirmation ne s'affiche. Amélioration possible.

---

## 2. Profil utilisateur (nouvelle feature)

Pattern d'architecture respecté : interface + deux implémentations + factory.

- `src/features/profile/ProfileRepository.ts` (nouveau) — interface `getCurrentProfile` / `updateCurrentProfile`.
- `src/features/profile/profileTypes.ts` (nouveau) — type `TaggoProfile` (prénom, nom, nom d'affichage, email) et `UpdateTaggoProfileInput`.
- `src/features/profile/LocalProfileRepository.ts` (nouveau) — persiste dans `localStorage` sous `taggo-demo-profile`, avec repli sur le nom complet de l'utilisateur démo si aucune donnée n'est stockée. Décompose le `fullName` en prénom / nom au premier accès.
- `src/features/profile/SupabaseProfileRepository.ts` (nouveau) — lit et écrit la table `profiles`. Fait du **lazy provisioning** : si la ligne n'existe pas encore, elle l'insère depuis `auth.user_metadata.full_name`. L'écriture se fait par `upsert` sur `id`, et `full_name` est recalculé à partir de prénom + nom.
- `src/features/profile/repository.ts` (nouveau) — factory. À noter : contrairement aux autres repositories, le mode démo est conditionné par `import.meta.env.DEV` et non par `import.meta.env.PROD`, ce qui est cohérent avec `AuthContext` (voir section 7).
- `src/features/profile/profileRepository.test.ts` (nouveau) — 3 tests.

Côté UI :

- `src/context/AuthContext.tsx` — nouveau state `profile` / `profileLoading`, chargé dès que `user` est présent, avec garde anti-`setState` après unmount. Expose `updateProfile`.
- `src/pages/SettingsPage.tsx` — la section « Profil » n'est plus un placeholder : formulaire prénom / nom / nom d'affichage, valeurs sanitizées et tronquées (80 / 80 / 120 caractères), enregistrement avec message de succès ou d'erreur.
- `src/pages/DashboardPage.tsx` — affiche le `displayName` du profil devant l'email dans l'en-tête.

---

## 3. Commandes et réservation de TAGGO (nouvelle feature)

Feature la plus volumineuse : gestion du cycle commande → réservation → assignation.

- `src/features/orders/orderTypes.ts` (nouveau) — `OrderStatus` (`draft`, `pending`, `ready_for_assignment`, `assigned`, `cancelled`), `Order`, `OrderItem`, `OrderDetails`, `OrderSummary`.
- `src/features/orders/OrderRepository.ts` (nouveau) — interface avec 6 méthodes. Le paramètre `ownerId` est explicitement documenté comme faisant partie du contrat pour permettre à l'implémentation Supabase de s'appuyer sur la RLS.
- `src/features/orders/LocalOrderRepository.ts` (nouveau) — stockage `localStorage` (`taggo-demo-orders`, `taggo-demo-order-items`). Points notables :
  - `reserveTaggo` est **idempotent** : si la commande a déjà un TAGGO réservé, il le renvoie au lieu d'en réserver un second.
  - La sélection du TAGGO disponible est le premier `available` sans propriétaire, par ordre du store.
  - `assignTaggo` refuse si le TAGGO a déjà un autre propriétaire, ou s'il n'est pas en état `reserved`.
  - `newId()` utilise `crypto.randomUUID()` avec repli sur une chaîne aléatoire.
- `src/features/orders/SupabaseOrderRepository.ts` (nouveau) — `createOrder`, `reserveTaggo` et `assignTaggo` passent par RPC (voir section 6) ; lecture et mise à jour du statut passent par PostgREST. Toutes les requêtes sont filtrées par `customer_id` quand `ownerId` est fourni.
- `src/features/orders/repository.ts` (nouveau) — factory. **Incohérence** : ici la factory utilise `import.meta.env.PROD` (comme l'ancienne version de celle de `auth`), alors que `profileRepository` et `AuthContext` utilisent `import.meta.env.DEV`. Le comportement réel est le même dans les deux cas, mais la lecture du code est trompeuse. À harmoniser.
- `src/features/orders/orderRepository.test.ts` (nouveau) — 18 tests, la plus grande suite ajoutée.

---

## 4. Cycle de vie TAGGO (durcissement)

- `src/features/qr/taggoLifecycle.ts` (nouveau) — table de transitions autorisées, source de vérité du modèle d'état, avec `canTransitionTaggo` et `assertTaggoTransition`. Le graphe est volontairement strict : `replaced` et `cancelled` sont des états terminaux (aucune sortie).
- `src/features/qr/taggoLifecycle.test.ts` (nouveau) — 3 tests sur le graphe.
- `src/features/qr/qrTypes.ts` — ajout de deux états, `expired` et `suspended`. Ajout des timestamps `reservedAt`, `assignedAt`, `activatedAt` à `QrRecord`.
- `src/features/qr/qrTypes.ts` — **changement de sécurité** : `UpdateQrInput` ne contient plus `ownerId`. Un utilisateur ne peut donc plus transférer la propriété d'un TAGGO via une mise à jour classique. La propriété ne se change plus que via `assignTagToUser` ou `assignTaggo`.
- `src/features/qr/QrRepository.ts` — l'interface gagne `transition(id, to, ownerId?)` et `assignTagToUser(id, ownerId)`.
- `src/features/qr/LocalQrRepository.ts` — `update` valide désormais les transitions de cycle de vie avant d'écrire, et n'écrit plus `ownerId`. `activate` ne réécrit plus via `update` (il le faisait avant, ce qui forçait `status: 'active'`), il écrit directement en état `activated` / `status: 'draft'`. `activate` refuse aussi si le propriétaire est quelqu'un d'autre. Nouvelle méthode `transition` qui pose le timestamp correspondant à chaque état. Nouvelle méthode `assignTagToUser` qui refuse un TAGGO déjà possédé.
- `src/features/qr/qrStore.ts` — les trois timestamps sont persistés.
- `src/features/qr/SupabaseQrRepository.ts` — mappings des nouveaux timestamps, `transition` et `assignTagToUser` delegate aux RPC `transition_taggo` et `assign_taggo_to_user`.
- `src/features/qr/repository.ts` — l'implémentation « unavailable » gagne les deux méthodes.

### Changement de sémantique important

Avant : `activate()` mettait le TAGGO en `lifecycleStatus: 'active'` et `status: 'active'`.
Après : `activate()` met en `lifecycleStatus: 'activated'` et `status: 'draft'`.

L'activation est donc devenue une étape distincte de la mise en service. C'est cohérent avec le modèle commercial (un TAGGO activé n'est pas encore publié), mais **c'est un changement cassant** pour tout code ou test qui attendait `active`. Le test correspondant a été mis à jour (`qrRepository.test.ts`). À vérifier côté back-office / outils tiers s'ils consomment ce champ.

---

## 5. Sécurité et robustesse

- `src/lib/runtime.ts` — nouvelle fonction `getSafeAuthDestination`. Correction d'une **open redirect** : `LoginPage` et `RegisterPage` acceptaient `?returnTo=` dès que la valeur commençait par `/`, ce qui acceptait `//evil.example` (protocole relatif). La nouvelle fonction :
  - rejette tout ce qui ne commence pas par `/` ;
  - rejette `//` (open redirect) ;
  - n'autorise que `/dashboard`, `/dashboard/*` et `/activate/*` ;
  - retourne `/dashboard` par défaut.
- `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx` — utilisation de `getSafeAuthDestination`.
- `src/lib/runtime.test.ts` — 3 tests ajoutés couvrant précisément ces cas.
- `src/lib/demoAuth.ts` — export de `DEMO_USER_IDS` (`demo-user`, `test-user`) comme constantes partagées. `seedDemoUsers` a été réécrit : il ne se contente plus d'amorcer un store vide, il **réconcilie** les identifiants des comptes de démo à chaque appel, ce qui corrige les profilsersistés avant ce changement (leurs IDs étaient générés aléatoirement et ne correspondaient plus à `demo-user`). Le store n'est écrit que si quelque chose a réellement changé.
- `src/features/qr/qrStore.ts` — les données de seed utilisent `DEMO_USER_IDS.demo` au lieu de la chaîne littérale, ce qui garantit la correspondance avec `seedDemoUsers`.
- `src/features/auth/authRepository.test.ts` et `src/features/qr/qrRepository.test.ts` — assertions sur les IDs canoniques.
- `src/features/qr/LocalQrRepository.ts` / `SupabaseQrRepository` — la propriété ne peut plus être modifiée par une mise à jour (voir section 4).

---

## 6. Infrastructure Supabase

### `supabase/schema.sql` (modifié, +256 lignes)

- Trois colonnes ajoutées à `qr_codes` : `reserved_at`, `assigned_at`, `activated_at`.
- Contrainte `qr_codes_lifecycle_status_check` étendue avec `expired` et `suspended`.
- `taggo_assignments.external_order_id` : `not null unique` → `unique` (la colonne est maintenant optionnelle au profit du nouvel `order_id`).
- Nouvelles tables `orders` et `order_items`, avec index et index unique partiel sur `taggo_id` (un TAGGO ne peut appartenir qu'à une seule ligne de commande active).
- Nouvelle colonne `taggo_assignments.order_id`.
- `activate_taggo` : passe de `active`/`active` à `activated`/`draft`, et pose `activated_at`.
- `assign_taggo_to_customer` : pose `assigned_at`.
- `provision_taggo_stock` : pose `reserved_at`.
- Nouvelles fonctions `security definer` :
  - `assign_taggo_to_user(uuid)` — assigne un TAGGO `available`/`reserved` sans propriétaire à l'utilisateur courant.
  - `transition_taggo(uuid, text)` — implémente le même graphe de transitions que le TypeScript, **avec vérification de propriété** (`q.owner_id = auth.uid()`).
  - `create_order()` — crée une commande `draft` pour l'utilisateur courant.
  - `reserve_taggo_for_order_id(uuid)` — réservation idempotente avec `for update skip locked` (protection contre la double réservation concurrente).
  - `assign_taggo_to_order_customer(uuid, uuid)` — vérifie la propriété de la commande, passe l'assignation à `assigned`, puis le TAGGO.
- Grants : les 5 nouvelles fonctions sont `revoke`d à `public`/`anon` puis `grant`ées à `authenticated`.
- RLS activée sur `orders` et `order_items`, avec 5 policies sur `orders` (select / insert avec `status = 'draft'` / update / delete) et 1 sur `order_items` (select).

**Point d'attention** : `transition_taggo` duplique le graphe de transitions défini dans `taggoLifecycle.ts`. Les deux doivent rester synchronisés manuellement — c'est un risque de divergence à long terme.

### `supabase/migrations/` (nouveau, 5 migrations)

Le schéma est désormais versionné, ce qui le rend applicable via `supabase db push` :

| Migration | Contenu |
| --- | --- |
| `20260922000000_initial_schema.sql` | Schéma de base |
| `20260922001000_profile_identity_fields.sql` | Champs d'identité du profil (prénom, nom, nom d'affichage) |
| `20260922002000_taggo_lifecycle.sql` | Cycle de vie TAGGO |
| `20260928003000_assign_taggo_to_user.sql` | RPC `assign_taggo_to_user` |
| `20260928004000_orders.sql` | Tables orders / order_items et RPC associées |

- `supabase/config.toml` (nouveau) — configuration CLI Supabase, avec `site_url` et `additional_redirect_urls` pointant sur le dev local Vite.

**Point d'attention** : les migrations 1 et 2 datent du 22/09, la 3 du 28/09, alors que le travail est toujours non commité. Il est probable qu'un environnement Supabase ait déjà été provisionné manuellement depuis `schema.sql`. Si les migrations sont appliquées sur une base déjà à jour, elles entreront en conflit. À valider sur le staging avant push.

---

## 7. Routage, modes d'exécution et contenu

- `src/features/auth/authTypes.ts` — nouveau type `AuthMode = 'demo' | 'supabase' | 'unavailable'`.
- `src/context/AuthContext.tsx` — introduction du mode explicite. Avant, le choix se faisait sur `isSupabaseConfigured` puis sur `import.meta.env.PROD`. La nouvelle logique :
  - `supabase` si configuré ;
  - `demo` sinon, **en développement uniquement** ;
  - `unavailable` sinon.
  Les pages peuvent donc se fier à `mode` plutôt qu'à `isSupabaseConfigured` ou à `import.meta.env.DEV`. C'est une amélioration de lisibilité.
- **Correction de course au démarrage** : le repository d'auth exporte maintenant `authMode` au niveau du module, ce qui évite une dépendance circulaire entre `AuthContext` et `supabase`. L'initialisation de session a aussi été réordonnée : l'abonnement `onAuthStateChange` est installé **avant** `getSession()`, et un événement reçu pendant la restauration est mémorisé puis prioritaire sur le résultat de `getSession()`. Auparavant, un événement de session qui arrivait pendant la restauration pouvait être écrasé par le `setUser` de `restoreSession`, provoquant un état d'authentification incohérent au premier rendu.
- `src/app/router.tsx` — la route `/` pointe désormais sur `LandingPage` au lieu de rediriger vers login/dashboard. Suppression du composant `AppEntry`. Nouvelles routes : `/forgot-password`, `/reset-password`, `/legal/terms`, `/legal/privacy`, `/legal/notice`, `/contact`.
- `src/pages/PublicInfoPage.tsx` (nouveau) — page unique paramétrée par `page`, servant les 4 pages légales. **Contenu volontairement provisoire** : chaque page indique que le texte sera publié avant l'ouverture commerciale.
- `src/features/landing/LandingFooter.tsx` — les 4 liens légaux passent de `href="#"` à de vraies routes, et les balises `<a>` deviennent des `<Link>` (navigation SPA). Ajout d'un lien Contact.
- `src/features/landing/FaqSection.tsx` — réponses réécrites : le suivi des scans et les modalités d'abonnement ne sont plus annoncés comme disponibles.
- `src/features/landing/SecuritySection.tsx` — la promesse sur les « statistiques » du tableau de bord est retirée.
- `src/pages/LoginPage.tsx` — bascule sur `mode === 'demo'` pour l'affichage des comptes de démonstration, ajout d'un avertissement explicite « Mode démonstration locale uniquement. Aucun compte réel ne doit être utilisé ici. ».
- `.env.example` — valeurs placées à vide, plus de placeholder `https://your-project.supabase.co`, plus de commentaire sur l'anon key.

Cette section correspond à une **réserve commerciale** : le produit est présenté sans engagement commercial et sans promesse de fonctionnalité non livrée.

---

## 8. Documentation

- `docs/deployment.md` (nouveau) — cibles Vercel (principal) et GitHub Pages (secours), séparation stricte staging / production Supabase, configuration Vercel Preview vs Production, et avertissement explicite qu'aucune ressource distante n'est déployée automatiquement.

---

## Résumé des tests

127 tests passent, dont environ 35 ajoutés :

| Fichier | Tests ajoutés |
| --- | --- |
| `src/features/orders/orderRepository.test.ts` | 18 (nouveau) |
| `src/features/qr/qrRepository.test.ts` | ~11 |
| `src/features/auth/SupabaseAuthRepository.test.ts` | 5 (nouveau) |
| `src/features/profile/profileRepository.test.ts` | 3 (nouveau) |
| `src/features/qr/taggoLifecycle.test.ts` | 3 (nouveau) |
| `src/lib/runtime.test.ts` | 3 |

Couverture notable côté sécurité et cycle de vie :

- refus d'activation d'un TAGGO inexistant, non assigné, déjà activé, ou par un non-propriétaire ;
- refus de steal d'un TAGGO déjà assigné à un autre utilisateur ;
- refus d'une transition interdite (`active` → `available`) ;
- impossibilité de changer la propriété via `update` ;
- open redirect (`https://evil.example`, `//evil.example`).

---

## Points à traiter

1. **Ordre des migrations** — vérifier sur staging que les 5 migrations s'appliquent proprement sur une base déjà provisionnée depuis `schema.sql`.
2. **`passwordUpdated` non consommé** — `PasswordUpdatePage` passe ce state à `/login`, mais `LoginPage` ne l'affiche pas.
3. **Graphe de transitions dupliqué** — `taggoLifecycle.ts` et la fonction SQL `transition_taggo` doivent être maintenus ensemble manuellement.
4. **Incohérence de factory** — `src/features/orders/repository.ts` utilise `import.meta.env.PROD` là où `src/features/profile/repository.ts` et `AuthContext` utilisent `import.meta.env.DEV`. Comportement identique, lecture trompeuse.
5. **Changement cassant `activate()`** — le statut retourné passe de `active` à `activated`. À propager si d'autres consommateurs lisent ce champ.
6. **4 warnings `oxlint`** — deux `set-state-in-effect` (`AuthContext.tsx:83`, `SettingsPage.tsx:18`) et deux `only-export-components` (`AuthContext.tsx`). Non bloquants.
7. **Bundle à 1 372 kB** — avertissement Vite au-delà de 500 kB. Un code-splitting serait utile avant la commercialisation.
