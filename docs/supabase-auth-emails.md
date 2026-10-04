# Emails Supabase Auth — TAGGO

Étape 10.1. Ce document couvre **uniquement** les emails produits par
**Supabase Auth** (authentification).

> ⚠️ **Séparation stricte avec l'étape 10**
> Le système d'emails transactionnels TAGGO (`src/emails/`, table `email_events`,
> RPC `reserve_email_event` / `finalize_email_event`, template `ORDER_CONFIRMED`,
> idempotence des emails de commande) est **inchangé** par cette étape.
>
> ```
> SUPABASE AUTH                 → emails d'authentification (ce document)
> SYSTÈME EMAIL TAGGO (étape 10) → commandes / livraison / marketing
> ```
>
> Les deux chaînes ne se mélangent jamais : aucun email d'authentification ne
> transite par `email_events`, et aucun email de commande ne passe par un
> template Supabase Auth.

---

## 1. Audit initial (état avant cette étape)

Chaque point a été **vérifié dans le code**, jamais supposé.

| Élément | État constaté |
| --- | --- |
| `AuthContext` | `src/context/AuthContext.tsx` — restauration `getSession()`, abonnement `onAuthStateChange`, mode `demo`/`unavailable`/`supabase` |
| `authRepository` | `src/features/auth/authTypes.ts` (interface), `SupabaseAuthRepository.ts`, `LocalAuthRepository.ts` |
| Client Supabase | `src/lib/supabase.ts` — `persistSession`, `autoRefreshToken`, `detectSessionInUrl` |
| `/login` | `src/pages/LoginPage.tsx` — `signInWithPassword`, `returnTo` filtré |
| `/register` | `src/pages/RegisterPage.tsx` — `signUp` + `emailRedirectTo: /login` |
| `/forgot-password` | `src/pages/PasswordResetPage.tsx` — `resetPasswordForEmail` + `redirectTo: /reset-password` |
| `/reset-password` | `src/pages/PasswordUpdatePage.tsx` — `updateUser({ password })` |
| Magic Link | **Absent.** `signInWithOtp` n'est appelé nulle part dans `src/` ni `api/` |
| OAuth | **Absent.** `signInWithOAuth` absent |
| Changement d'adresse | **Absent côté front.** Aucune méthode `updateUser({ email })` |
| Confirmation email | **Implicite.** `SupabaseAuthRepository.signUp()` lève une erreur « Confirmez votre adresse email… » quand Supabase ne renvoie pas de session, ce qui **présuppose** que les confirmations sont activées. La valeur réelle n'est pas lisible dans le dépôt. |
| `supabase/config.toml` | 17 lignes : `project_id`, `[api]`, `[db]`, `[studio]`, `[auth]` (`site_url`, `additional_redirect_urls`). **Aucun** bloc `[auth.email]`, aucun template |
| `.env.example` | 3 variables seulement : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY` |
| Migrations | `20260930000000_stripe_payments.sql`, `20260930100000_email_events.sql` — aucune migration Auth |
| Tests Auth | `SupabaseAuthRepository.test.ts`, `authRepository.test.ts`, `privateSeo.test.tsx`, `App.test.tsx` |
| SMTP | **Aucun.** Pas de section `[auth.email.smtp]`, pas de secret en dur |
| Documentation Auth | **Aucune.** |

**Conclusion de l'audit** : le flux `resetPasswordForEmail → updateUser`
était fonctionnel côté code, mais (a) sans aucun template d'email personnalisé,
(b) sans configuration Auth documentée, (c) avec un message de `/forgot-password`
qui ne garantissait pas formellement l'absence d'énumération de comptes,
(d) avec les erreurs Supabase brutes affichées à l'utilisateur, (e) sans aucune
vérification sur les templates ou la configuration.

---

## 2. Flux Password Reset (prioritaire)

Flux implémenté, sans changement d'architecture :

```
Utilisateur
  → /forgot-password
  → requestPasswordReset(email)          [AuthRepository]
  → supabase.auth.resetPasswordForEmail(email, { redirectTo })
  → email Supabase (template "recovery")
  → {{ .ConfirmationURL }}
  → /reset-password
  → updateUser({ password })             [AuthRepository]
  → navigate('/login')
