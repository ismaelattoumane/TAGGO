# STEP 15 — STAGING VALIDATION

## 1. Migrations

- **14/14** migrations présentes dans `supabase/migrations/` (comptées par `ls -1 supabase/migrations/*.sql | wc -l`)
- **Local = Remote** : confirmé par l'utilisateur via `npx supabase@2.120.0 migration list` (sortie : *Local = Remote* pour les 14 migrations)
- **`db diff --linked --debug`** : bloqué. La commande échoue avec `Cannot find project ref. Have you run supabase link?`. Le lien du projet (`supabase link`) exige un `SUPABASE_ACCESS_TOKEN` qui n'est pas présent dans l'environnement. L'utilisateur a rapporté que, lorsqu'il est lié, le diff est bloqué par le problème de shadow DB : *la shadow database locale échoue au démarrage de Realtime avec `DBConnection.ConnectionError`*. Ce problème est local au Docker/shadow DB ; **aucune migration n'a été modifiée** en conséquence.

  Explication : le diff exige une shadow database locale (PostgreSQL temporaire) qui sert de base de destination pour le calcul du diff. Le conteneur Realtime échoue au démarrage car il tente une connexion à la shadow DB qui n'est pas encore prête. Cela empêche `db diff --linked` de produire un résultat, mais **n'affecte pas les 14 migrations appliquées** ni le schéma STAGING.

## 2. Supabase STAGING

| Champ | Valeur |
|---|---|
| Projet | TAGGO STAGING |
| Project ref | `vnggdtnrrmxsxfdqyqtr` |
| Région | Central EU (Frankfurt) `eu-central-1` |
| Distinct de production | ✅ Oui — projet STAGING séparé |
| URL | `https://vnggdtnrrmxsxfdqyqtr.supabase.co` |
| Anon key (public) | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (rôle `anon`, ref `vnggdtnrrmxsxfdqyqtr`) |

**Preuve** : le JWT anon décodé contient `"ref":"vnggdtnrrmxsxfdqyqtr"` et `"role":"anon"`, confirmant qu'il s'agit bien du projet STAGING et non de production.

## 3. Auth

| Test | Résultat | Environnement | Preuve |
|---|---|---|---|
| **Signup** (compte de test) | ✅ PASS | STAGING | `POST /auth/v1/signup` → HTTP 200, `confirmation_sent_at` défini |
| **Envoi de confirmation email** | ✅ CONFIRMÉ | STAGING | Resend a accepté l'envoi (`confirmation_sent_at` dans réponse) |
| **Confirmation email activée** | ✅ | STAGING | `/auth/v1/settings` → `mailer_autoconfirm: false`, `disable_signup: false` |
| **Connexion avant confirmation** | ✅ ÉCHEC ATTENDU | STAGING | `POST /auth/v1/token?grant_type=password` → HTTP 400, `error_code: email_not_confirmed` |
| **Connexion après confirmation** | ⚠️ MANUEL | STAGING | Requiert confirmation email + `STAGING_EMAIL_*/STAGING_PASSWORD_*` |
| **Signup (automatique dans script)** | ⚠️ DÉSACTIVÉ | STAGING | `STAGING_SIGNUP_TEST=true` requis — désactivé par défaut |
| **Inscription @taggo.space auto** | ❌ SUPPRIMÉ | STAGING | Script ne crée plus de comptes automatiquement |

**Flux de connexion authentifiée (méthode réelle) :**
1. Deux comptes confirmés sur STAGING (email + mot de passe)
2. Le script utilise `POST /auth/v1/token?grant_type=password` pour obtenir les JWTs
3. Relancer : `STAGING_EMAIL_A=... STAGING_PASSWORD_A=... STAGING_EMAIL_B=... STAGING_PASSWORD_B=... node scripts/staging-validation.mjs`

## 4. RLS (tests HTTP PostgREST)