```

Garanties vérifiées par les tests :

- **Aucun token créé par TAGGO.** Le repository ne transmet que l'adresse et un
  chemin de redirection. Aucune table de tokens n'existe dans le dépôt.
- **Aucun token stocké par TAGGO.** `localStorage` reste vide après
  `requestPasswordReset` (`SupabaseAuthRepository.test.ts`).
- **Aucun mot de passe par email.** Ni dans les templates, ni dans la table.
- **Aucun token ni mot de passe journalisé.** `console.*` ne reçoit que des
  littéraux ou le code technique renvoyé par `safeAuthErrorLabel()`
  (`src/lib/securityAudit.test.ts`).
- **Aucune seconde implémentation maison.** Pas de RPC, pas de table, pas de
  service d'email pour l'authentification.

### États de `/forgot-password`

| État | Comportement |
| --- | --- |
| Formulaire initial | Champ email, bouton désactivé pendant l'envoi |
| Email envoyé | « Si un compte correspond à cette adresse, un email de réinitialisation vient d'être envoyé. » |
| Email inexistant | **Message identique** — aucune différence de comportement |
| Erreur réseau | Message technique (`Connexion impossible…`) |
| Anti-abus Supabase | Message technique (`Trop de demandes…`) |
| Erreur Supabase inconnue | **Message générique identique** au succès |
| Adresse invalide | « Saisissez une adresse email valide. », Supabase n'est pas appelé |
| Hors Supabase Auth | « … disponible avec Supabase Auth. » |

### États de `/reset-password`

| État | Comportement |
| --- | --- |
| Session de récupération établie | Formulaire + mention « Tu es déjà connecté » |
| Session en cours de restauration | « Vérification du lien de réinitialisation… » — ni formulaire, ni erreur |
| Token expiré / invalide | « Ce lien est invalide ou a expiré » + lien vers `/forgot-password`, **aucun formulaire** |
| Session absente | Identique au token expiré |
| Mots de passe différents | Alerte « doivent correspondre », Supabase non appelé |
| Mot de passe trop faible | Alerte « règles de sécurité », Supabase non appelé |
| Erreur `otp_expired` / `session_not_found` | « Ce lien est invalide ou a expiré… » |
| Erreur `weak_password` / `same_password` | « … règles de sécurité de TAGGO » |
| Succès | Redirection vers `/login` (remplace l'historique) |

Le message d'erreur brut de Supabase n'est **jamais** rendu : seul un code
technique documenté est traduit (`src/features/auth/authErrors.ts`).

---

## 3. Email Confirmation

**Statut : activé (à confirmer dans le Dashboard).**

Le dépôt ne peut pas lire la configuration hébergée. En revanche, le code
reflète explicitement l'hypothèse « confirmations activées » :
`SupabaseAuthRepository.signUp()` lève `EmailConfirmationRequiredError` quand
Supabase crée le compte sans renvoyer de session.

Ce message **n'apparaît jamais** quand les confirmations sont désactivées : dans
ce cas `signUp()` renvoie une session et l'utilisateur est redirigé vers
`/dashboard`. Le comportement suit donc la configuration réelle, sans l'imposer.

- Sujet : `✉️ Confirme ton adresse email TAGGO`
- Redirection après confirmation : `/login` (`emailRedirectTo`)
- Template : `supabase/templates/auth/confirmation.html` + `.txt`

---

## 4. Change Email

**Statut : template préparé, fonctionnalité non utilisée par TAGGO.**

TAGGO n'expose aujourd'hui **aucune** interface de changement d'adresse email :
`updateUser()` n'est appelé qu'avec `{ password }`. Un audit du front l'a
confirmé (aucun `email:` dans les appels `updateUser`, aucun champ email éditable
dans `SettingsPage`).

Le template `email_change` est néanmoins préparé, car c'est le seul moyen
d'avoir un rendu correct le jour où la fonctionnalité existe.

Comportement Supabase documenté, à vérifier dans le Dashboard :

| Réglage Dashboard | Comportement |
| --- | --- |
| *Confirm email change* (double confirmation) **activé** | Confirmation exigée sur la **nouvelle** adresse **et** sur l'**ancienne**. La nouvelle adresse n'est appliquée qu'après les deux confirmations. |
| *Confirm email change* **désactivé** | Seule la **nouvelle** adresse doit être confirmée. |

`supabase/config.toml` déclare `double_confirm_changes = true` (le plus strict).
Si le Dashboard diverge, c'est **le Dashboard qui fait foi** : le dépôt ne
contourne jamais la validation Supabase.

Le frontend ne permet pas de modifier directement une adresse email : toute
évolution future devra passer par `updateUser({ email })` et laisser Supabase
gérer la confirmation.

---

## 5. Magic Link

**Statut : désactivé / non utilisé.**

Vérifications effectuées :

- `signInWithOtp` : absent de `src/` et `api/`.
- Aucun template `magic_link` dans `supabase/config.toml`.
- Aucun écran ni lien « connexion sans mot de passe » dans le front.

**Rien n'a été ajouté.** Un template Magic Link serait du code mort et
n'enverrait jamais d'email. Si la fonctionnalité est ajoutée plus tard, le
template `magic_link` devra être créé au même endroit que les trois autres.

---

## 6. Templates Supabase

### Emplacement

| Template | Fichier HTML | Version texte | Sujet |
| --- | --- | --- | --- |
| Password Reset | `supabase/templates/auth/recovery.html` | `recovery.txt` | 🔑 Réinitialise ton mot de passe TAGGO |
| Email Confirmation | `supabase/templates/auth/confirmation.html` | `confirmation.txt` | ✉️ Confirme ton adresse email TAGGO |
| Change Email | `supabase/templates/auth/email_change.html` | `email_change.txt` | ✉️ Confirme ta nouvelle adresse email TAGGO |

### Variables Supabase utilisées

Seulement des variables **réellement supportées** par Supabase Auth :

| Variable | Utilisée dans | Rôle |
| --- | --- | --- |
| `{{ .ConfirmationURL }}` | les 3 templates | lien d'action (bouton + repli texte) |
| `{{ .Email }}` | recovery, confirmation | adresse du destinataire |
| `{{ .NewEmail }}` | email_change | nouvelle adresse demandée |

`{{ .Token }}` et `{{ .TokenHash }}` ne sont **pas** utilisés : ces liens sont
construits par Supabase. La liste complète des variables supportées est vérifiée
par `src/features/auth/authEmailTemplates.test.ts`.

### Version texte

Chaque template existe en **double version** :

- **`.html`** : ce que Supabase envoie (rendu Gmail / Outlook).
- **`.txt`** : la même information sans balisage — sujet, explication, lien,
  consigne de sécurité, signature. Utilisable telle quelle comme repli, et
  c'est la référence pour le corps text/plain si un fournisseur le permet.

Supabase n'expose **pas** de champ « version texte » dans son Dashboard Email
Templates : le `.txt` est donc fourni comme documentation et comme repli, pas
branché automatiquement.

### Comment les appliquer

1. **Local** (`supabase start`) : déjà branchés via `[auth.email.template.*]`
   dans `supabase/config.toml`.
2. **Production** : coller le contenu de chaque `.html` dans
   **Dashboard → Authentication → Email Templates**, avec le sujet correspondant.

---

## 7. Design TAGGO

**Identité visuelle : strictement celle du projet.** Aucune nouvelle couleur,
aucune nouvelle typographie.

| Élément | Valeur | Justification |
| --- | --- | --- |
| Fond page | `#F5E1DA` | rose pâle, palette TAGGO |
| Surface carte | `#FFFFFF` | neutre (identique au gabarit transactionnel étape 10) |
| Titres | `#0B1320` | contraste maximal |
| Texte courant | `#2B2D42` | > 12:1 sur blanc |
| Texte secondaire | `#6D597A` | > 4.5:1 sur blanc |
| Signature | `#301934` | violet profond TAGGO |
| Bouton / lien d'action | `#6F2DA8` | violet de marque |
| Bordure | `#D6A7B2` | rose TAGGO |