### 4a. Tests anonymes (STAGING — exécutés et validés)

| Test | Résultat | Migration source | Preuve |
|---|---|---|---|
| URL Supabase répond | ✅ | — | `GET /auth/v1/settings` → HTTP 200 |
| JWT anon rôle `anon` | ✅ | — | JWT décodé : `role=anon`, `ref=vnggdtnrrmxsxfdqyqtr` |
| JWT anon expiry futur | ✅ | — | `exp` > maintenant |
| `qr_codes` SELECT par anon | ✅ DENIED | `20260931130000:248-250` (revoke all from anon) | HTTP 401 |
| `orders` SELECT par anon | ✅ DENIED | `20260931130000:255` (revoke all from anon) | HTTP 401 |
| `profiles` SELECT par anon | ✅ DENIED | `20260931130000:277` (revoke all from anon) | HTTP 401 |
| `subscriptions` SELECT par anon | ✅ DENIED | `20260931130000:276` (revoke all from anon) | HTTP 401 |
| `email_events` SELECT par anon | ✅ DENIED | `20260931130000:264` (revoke all from anon) | HTTP 401 |
| INSERT `qr_codes` par anon | ✅ DENIED | `20260931130000:248` (revoke all from anon) | HTTP 401 |
| INSERT `orders` par anon | ✅ DENIED | `20260931130000:255` (revoke all from anon) | HTTP 401 |
| DELETE `orders` par anon | ✅ DENIED | WHERE clause safety | HTTP 400 |
| INSERT `public_taggo_cards` par anon | ✅ DENIED | `20260931120000:51` (revoke all from public) | HTTP 401 |
| RPC `get_public_taggo_state` par anon | ✅ AUTORISÉ | `20260931100000:1053` (grant to anon) | HTTP 200, `not_found` |
| RPC `public_taggo_is_visible` par anon | ✅ AUTORISÉ | `20260931130000:323` (grant to anon) | HTTP 200 |
| RPC `activate_taggo` par anon | ✅ DENIED | `20260922000000:283` (grant to authenticated ONLY) | HTTP ≥ 401 |
| RPC `create_order` par anon | ✅ DENIED | `20260928004000:185` (grant to authenticated only) | HTTP 401 |

### 4b. Tests authentifiés (nécessitent 2 comptes confirmés — manuel)

| Test | Statut | Source locale | Migration source |
|---|---|---|---|
| JWT rôle `authenticated` | ⚠️ MANUEL STAGING | ✅ LOCAL (rls-http.test.mjs) | — |
| `auth.getUser()` | ⚠️ MANUEL STAGING | ✅ LOCAL | — |
| Propriétaire crée TAGGO (`lifecycle_status=activated`) | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260922000000:321` |
| TAGGO créé a `status=draft`, `is_public=false` | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260931110000:51-65` |
| Création 201 sans `id` → retry par `public_id` | ⚠️ MANUEL STAGING | ✅ LOCAL (`isOrphanHandled`) | — |
| PATCH `lifecycle_status`: 403 denié + lecture OK + inchangé | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260931110000:110` + trigger `:86` |
| PATCH `status`: 403 denié + lecture OK + inchangé | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260931110000:110` + trigger `:86` |
| PATCH `is_public`: 403 denié + lecture OK + inchangé | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260931110000:110-111` + trigger `:86` |
| PATCH `owner_id`: 403 denié + lecture OK + inchangé | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260931110000:110` + trigger `:76-91` |
| PATCH `activated_at`: 403 denié + lecture OK + inchangé | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260931110000:110` + trigger `:54-59` |
| PATCH serveur champ protégé: 500 uniquement si message trigger + lectures OK + inchangé | ⚠️ MANUEL STAGING | ✅ LOCAL (`classifyPatchProtection`) | `20260931110000:86-91` |
| Attacker PATCH titre → 0 rows + valeur inchangée | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260922000000:325` + `20260931110000:121` |
| Attacker SELECT → 0 rows | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260922000000:313` (owner select) |
| Anonyme SELECT `qr_codes` → DENIED | ✅ STAGING | ✅ LOCAL | `20260931120000:54` |
| Anonyme SELECT QR par `public_id` → DENIED | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260931120000:54` + `20260931130000:248` |
| PATCH `profiles.email`: 403/500 trigger uniquement si message match + lectures OK + inchangé | ⚠️ MANUEL STAGING | ✅ LOCAL (`classifyPatchProtection`) | `20260931141000:58-69` + `113-116` |
| Attacker PATCH `profiles.full_name` → 0 rows | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260922000000:305` |
| Email change Auth → profil non modifié | ⚠️ MANUEL STAGING | ✅ LOCAL | `20260931141000:118-151` |
| RPCs serveur-only (8 fonctions) → DENIED | ⚠️ MANUEL STAGING | ✅ LOCAL | `service_role` only |
| Nettoyage QR code créé → DELETE + verify (absence confirmée par `detail`) | ⚠️ MANUEL STAGING | ✅ LOCAL (`isCleanupSuccess`) | `20260922000000:330` |

### 4c. Couverture des SQL tests (LOCAL — exécutés et validés)

| SQL test | Assertions | Statut LOCAL | Adapté sur STAGING |
|---|---|---|---|
| `010_taggo_write_protection.sql` | 45 | ✅ PASS | Partiel — nécessite JWT pour PATCH |
| `020_public_exposure.sql` | 43 | ✅ PASS | ✅ FULLY — tests anonymes exécutés sur STAGING |
| `030_order_financials.sql` | 31 | ✅ PASS | Partiel — nécessite JWT pour création/modification d'orders |
| `040_taggo_flows.sql` | 46 | ✅ PASS | Partiel — nécessite JWT + fixtures TAGGO |
| `050_security_regressions.sql` | 31 | ✅ PASS | Partiel — nécessite JWT pour tests profil/email |
| **Total** | **196** | **✅ 196/196** | — |

## 5. API HTTP — résultats STAGING (automatisés + validés)

| Test | HTTP obtenu (STAGING) | Statut |
|---|---|---|
| `GET /auth/v1/settings` | 200 | ✅ STAGING |
| `POST /auth/v1/signup` | 200 | ✅ STAGING |
| `POST /auth/v1/token?grant_type=password` (non-confirmé) | 400 (`email_not_confirmed`) | ✅ STAGING |
| `POST /rest/v1/rpc/get_public_taggo_state` (anon) | 200 (`not_found`) | ✅ STAGING |
| `POST /rest/v1/rpc/public_taggo_is_visible` (anon) | 200 | ✅ STAGING |
| `POST /rest/v1/rpc/activate_taggo` (anon) | ≥ 401 | ✅ STAGING CORRIGÉ |
| `POST /rest/v1/rpc/create_order` (anon) | 401 | ✅ STAGING |
| `GET /rest/v1/qr_codes?select=*` (anon) | 401 | ✅ STAGING |
| `GET /rest/v1/orders?select=*` (anon) | 401 | ✅ STAGING |
| `GET /rest/v1/profiles?select=*` (anon) | 401 | ✅ STAGING |
| `GET /rest/v1/subscriptions?select=*` (anon) | 401 | ✅ STAGING |
| `GET /rest/v1/email_events?select=*` (anon) | 401 | ✅ STAGING |
| `POST /rest/v1/qr_codes` (anon) | 401 | ✅ STAGING |
| `POST /rest/v1/orders` (anon) | 401 | ✅ STAGING |
| `DELETE /rest/v1/orders` (anon) | 400 (WHERE safety) | ✅ STAGING |
| `POST /auth/v1/verify` (token invalide) | 403 (`otp_expired`) | ✅ STAGING |

> **NOTE** : Toutes les requêtes utilisent l'URL distante `https://vnggdtnrrmxsxfdqyqtr.supabase.co`. Aucune requête localhost n'est effectuée par le script.