Un test vérifie qu'**aucune** couleur hors de cette liste n'apparaît dans les
templates (`authEmailTemplates.test.ts`).

### Caractéristiques techniques

- **HTML email classique** : tables de présentation, styles en attribut
  `style` inline, `bgcolor` en attribut sur le bouton (compatibilité Outlook).
- **Aucun JavaScript.** Aucun `<script>`, aucun attribut `on*`.
- **Aucun CSS moderne** : pas de `@media`, flexbox, grid, `position:absolute`,
  `var()`, `<style>`, `<link>`.
- **Aucune ressource externe** : pas de `<img>`, pas de police distante, pas de
  pixel de tracking. Le logo est du **texte**.
- **Responsive** : largeur fluide (`width="100%"`, `max-width:560px`), centrage,
  zones de toucher généreuses (`padding:14px 28px` sur le bouton).
- **Lien de repli** : `{{ .ConfirmationURL }}` apparaît deux fois — dans le
  `href` du bouton **et** en texte brut avec `word-break:break-all`.

### Logo

Le dépôt contient `public/logo/logo.svg` et `public/logo/wordgram.svg`, mais
**aucune URL HTTPS publique** n'est confirmée pour l'application. Les templates
utilisent donc le **fallback texte `TAGGO`** — également le choix le plus sûr,
car le SVG n'est pas rendu par Gmail et Outlook.

> **À faire avant production** : si une URL publique fiable du logo (PNG, sur
> le domaine de production) est disponible, remplacer le mot `TAGGO` par
> `<img src="…" alt="TAGGO" width="120" style="…">` avec un texte de repli.
> Ne **jamais** utiliser `/src/assets/logo.svg` : un client email ne peut pas
> accéder au filesystem de l'application.

---

## 8. Redirect URLs

### Liste blanche côté code

`buildAuthRedirectUrl()` (`src/lib/runtime.ts`) n'accepte que deux chemins :

```ts
export const AUTH_REDIRECT_PATHS = ['/login', '/reset-password'] as const
```

Tout autre chemin — origine absolue, protocole relatif, URL avec `?next=`,
`javascript:` — **lève une erreur**. L'hôte vient exclusivement de
`window.location.origin` (jamais d'une entrée utilisateur).

| Usage | Chemin | Origine |
| --- | --- | --- |
| Confirmation d'inscription | `/login` | origine courante |
| Password Reset | `/reset-password` | origine courante |
| Changement d'adresse | `/login` | origine courante |

### Protection `returnTo` (étape 4, conservée)

`getSafeAuthDestination()` continue de filtrer le `returnTo` de `/login` et
`/register` : seuls `/dashboard`, `/dashboard/*` et `/activate/*` sont acceptés.
Cette protection est **indépendante** des redirections Auth — un `returnTo`
n'entre jamais dans un `redirectTo` Supabase. Un test le vérifie explicitement.

### Configuration à effectuer dans le Dashboard

- **Site URL** : le domaine de production exact.
- **Redirect URLs** : la Site URL **plus** les origines de développement et de
  prévisualisation.

Le domaine de production **n'est pas inventé ici**. La valeur de repli présente
dans le code (`https://taggo-omega.vercel.app`) provient du dépôt et sert
uniquement quand `window` est indisponible (SSR, tests).

---

## 9. Sécurité

- **Aucun secret en Git.** Ni clé `service_role`, ni mot de passe SMTP, ni
  JWT. Un test refuse `[auth.email.smtp]` et toute clé `pass`/`password`/
  `secret` dans `supabase/config.toml`.
- **Aucune clé Supabase côté frontend.** Seules `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY` sont autorisées (test d'audit étape 9 reconduit).
- **Aucune information inutile dans les emails** : pas de mot de passe, pas de
  jeton brut, pas d'identifiant utilisateur ou de projet, pas de donnée de
  commande ou de dashboard. Le template de reset précise explicitement que le
  mot de passe actuel n'est jamais envoyé.
- **Aucune journalisation sensible.** `safeAuthErrorLabel()` ne renvoie que le
  code technique de l'erreur ; l'objet et son message ne sont jamais journalisés.
- **Anti-énumération.** Un seul et même message pour un succès, un email
  inexistant et une erreur Supabase inconnue. Les seuls messages distincts sont
  anti-abus et réseau, indépendants de l'existence du compte.
- **Validation non contournée.** Aucune fonctionnalité ne modifie une adresse
  email sans passer par le mécanisme Supabase.

---

## 10. SMTP / Provider

**Aucun fournisseur SMTP n'a été choisi ni ajouté.** Supabase Auth peut utiliser
son mécanisme d'email intégré (suffisant en développement et pour les premiers
tests). Aucun SDK (Resend, SendGrid, Brevo, Mailgun…) n'a été introduit.

Si un SMTP personnalisé est nécessaire en production, la configuration se fait
dans **Supabase Dashboard → Authentication → Email → SMTP**, jamais dans ce dépôt.
Les noms de variables dépendent de l'infrastructure réellement retenue et ne sont
donc pas inventés ici.

Emplacement des secrets : **variables d'environnement du projet Supabase**
(*Dashboard → Project Settings → API* ou *Edge Functions → Secrets*), jamais un
fichier `.env` versionné.

`supabase/config.toml` ne contient **aucune** section `[auth.email.smtp]` : c'est
exigé par le test d'audit, pour qu'aucun secret ne puisse finir dans Git.

### Test local

`supabase start` intercepte les emails Auth dans **Mailpit** :
<http://127.0.0.1:54324>. Le parcours complet `/forgot-password → email →
/reset-password` est donc testable **sans SMTP ni domaine**.

---

## 11. Frontend

### Mot de passe

| Contexte | Règle appliquée |
| --- | --- |
| `isValidPassword()` (`src/lib/validators.ts`) | ≥ 8 caractères, **une majuscule**, **un chiffre** |
| Inscription | idem |
| Reset | idem, règle affichée explicitement sous le formulaire |
| Supabase (local) | `minimum_password_length = 8` dans `config.toml` |

Les trois écrans partagent **exactement** la même fonction : aucune règle
différente n'est affichée ailleurs. `supabase/config.toml` aligne la longueur
minimale sur la valeur du front.

> **Dépendance à documenter** : les exigences *majuscule* et *chiffre* sont
> vérifiées **uniquement côté client**. Elles ne sont pas configurables dans
> Supabase Auth. La longueur minimale (8) est alignée par `config.toml`, mais la
> valeur de production doit être vérifiée dans
> **Dashboard → Authentication → Sign In / Providers → Minimum password length**.

---

## 12. Tests

Suites ajoutées ou étendues :

| Fichier | Objet |
| --- | --- |
| `src/features/auth/authErrors.test.ts` | Pas de fuite de message brut, pas d'énumération, détection des codes Auth |
| `src/features/auth/authEmailTemplates.test.ts` | Variables Supabase valides, `ConfirmationURL`, aucune URL inventée, HTML email-compatible, palette, accessibilité, version texte |
| `src/pages/passwordFlow.test.tsx` | Parcours `/forgot-password` → `/reset-password`, états, absence de messages Supabase bruts |
| `src/lib/runtime.test.ts` | Liste blanche des redirections, rejet des URL externes |
| `src/features/auth/SupabaseAuthRepository.test.ts` | Appels Supabase corrects, aucun token ni mot de passe transmis ou stocké, redirections sur origines courantes |
| `src/lib/securityAudit.test.ts` | Audit Auth : pas de SMTP en Git, méthodes Auth limitées, pas de journalisation sensible |

**Résultat : 42 fichiers, 527 tests — tous verts** (référence avant étape : 39
fichiers, 436 tests).

Les tests de l'étape 10 (`src/emails/emails.test.ts`, audit de sécurité
transactionnel, idempotence `email_events`) sont **inchangés et toujours verts**.

---

## 13. Documentation

| Document | Contenu |
| --- | --- |
| `docs/supabase-auth-emails.md` | Ce document |
| `docs/emails.md` | Emails transactionnels (étape 10) — **inchangé** |

---

## 14. Fichiers

### Créés

```
supabase/templates/auth/recovery.html
supabase/templates/auth/recovery.txt
supabase/templates/auth/confirmation.html
supabase/templates/auth/confirmation.txt
supabase/templates/auth/email_change.html
supabase/templates/auth/email_change.txt
src/features/auth/authErrors.ts
src/features/auth/authErrors.test.ts
src/features/auth/authEmailTemplates.test.ts
src/pages/passwordFlow.test.tsx
docs/supabase-auth-emails.md
```

### Modifiés

```
supabase/config.toml                            blocs [auth.email] + templates
src/lib/runtime.ts                             liste blanche AUTH_REDIRECT_PATHS
src/lib/runtime.test.ts
src/features/auth/SupabaseAuthRepository.ts     EmailConfirmationRequiredError + doc
src/features/auth/SupabaseAuthRepository.test.ts
src/context/AuthContext.tsx                    journalisation assainie
src/pages/PasswordResetPage.tsx                message générique, erreurs traduites
src/pages/PasswordUpdatePage.tsx               états du lien, erreurs traduites
src/pages/LoginPage.tsx                        erreurs traduites
src/pages/RegisterPage.tsx                     erreurs traduites
src/lib/securityAudit.test.ts                  audit Auth ajouté
```

### Non touchés (volontairement)

```
src/emails/                                     système transactionnel étape 10
api/_lib/                                       emails transactionnels
supabase/migrations/20260930100000_email_events.sql
ORDER_CONFIRMED, idempotence des emails de commande
api/stripe/*                                    hors périmètre
```

---

## 15. Configuration Supabase restant à faire

> ⚠️ **Aucune de ces actions n'a été effectuée** : je n'ai pas accès au
> Dashboard Supabase.

- [ ] **Site URL** → domaine de production
- [ ] **Redirect URLs** → Site URL + origines de dev et de prévisualisation
- [ ] **Sign In / Providers** → vérifier que *Confirm email* est **activé**
- [ ] **Sign In / Providers** → *Minimum password length* = 8 (alignement front)
- [ ] **Email Templates** → coller les 3 templates `.html` avec leurs sujets
- [ ] **Email → Sender Identity** → expéditeur `TAGGO`
- [ ] **Email → SMTP** → si le système intégré ne suffit plus
- [ ] **Email → OTP expiry** → relever la durée réelle des liens
- [ ] **Email → Confirm email change** → vérifier la valeur réelle

---

## 16. Données restant à compléter

| Donnée | Valeur actuelle | Origine |
| --- | --- | --- |
| Domaine de production | **[À DÉFINIR]** | non inventé |
| URL du logo publique | **[À DÉFINIR]** | fallback texte `TAGGO` en attendant |
| Expéditeur | `TAGGO` | nom ; adresse gérée par Supabase |
| Support | `support-taggo@protonmail.com` | déjà validé dans `src/config/business.ts` |
| Durée de vie des liens | **[À CONFIGURER DANS SUPABASE]** | `otp_expiry = 3600` en local **seulement** |
| SMTP | **[À CONFIGURER DANS SUPABASE]** | aucun choix de provider |

> **Proton Mail** : `support-taggo@protonmail.com` est une adresse de **support**
> (réponse), pas un expéditeur. Elle apparaît en pied d'email. Proton Mail n'est
> pas utilisable comme SMTP d'envoi pour Supabase sans passer par Proton
> Bridge — ce n'est pas configuré. L'expéditeur reste géré par Supabase.

> **Durée de vie** : les templates n'annoncent **aucune** durée. Le texte dit
> seulement « Ce lien est temporaire… ». Aucune valeur n'est inventée tant que la
> configuration réelle n'a pas été relevée dans le Dashboard.

---

## 17. Checklist de production

- [ ] domaine de production configuré
- [ ] Site URL configurée
- [ ] Redirect URLs configurées
- [ ] email confirmation vérifiée
- [ ] password reset vérifié
- [ ] sender configuré
- [ ] SMTP configuré si nécessaire
- [ ] SPF configuré si nécessaire
- [ ] DKIM configuré si nécessaire
- [ ] DMARC configuré si nécessaire
- [ ] tests réalisés avec une vraie adresse
- [ ] aucun secret dans Git
- [ ] templates `.html` collés dans le Dashboard
- [ ] durée de vie des liens relevée et documentée
- [ ] logo public disponible (ou fallback texte assumé)

---

## 18. Risques et limites

1. **Templates non déployés.** Les fichiers sont prêts et testés, mais un
   template non collé dans le Dashboard ne sera jamais envoyé. Tant que ce n'est
   pas fait, Supabase envoie son template par défaut.
2. **Confirmation email non vérifiée.** Le dépôt **présuppose** que les
   confirmations sont activées. Si le Dashboard les a désactivées, le message
   d'attente n'apparaîtra jamais — comportement correct, mais à confirmer.
3. **Change Email non implémenté.** Le template est préparé ; sans méthode
   `updateUser({ email })`, il n'est jamais utilisé.
4. **Magic Link non supporté.** Si quelqu'un active Magic Link dans le Dashboard
   sans code front, l'email partira avec le template Supabase par défaut, pas
   avec l'identité TAGGO.
5. **Exigences de mot de passe asymétriques.** Majuscule et chiffre sont
   vérifiés côté client uniquement : un appel direct à l'API Supabase peut les
   contourner. Renforcer cela demanderait une règle serveur (hook ou
   `password_required_characters` selon la version).
6. **Fallback texte logo.** Aucun logo ne s'affiche tant qu'aucune URL publique
   fiable n'est configurée.
7. **Durée de vie non annoncée.** Délibérément : annoncer « 1 heure » sans
   vérifier le Dashboard serait un engagement faux.

---

## 19. Vérification que l'étape 10 n'a pas été cassée

Contrôles automatisés (toujours verts) :

- `src/emails/` : aucun fichier modifié.
- `email_events`, `reserve_email_event`, `finalize_email_event` : migration
  intacte, audit d'idempotence vert.
- `ORDER_CONFIRMED` et l'idempotence des emails de commande : tests inchangés.
- `src/lib/securityAudit.test.ts` : la section « étape 10 » (absence de secret,
  RPC d'email réservés à `service_role`, surface serveur) passe toujours. La
  section « étape 10.1 » a été **ajoutée** à la suite, pas substituée.
- `api/` : aucun endpoint modifié, aucun provider d'email introduit.
- Aucun template Auth n'importe quoi de `src/emails/`, et inversement.

---

## 20. Conclusion

Les trois chaînes d'emails Auth utilisées par TAGGO sont correctement
séparées : password reset, confirmation d'inscription et changement d'adresse
(disponible côté template, non exposé par le front). Magic Link reste
désactivé.

Le flux prioritaire `/forgot-password → email Supabase → /reset-password` est
**intact et sécurisé côté code** : aucune URL externe n'est acceptée, aucun
jeton n'est fabriqué, stocké ou journalisé, aucun message ne révèle
l'existence d'un compte, aucun secret n'entre dans le dépôt.

Les templates sont prêts, testés et alignés sur la palette TAGGO, sans
JavaScript ni ressource externe.

**En revanche, cette étape ne peut pas être considérée comme entièrement
déployée** : elle prépare le code, les fichiers et la configuration locale.
Elle ne peut pas configurer le Dashboard Supabase, ni envoyer un email réel.
Les actions manuelles de la section 15 restent **obligatoires** avant que le
flux ne soit vérifié avec une vraie boîte email.