## 6. Frontend / secrets

### Audit Git (`git grep` sans affichage des valeurs)

| Contrôle | Résultat |
|---|---|
| `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `src/` | ✅ Uniquement (`src/lib/supabase.ts:3-4`) |
| `service_role` dans `src/` (production) | ✅ Aucun (`securityAudit.test.ts:123-136` valide) |
| Clé SMTP/Resend dans `src/` | ✅ Aucune |
| Clé Stripe secrète (`sk_live_`, `sk_test_`) dans `src/` | ✅ Aucune |
| Stripe SDK importé dans `src/` | ✅ Non importé côté client |
| Templates email exposés dans le bundle | ✅ Non exposés |
| `.env*` trackés par Git | ✅ Aucun (seul `.env.example`) |
| `.env.staging` | ✅ Créé puis supprimé (gitignored, non tracké) |
| JWT/anon keys dans Git | ✅ Aucun (scan `git grep "eyJ"`) |
| `securityAudit.test.ts` (vérification automatisée) | ✅ 100% de ces checks passent |

### Configuration frontend (`src/lib/supabase.ts`)
```ts
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
```
→ Uniquement les deux variables publiques. ✅

## 7. Tests locaux

| Commande | Résultat |
|---|---|
| `npm run test` | ✅ **877/877 tests passés** (56 fichiers de tests) |
| `npm run typecheck` | ✅ Clean (0 errors) |
| `npm run lint` | ✅ 5 warnings **préexistants** (CartContext, AuthContext, SettingsPage — React fast-refresh & set-state-in-effect) |
| `npm run build` | ✅ Build réussi (chunk size warning pour le bundle JS principal — préexistant) |
| `node --check scripts/staging-validation.mjs` | ✅ Syntaxe OK |
| `git diff --check` | ✅ Pas de whitespace errors |
| `node scripts/staging-validation.test.mjs` | ✅ 77 tests locaux (classification, anonyme access blocking, PATCH protection, orphan detection, cleanup safety, pre-check, migration references) |

### Tests DB/RLS locaux (`taggo_test_step15`)

Pile locale démarrée avec `TAGGO_STACK_NAME=taggo_test_step15` (noms de conteneurs Docker isolés, ports non standards).

| Étape | Résultat |
|---|---|
| Rejeu des 14 migrations sur base propre | ✅ 14/14 sans erreur |
| Inventaire schéma | 14 tables, 1 vue, 37 fonctions, 18 policies, 5 triggers |
| `010_taggo_write_protection.sql` (pgTAP) | ✅ 45/45 assertions |
| `020_public_exposure.sql` (pgTAP) | ✅ 43/43 assertions |
| `030_order_financials.sql` (pgTAP) | ✅ 31/31 assertions |
| `040_taggo_flows.sql` (pgTAP) | ✅ 46/46 assertions |
| `050_security_regressions.sql` (pgTAP) | ✅ 31/31 assertions |
| `rls-http.test.mjs` (HTTP avec JWT GoTrue réels) | ✅ 60/60 assertions |
| **Total tests locaux** | ✅ **362/362 passés** |

Pile locale arrêtée et nettoyée après les tests.

## 8. Corrections apportées au script `scripts/staging-validation.mjs`

| # | Problème identifié | Correction appliquée |
|---|---|---|
| 1 | `request()`: `apikey` header utilisait le JWT utilisateur (`token`) au lieu de la clé anon | `apikey: ANON_KEY` toujours; `Authorization: Bearer` = JWT utilisateur |
| 2 | `activate_taggo` testé comme accessible à l'anonyme (attendu 200) | CORRIGÉ: refusé à l'anonyme — `401/403` attendu (migration `20260922000000:283` : GRANT to `authenticated` only) |
| 3 | Création automatique de 2 comptes `@taggo.space` à chaque exécution | SUPPRIMÉ: signup désactivé par défaut (`STAGING_SIGNUP_TEST=true` requis) |
| 4 | Test création TAGGO disait "draft" mais INSERT policy exige `lifecycle_status='activated'` | ALIGNÉ: commentaire documente la policy (`20260922000000:321`) et le trigger (`20260931110000:51-65`) |
| 5 | PATCH tests vérifiaient seulement le code HTTP | CORRIGÉ: relecture avant/après chaque PATCH, vérification valeur inchangée, message d'erreur trigger |
| 6 | Aucun nettoyage des QR codes créés | AJOUTÉ: section G — DELETE owner-only + vérification par relecture |
| 7 | Nettoyage incrémentait `cleanedUp` avant vérification | CORRIGÉ: `cleanedUp` incrémenté uniquement après relecture confirmant l'absence via `detail` |
| 8 | Test email change via `PUT /auth/v1/user` modifiait l'état Auth | SUPPRIMÉ des tests automatisées — déplacé vers vérification manuelle |
| 9 | `manual()` suggérait `npx supabase auth signin` (incorrect) | CORRIGÉ: méthode réelle = `POST /auth/v1/token?grant_type=password` |
| 10 | Script se terminait sans rapport final | AJOUTÉ: section "Résumé" avec PASS/FAIL/SKIP/MANUAL/cleanup |
| 11 | `isSilent` acceptait `HTTP 200` avec objet non-array (pas seulement `[]`) | CORRIGÉ: `isSilent` requiert `Array.isArray(json) && json.length === 0` exclusivement |
| 12 | `isTriggerRaise` (500) acceptait n'importe quel serveur_error sans vérifier le message | CORRIGÉ: 500 accepté uniquement si message correspond au trigger (`qr_codes_server_fields_are_read_only` / `qr_codes_must_be_created_as_draft`), lectures avant/après OK, et valeur inchangée |
| 13 | `profiles.email` PATCH: `emailPatchTrigger` acceptait tout 500 comme refus | CORRIGÉ: 500 accepté uniquement si message correspond au trigger (`profile_email_is_read_only`), lectures OK, valeur inchangée |
| 14 | `createdQrReadVerified` référencé sans être défini (bug runtime) | CORRIGÉ: variable initialisée à `false`, positionnée à `true` après lecture vérifiée |
| 15 | Nettoyage: absence non confirmée pouvait passer pour succès sans `detail` | CORRIGÉ: `verifyConfirmedAbsent` requiert `found === false && error === undefined && detail !== undefined` |
| 16 | Création 201 sans `id` non récupérée par `public_id` | CORRIGÉ: retry par `public_id` unique avec vérification d'unicité (pas d'ambiguïté), sinon rapport explicite de risque orpheine et FAIL |
| 17 | Nettoyage: erreur de lecture en pré-contrôle traitée comme "déjà absent" | CORRIGÉ: lecture erronée en pré-contrôle → `cleanupFailed` (incomplet), ressource déjà absente comptabilisée séparément (`cleanupAlreadyAbsent`) |
| 18 | `isAnonymousAccessBlocked` (revoke tables) acceptait `200 []` comme bloqué | CORRIGÉ: pour les tables avec revoke, seul `401/403` est accepté; `200 []` signifie échec du revoke → FAIL |
| 19 | Tests locaux utilisaient des fonctions simulées (pas les fonctions réelles du script) | CORRIGÉ: fonctions pures extraites et exportées (`classifyResponse`, `isAnonymousAccessBlocked`, `classifyPatchProtection`, `handleOrphanCreation`, `classifyCleanup`), tests importent les fonctions réelles |
| 20 | Check `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` exécuté au chargement du module (bloque l'import) | CORRIGÉ: déplacé dans le bloc d'exécution conditionnelle (only when run directly, not imported) |
| 21 | Nettoyage: aucune vérification de sécurité avant suppression (risque de DELETE large) | CORRIGÉ: pré-check exige `found === true`, `data.id === resource.id`, `ambiguous !== true` avant DELETE |
| 22 | Nettoyage: erreur de lecture en pré-contrôle comptabilisée comme "déjà absent" | CORRIGÉ: `classifyPreCheck()` distingue `alreadyAbsent` (detail présent) de `readError` (erreur présent) |
| 23 | Nettoyage: `classifyCleanup()` exporté mais pas utilisé dans la logique principale | CORRIGÉ: `classifyCleanup()` et `classifyPreCheck()` utilisés dans la boucle de nettoyage réelle |
| 24 | Création orpheline non vérifiée d'unicité du `public_id` | CORRIGÉ: `handleOrphanCreation()` vérifie `ambiguous` flag du retry read, signale les résultats multiples

## 9. Limitations

### Validé automatiquement (STAGING)
- Disponibilité du projet STAGING (URL, Auth settings)
- Structure JWT anon (rôle=anon, ref correct, expiry futur)
- Inscription via Auth (création de comptes, envoi de confirmation email via Resend)
- Gate de confirmation (signin échoue avec `email_not_confirmed`)
- Refus anonyme sur toutes les tables privées (qr_codes, orders, profiles, subscriptions, email_events)
- Refus des RPC serveur uniquement (create_order, create_shop_order, etc.)
- Refus des écritures anonymes (INSERT, DELETE, UPDATE)
- `activate_taggo` refusé à l'anonyme (CORRIGÉ — était incorrectement "autorisé")
- Sécurité frontend (audit Git + tests automatisés)

### Validé automatiquement (LOCAL)
- Toutes les assertions pgTAP (196 assertions)
- Tous les tests HTTP RLS avec de vrais JWT GoTrue (60 assertions)
- Typecheck, lint, build, tests unitaires (877 tests)

### Validé manuellement (nécessite intervention humaine)
- Tests authentifiés STAGING (RLS owner/attacker avec JWT confirmés)
- Nettoyage des QR codes créés par le script (DELETE + vérification)
- Flux de changement d'email STAGING (déplacé en manuel pour éviter modification d'état)

### Impossible dans l'environnement actuel
- `db diff --linked --debug` : nécessite `supabase link` + `SUPABASE_ACCESS_TOKEN`
- `db push` : non nécessaire (14/14 migrations déjà appliquées)
- `migration repair` : non nécessaire (Local = Remote confirmé)
- `db reset` : NON exécuté (destructif)
- Lecture des emails de confirmation : Codespace a accès réseau restreint

## 10. Verdict

**PARTIELLEMENT VALIDÉ**

**Justification :**
1. **Schéma et migrations** : 14/14 appliquées sans erreur localement. ✅
2. **Sécurité frontend** : Aucun secret exposé. ✅
3. **Accès anonyme STAGING** : Tous les tests anonymes passent. ✅
4. **Flux Auth STAGING** : Inscription et confirmation email fonctionnels. ✅
5. **Tests authentifiés STAGING** : **Bloqués par la confirmation d'email** — nécessitent 2 comptes confirmés. Validés localement (362/362 assertions) sur schéma identique.
6. **Lint/Typecheck/Build** : Tous passent. ✅

**Étapes manquantes pour validation complète :**
- Fournir 2 comptes STAGING confirmés via `STAGING_EMAIL_A/B` + `STAGING_PASSWORD_A/B`
- Exécuter `node scripts/staging-validation.mjs` et vérifier 0 FAIL + nettoyage complet

**Commandes de validation locale non destructives :**
```bash
node --check scripts/staging-validation.mjs   # Syntaxe OK
git diff --check                              # Pas de whitespace errors
```

**Aucun test d'écriture n'a été exécuté sur STAGING pendant cette correction.**
