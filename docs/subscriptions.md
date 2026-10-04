# Abonnements TAGGO et expiration — étape 12

Ce document décrit le modèle commercial retenu, la source de vérité, les
mécanismes d'expiration et de réactivation, et ce qui reste à décider. Les tests
d'audit (`src/lib/subscriptionSqlAudit.test.ts`, `src/lib/securityAudit.test.ts`,
`src/lib/taggoLifecycle.test.ts`, `src/lib/migrationSqlSyntax.test.ts`,
`src/features/qr/localSubscriptionStore.test.ts`) lisent les mêmes règles que ce
document.

## 1. Modèle économique

Lorsqu'un client achète un TAGGO :

- la **première année est incluse** avec l'achat ;
- au-delà, un **abonnement annuel** est nécessaire pour continuer à utiliser le
  TAGGO ;
- le renouvellement peut être **automatique** (préférence enregistrée) ou
  **manuel** (le propriétaire déclenche un paiement) ;
- sans renouvellement, le TAGGO **expire** : sa page publique est suspendue, et
  le propriétaire doit renouveler pour le réactiver.

**Toute période d'abonnement suppose l'existence d'une période.** Un TAGGO qui
n'a **aucune** période n'est pas plus public qu'un TAGGO expiré : c'est la règle
qui ferme le modèle commercial. Voir § 6.

**Durée : une année calendaire**, jamais un nombre de jours. Les deux périodes —
première année incluse et renouvellement — durent exactement `interval '1 year'`,
c'est-à-dire la même date un an plus tard. Ce n'est **pas** « 365 jours » :

| Période | Durée réelle | Conséquence d'un « + 365 jours » |
| --- | --- | --- |
| 2027-03-01 → 2028-03-01 | **366 jours** (elle contient le 29 février 2028) | expiration un jour trop tôt |
| 2028-03-01 → 2029-03-01 | 365 jours | correct |
| 2028-02-29 → 2029-02-28 | PostgreSQL **recale** sur le dernier jour valide du mois cible | pas de débordement au 1er mars |

L'erreur se répète donc tous les quatre ans, dans un sens ou dans l'autre. C'est
la période qui **contient** le 29 février qui dure 366 jours, pas celle qui le
suit — inverser les deux cas est l'erreur classique.

La durée est une constante SQL, pas un paramètre commercial, et le navigateur ne
peut ni la lire ni la modifier (aucune API client ne transmet de date).

*Limite technique assumée.* Une contrainte `CHECK` calant exactement l'année
calendaire sur une colonne `timestamptz` est **impossible** : PostgreSQL la
refuse avec « functions in check constraint must be marked IMMUTABLE », car
`timestamptz_pl_interval` dépend du `TimeZone` de session. La migration le
documente volontairement pour que personne ne l'ajoute un jour et ne casse le
déploiement. À la place :

- `subscriptions_period_check` borne la durée entre 364,6 et 366,7 jours
  (fenêtre élargie pour absorber le passage d'heure d'été). Une durée inventée
  (30 jours, 5 ans) est refusée par la base ;
- la règle exacte est appliquée **par construction** : `ends_at` n'est écrit
  qu'à partir de `starts + interval '1 year'`, dans les deux seules fonctions
  qui ouvrent une période. Aucun autre écrivain n'existe et le client ne peut
  pas écrire du tout (§ 10). Le test d'audit échoue si un `ends_at` est écrit à
  partir d'une autre expression.

**Aucun prix n'est défini.** Le tarif de renouvellement est **À DÉCIDER** (voir
§ 12). Tant qu'il n'est pas décidé, aucun montant n'est affiché, aucune session
de paiement n'est créée, et `POST /api/subscriptions/renew` refuse.

## 2. Source de vérité

`public.subscriptions` est l'**unique** source de vérité de la validité d'un
TAGGO. `qr_codes.lifecycle_status` en est la projection opérationnelle : c'est lui
que consultent les politiques RLS et la page publique.

La table **existait déjà** (migration initiale, étape 5) mais n'avait **jamais
eu de lecteur ni d'écrivain applicatif** — c'était du schéma mort. Elle est
ré-utilisée plutôt que dupliquée : créer une seconde table d'abonnement aurait
donné deux systèmes concurrents.

Ce qui change :

| Avant | Après |
| --- | --- |
| Granularité `user_id` (compte) | Granularité `qr_code_id` (TAGGO) |
| Statuts `trial`, `active`, `cancelled`, `expired` | Statuts `active`, `expired` |
| Aucune période gérée | `started_at` / `ends_at` réels |
| Aucun identifiant Stripe | `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id` (références, non renseignées) |
| Aucune préférence | `auto_renew` |

### Pourquoi la granularité change

Un propriétaire peut posséder plusieurs TAGGO, chacun acheté à une date
différente. Rattacher la période au compte (`user_id`) rendrait impossible
d'expirer un TAGGO sans en expirer tous les autres. L'unicité est donc sur
`qr_code_id`.

`subscriptions.user_id` reste un **miroir** de `qr_codes.owner_id`, utilisé par
la politique RLS de lecture. Il n'est jamais lu comme autorité.

## 3. Statuts

### Stockés (2)

| Statut | Signification | Écrivain |
| --- | --- | --- |
| `active` | la période courante court (`ends_at > now()`) | `grant_included_taggo_period`, `renew_taggo_subscription` |
| `expired` | la période est terminée sans renouvellement | `expire_due_taggo_subscriptions` |

### Non créés, volontairement

| Statut proposé | Pourquoi il n'existe pas |
| --- | --- |
| `pending` | Aucun paiement de renouvellement ne peut être amorcé tant que le prix n'est pas configuré. Un statut sans écrivain serait un mensonge. |
| `cancelled` | « Ne pas renouveler » est déjà représenté par `active` + `auto_renew = false`. Un statut supplémentaire serait redondant. |
| `expiring` | C'est un état **affiché**, dérivé de la distance à `ends_at`. Le stocker exigerait un job pour rester juste ; le dériver est toujours vrai, même sans cron. |
| `trial` | Ancienne valeur du schéma mort, sans signification dans le modèle réel. Normalisée en `active` puis retirée. |

## 4. Première année incluse

### Point de démarrage

La période s'ouvre dans `reserve_taggos_for_paid_order`, qui est appelée par le
webhook **après** `mark_shop_order_paid` et qui refuse toute commande dont le
statut n'est pas `paid` :

```sql
if target.status <> 'paid' then
  raise exception 'order_not_paid';
end if;

included_starts := coalesce(target.paid_at, now());
```

Donc :

- une commande **non payée** n'atteint jamais cette fonction → aucune période ;
- le début de période est `orders.paid_at`, c'est-à-dire le **paiement confirmé**,
  pas le début du checkout ni la réservation physique du TAGGO.

### Idempotence

```sql
insert into public.subscriptions (...)
values (...)
on conflict (qr_code_id) do nothing;
```

Un webhook rejoué ne peut donc pas allonger une période déjà ouverte. La fonction
est également appelée sur le chemin `already_reserved`, ce qui garantit qu'un
rejeu tardif rattrape une attribution interrompue **sans** jamais prolonger.

### TAGGO sans propriétaire

`grant_included_taggo_period` renvoie `false` si le TAGGO n'a pas de
propriétaire. Aucune période n'est inventée.

## 5. Expiration

### Deux barrières complémentaires

**(1) Prédicat de validité — la barrière qui garantit le comportement.**

```sql
create or replace function public.taggo_subscription_allows_public(p_qr_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select not exists (
    select 1 from public.subscriptions s
    where s.qr_code_id = p_qr_id
      and (s.status <> 'active' or s.ends_at is null or s.ends_at <= now())
  );
$$;
```

Il est utilisé par :

- la politique RLS `"Public can view active QR codes"` ;
- la politique RLS `"Public can view public QR profile data"` ;
- `get_public_taggo_state` (état `'expired'`) ;
- `record_taggo_scan` (un TAGGO expiré n'est pas compté comme scan réussi) ;
- `transition_taggo` (garde anti-contournement, voir § 7).

`security definer` est **indispensable** : une politique RLS est évaluée avec les
droits de `anon`/`authenticated`, qui n'ont aucun droit de lecture sur
`public.subscriptions` (RLS activée, politique limitée au propriétaire). Sans
`security definer`, la sous-requête ne verrait jamais la période et **aucun**
TAGGO ne serait jamais bloqué.

Un TAGGO **sans période gérée** renvoie `true` : les TAGGO créés hors boutique et
antérieurs à cette étape gardent exactement leur comportement actuel.

**(2) Balayage — l'écriture de l'état réel.**

`expire_due_taggo_subscriptions()` écrit `subscriptions.status = 'expired'` puis
bascule les TAGGO concernés de `active` à `expired`. Il est **idempotent** (il ne
filtre que sur `status = 'active'`) et **borné** (index sur
`(status, ends_at)`).

### Pourquoi pas de cron

Le projet n'a **aucun** planificateur : `vercel.json` ne contient pas de section
`crons`, et les tests l'interdisent explicitement. Dépendre d'un cron pour
l'expiration rendrait le système incorrect jusqu'au prochain passage — donc
jusqu'à potentiellement plusieurs mois, un TAGGO expiré resterait accessible.

Le balayage est donc déclenché **à la lecture** :

| Lecture | Qui la déclenche |
| --- | --- |
| Page publique `/t/:tag` | `get_public_taggo_state` — donc **tout visiteur** |
| Tableau de bord | `get_taggo_subscription_status` — donc **le propriétaire** |
| Analytics TAGGO | via les mêmes lectures publiques |

Il reste **appelable par un cron** le jour où TAGGO en ajoutera un : c'est une
fonction `service_role` idempotente, prête à être branchée.

Conséquence : l'expiration est exacte **même si personne ne visite le tableau de
bord**. Ce qui manque sans cron, c'est uniquement l'**email** (§ 11).

## 6. Page publique

`get_public_taggo_state` renvoie un état **`expired` distinct** de
`subscription_required`, lui-même distinct de `unavailable` :

| État | Signification | Situation du propriétaire |
| --- | --- | --- |
| `not_found` | TAGGO supprimé ou code inconnu | — |
| `unactivated` | TAGGO attribué mais pas encore activé | il a une action à faire |
| `active` | page publique normale | période `active` et non échue |
| `expired` | **une période existe** et elle est terminée | temporaire, réversible par un renouvellement |
| `subscription_required` | **aucune période n'existe** pour ce TAGGO | n'a jamais eu de période gérée |
| `unavailable` | suspendu, remplacé, annulé, non public, sans destination | sans rapport avec l'abonnement |

Les trois distinctions sont obligatoires :

- confondre `expired` et `unavailable` donnerait au propriétaire un diagnostic
  faux (il chercherait un renouvellement alors que son TAGGO a été suspendu
  volontairement) ;
- confondre `expired` et `subscription_required` afficherait « expiré » à
  quelqu'un qui n'a **jamais** été abonné ;
- confondre `subscription_required` et `active` laisserait un TAGGO sans
  abonnement publiquement accessible.

### Ordre de priorité (il est signifiant, il est testé)

1. code absent → `not_found`
2. période échue → `expired` (le plus urgent)
3. cycle de vie antérieur à `active` → `unactivated` — prioritaire sur
   `subscription_required`, parce que le visiteur a une **action** à faire :
   lui renvoyer vers « activez votre TAGGO » est plus utile que « pas
   d'abonnement »
4. publiquement actif **sans** période → `subscription_required`
5. publiquement actif **avec** période → `active`
6. sinon → `unavailable`

### « Pas de période » n'est PAS « accès libre »

Le prédicat utilisé par les politiques RLS, par `get_public_taggo_state` et par le
comptage des scans est :

```sql
select exists (
  select 1 from public.subscriptions s
  where s.qr_code_id = p_qr_id
    and s.status = 'active'
    and s.ends_at is not null
    and s.ends_at > now()
);
```

Il ne renvoie `true` que s'il existe **une** période `active` et non échue. Dans
les deux autres cas il renvoie `false` :

- une période existe mais est échue ;
- **aucune période n'existe**.

La version initiale de cette étape utilisait `not exists (période échue)`, qui
renvoyait `true` pour un TAGGO sans abonnement : le modèle commercial était alors
contournable sans même passer par `expired` — un TAGGO obtenu hors du circuit de
vente, ou une période supprimée par erreur, restait publiquement accessible.

**Conséquence assumée.** Un TAGGO créé hors boutique (dashboard, import, ancien
jeu de données) n'est **pas** public tant qu'aucune période n'a été ouverte.
`get_taggo_subscription_status` expose alors `subscription_required: true` au
propriétaire pour qu'il puisse l'expliquer.

**Ce que le propriétaire continue de voir.** La restriction vaut pour le public,
pas pour le propriétaire : la RLS propriétaire est inchangée, donc un TAGGO sans
abonnement ou expiré reste visible et gérable dans le tableau de bord. C'est
indispensable, sinon le propriétaire ne pourrait pas diagnostiquer la situation ni
y remédier.

### Côté visiteur

Les états `expired` et `subscription_required` rendent volontairement **le même
écran** :

> **TAGGO temporairement indisponible** — Ce TAGGO n'est plus utilisable pour le
> moment. Contactez son propriétaire pour plus d'informations.

Du point de vue du visiteur la situation est identique (rien ne s'ouvre), et dire
« aucun abonnement » révélerait au visiteur la situation commerciale d'un TAGGO
qui n'est pas le sien. La distinction exacte reste visible **chez le
propriétaire**, dans son tableau de bord.

Cet écran ne révèle **ni propriétaire, ni email, ni date d'expiration, ni
information de facturation, ni détail Stripe**. Un test vérifie explicitement
l'absence de chacun de ces éléments dans le DOM rendu.

## 7. Réactivation

### Règle unique

Une réactivation n'est possible **que si une période `active` et non échue
existe**. C'est la condition bloquante, vérifiée en base :

```sql
if not exists (
  select 1 from public.subscriptions s
  where s.qr_code_id = p_qr_id
    and s.status = 'active'
    and s.ends_at is not null
    and s.ends_at > now()
) then
  return jsonb_build_object('ok', false, 'reason', 'no_valid_subscription');
end if;
```

`reactivate_taggo_subscription` est `service_role` uniquement et revérifie
l'appartenance du TAGGO avant d'agir.

### Fermeture du contournement par `transition_taggo`

`transition_taggo` est accordée à `authenticated` (étape 5). Sans garde-fou, un
propriétaire aurait pu appeler `transition_taggo(qr_id, 'active')` sur son propre
TAGGO expiré et le réactiver **sans aucun paiement** — le modèle commercial
serait contournable par une seule requête PostgREST.

La fonction est donc redéfinie à l'identique, **plus une règle** :

```sql
if p_target_status = 'active'
   and not public.taggo_subscription_allows_public(p_qr_id) then
  return null;
end if;
```

Le graphe de transitions est inchangé : aucune arête créée, aucune arête
supprimée. Un test compare la fonction redéfinie à la version d'origine pour le
garantir.

Aucune route API ne déclenche la réactivation aujourd'hui : le renouvellement
n'est pas encore possible faute de tarif.

## 8. Renouvellement

### Manuel

`POST /api/subscriptions/renew?qr_id=…`

Ce que la route **ne fait pas**, et c'est l'essentiel :

- elle ne déclare jamais un paiement réussi ;
- elle ne modifie aucun statut ;
- elle ne prolonge aucune date.

Le renouvellement réel doit passer par une session Stripe payée, confirmée par
webhook signé. Tant que le tarif n'existe pas, la route répond
`renewal_unavailable` (503) et ne crée aucune commande.

### Automatique

La préférence est un booléen `auto_renew`, modifiable indépendamment de tout
paiement. `set_taggo_auto_renew` ne touche **que** ce booléen, après avoir
revérifié l'appartenance du TAGGO.

L'intégration Stripe Billing (`mode: 'subscription'`, Customer, Price) n'existe
**pas** et n'est pas simulée. La fonction `renew_taggo_subscription` est en
revanche déjà écrite, idempotente et protégée, pour que le branchement soit
propre quand le tarif sera décidé.

### Durcissement de la test mode

`createStripeGateway` refuse toute clé `sk_live_` (`assertTestModeKey`). Tout
l'abonnement reste donc explicitement compatible avec le mode test Stripe. Un
abonnement réel en production demandera de lever ce garde-fou **et** de
configurer les clés correspondantes — deux décisions qui appartiennent à TAGGO.

## 9. Idempotence et concurrence

| Cas | Protection |
| --- | --- |
| Webhook Stripe rejoué | `begin_stripe_event` / `finish_stripe_event` (étape 9) **puis** `on conflict (qr_code_id) do nothing` |
| Commande déjà payée | `mark_shop_order_paid` renvoie `already_paid` sans écrire ; `reserve_taggos_for_paid_order` repasse par `already_reserved` |
| Renouvellement confirmé deux fois | `renew_taggo_subscription` calcule `ends_at` depuis `p_starts_at` (serveur), **jamais** depuis `ends_at` précédente — donc un rejeu avec le même `p_starts_at` recalcule la même période |
| TAGGO déjà actif | Le balayage ne filtre que `status = 'active'` → rien à écrire |
| TAGGO déjà expiré | Le balayage ne filtre que `status = 'active'` → rien à écrire |
| Deux TAGGO d'un même propriétaire | Unicité sur `qr_code_id`, pas sur `user_id` → périodes indépendantes |
| Deux webhooks simultanés sur la même commande | `select ... from orders ... for update` sérialise |
| Deux commandes simultanées | `for update skip locked` sur le stock de TAGGO |

Le point clé de l'anti-double-prolongement : **aucune fonction ne fait
`ends_at = ends_at + interval`**. La fin est toujours recalculée depuis un début
fourni par le serveur.

## 10. RLS et sécurité

| Acteur | Peut |
| --- | --- |
| Propriétaire authentifié | **Lire** son abonnement (RLS `auth.uid() = user_id`) |
| Propriétaire authentifié | **Écrire** sa préférence `auto_renew` (RPC `service_role`, revérification en base) |
| Propriétaire authentifié | **Ne peut pas** écrire `status`, `started_at`, `ends_at`, `stripe_*` |
| Visiteur public | **Ne peut pas** lire la table (aucune politique `anon`) |
| Utilisateur B | **Ne peut pas** lire l'abonnement du TAGGO de A (`not_owner`, revérifié en base) |
| Navigateur | **Ne peut pas** passer `status=active` — aucune route, aucune RPC client |

```sql
revoke insert, update, delete on public.subscriptions from authenticated;
grant select on public.subscriptions to authenticated;
```

Aucune politique `insert` / `update` / `delete` n'existe. Toutes les écritures
passent par des fonctions `service_role`.

### Ce que le navigateur peut envoyer

| Autorisé | Interdit |
| --- | --- |
| `qr_id` (déjà affiché dans son dashboard) | une date (`ends_at`, `starts_at`) |
| une intention (`enabled=true\|false`) | un statut |
| — | un `owner_id` (déduit du JWT) |
| — | un identifiant Stripe |
| — | un montant |

Le `qr_id` seul ne donne aucun droit : le serveur résout le JWT et revérifie
`qr_codes.owner_id` en base.

## 11. Emails

Trois événements sont **prévus** et rendus :

| Type | Contenu |
| --- | --- |
| `SUBSCRIPTION_EXPIRING` | la période se termine, la page publique sera suspendue |
| `SUBSCRIPTION_EXPIRED` | la période est terminée, renouvellement nécessaire |
| `SUBSCRIPTION_RENEWED` | renouvellement confirmé, page de nouveau active |

Ils réutilisent la chaîne existante (`email_events`, `begin_email_event`,
`dispatchTransactionalEmail`) — **aucun deuxième système d'email**.

### Aucun déclenchement automatique — À DÉCIDER

Le projet n'a **aucun** planificateur. Envoyer un email d'expiration sans
déclencheur serveur fiable produirait soit des messages fantômes (déclenché par
une visite), soit aucun message du tout (jamais de visite). Les deux sont
inacceptables.

La décision est donc explicitement **reportée** : le vocabulaire, les templates et
la journalisation existent ; **rien n'est envoyé**. Un test vérifie qu'aucun email
d'abonnement n'est déclenché par le webhook Stripe.

**Pour brancher l'envoi**, il faudra : un déclencheur serveur (cron Vercel,
`pg_cron`, ou une fonction appelée par une source externe), puis l'appel à
`dispatchTransactionalEmail` avec une clé d'idempotence dérivée du TAGGO et de la
date d'échéance — `TAGGO_SUBSCRIPTION_EXPIRING:<qr_id>:<ends_at>` par exemple.

### Données des emails

Aucune donnée financière. Ni montant, ni devise, ni identifiant Stripe, ni
référence de commande. Seulement : le code public du TAGGO, la date d'échéance
déjà formatée par le serveur, et le lien vers la page du TAGGO.

## 12. À DÉCIDER

| Point | Situation actuelle |
| --- | --- |
| **Tarif de renouvellement annuel** | Non défini. `RENEWAL_PRICE_CONFIGURED = false` (valeur forcée dans `api/_lib/subscriptionServer.ts`). Rien n'est affiché, rien n'est facturé. |
| **Price ID Stripe** | Non existant. Aucun `price_…` dans le dépôt. |
| **Fréquence de facturation** | Non définie. Seule la durée d'un an est posée. |
| **Gratuité / tolérance de grâce** | Non définie. Aujourd'hui, expiration **stricte** à `ends_at`. |
| **Renouvellement automatique (Stripe Billing)** | Non branché. `auto_renew` est enregistré comme préférence ; rien n'est débité. |
| **Rappel avant expiration** | Fenêtre d'affichage de 30 jours côté tableau de bord. Le délai du **rappel email** n'est pas décidé. |
| **Emails d'expiration** | Vocabulaire et templates prêts. Déclencheur à définir. |
| **Sortie de la test mode** | `assertTestModeKey` refuse `sk_live_`. Ouvrir la production est une décision TAGGO. |
| **Traitement des TAGGO historiques** | Voir § 13. |
| **Remboursement / annulation en cours de période** | Non traité. Aucune fonction ne raccourcit une période. |

## 13. Historique — TAGGO et abonnements existants

Aucun historique d'abonnement n'est inventé, et **aucune donnée n'est
détruite**.

La migration fait quatre choses, dans cet ordre :

1. **Normalisation des statuts hérités** : `trial` → `active`, `cancelled` →
   `expired`. Ces valeurs ne pouvaient venir que d'une saisie manuelle, aucune
   écriture applicative n'ayant jamais existé.
2. **Mise en archive des lignes non rattachables** (§ 13.1) — jamais de
   suppression silencieuse.
3. **Raidissement** : `qr_code_id` devient `NOT NULL` et `UNIQUE`.
4. **Pose des contraintes** de statut, d'origine et de durée.

### 13.1 Lignes d'abonnement sans TAGGO rattachable

`public.subscriptions` existe depuis l'étape 1 sans avoir jamais eu d'écrivain
applicatif, mais elle a pu être remplie à la main. Une ligne sans `qr_code_id`
ne peut pas être rattachée à un TAGGO de façon fiable.

**Rattacher au hasard serait aussi grave que supprimer** : rattacher la ligne au
TAGGO du même `user_id` créerait une période `active` sur un TAGGO arbitraire,
c'est-à-dire un accès public indu.

La stratégie retenue est donc un **archivage explicite, réversible et
documenté** :

1. **Copie intégrale** dans `public.subscriptions_unattached_archive`
   (`row_id` = ancien `id`, `user_id`, `status`, `plan_name`, `started_at`,
   `ends_at`, `archived_at`). L'insertion précède toute suppression : c'est
   l'ordre qui garantit l'absence de perte.
2. **Retrait borné** de `public.subscriptions`, uniquement des lignes dont
   `row_id` est déjà présent en archive (`exists (...)`), et uniquement parce que
   `qr_code_id` doit devenir `NOT NULL`.
3. **`RAISE NOTICE`** indiquant le nombre de lignes archivées : le nombre est
   visible dans les logs de déploiement, l'opération n'est jamais silencieuse.
4. **Aucune politique RLS** sur la table d'archive, et `REVOKE ALL` pour `anon`
   et `authenticated` : elle n'est lisible que par `service_role` et n'est
   jamais exposée au client.

**Restauration** (une fois le TAGGO correct identifié) :

```sql
-- rattacher la ligne historique au TAGGO voulu, puis :
insert into public.subscriptions (
  id, qr_code_id, user_id, status, plan_name, source, started_at, ends_at
)
select a.row_id, '<uuid_du_taggo>', a.user_id, 'active', a.plan_name, 'included',
       a.started_at, a.started_at + interval '1 year'
from public.subscriptions_unattached_archive a
where a.row_id = '<row_id>';
```

Restaurer ne fabrique pas une année neuve : la visibilité suit les **dates** de la
ligne restaurée. Une période historique échue reste échue, et le balayage la
portera à `expired` — ce qui est le comportement correct.

*Cette stratégie a été validée sur PostgreSQL 16 avec un jeu de données
historiques : 3 lignes préexistantes, 0 perte, restauration vérifiée.*

### 13.2 Les TAGGO qui n'ont pas de période

Tout TAGGO créé **hors d'une commande payée** — via le tableau de bord
(`SupabaseQrRepository.create`), via `assign_taggo_to_user`, ou antérieur à cette
étape — **n'a aucune ligne dans `subscriptions`**.

Pour ces TAGGO :

- `taggo_subscription_allows_public` renvoie `false` → **la page publique est
  désactivée** et le TAGGO ne redirige pas vers sa destination. Ce n'est pas une
  régression : c'est la règle du modèle commercial, et la version initiale de
  cette étape les laissait accessibles ;
- l'état public rendu est `subscription_required`, **distinct** d'`expired` ;
- le tableau de bord affiche **« Aucun abonnement — page publique désactivée »**,
  et explique que ce n'est pas une expiration ;
- le propriétaire continue de voir et de gérer son TAGGO (§ 6) ;
- aucun message ne prétend qu'une période a été calculée.

Ouvrir une période pour ces TAGGO (et à quelles conditions) reste une décision
TAGGO, listée en § 12.

## 14. RGPD et données stockées

| Colonne | Contenu | Justification |
| --- | --- | --- |
| `qr_code_id` | TAGGO concerné | référence métier |
| `user_id` | propriétaire | miroir de `qr_codes.owner_id`, pour la RLS |
| `status` | `active` / `expired` | état de la période |
| `source` | `included` / `renewal` | origine de la période |
| `auto_renew` | booléen | préférence du propriétaire |
| `plan_name` | libellé technique | pas une offre, pas un prix |
| `started_at`, `ends_at` | dates de période | nécessaires à l'affichage |
| `expired_at`, `updated_at` | horodatages techniques | traçabilité |
| `stripe_customer_id`, `stripe_subscription_id`, `stripe_price_id` | références Stripe | techniques, fournies par le serveur, **non renseignées** |

**Aucune donnée de carte bancaire, CVC, IBAN, adresse de facturation, email,
nom ou téléphone** n'est stockée par cette étape. Stripe reste responsable du
traitement des données de paiement selon l'intégration existante de l'étape 9.

Le profil public reste inchangé : la période d'abonnement n'est pas exposée sur
`/t/:tag`.

## 15. Limitations connues

1. **`npm run test` n'exécute pas PostgreSQL.** `subscriptionSqlAudit.test.ts`
   et `taggoLifecycle.test.ts` vérifient que le SQL *dit* ce qu'il doit dire, et
   rejouent la logique en TypeScript. C'est une limite réelle de la suite
   automatique, mais elle a été **comblée pour cette étape** : voir § 15.1.
2. **La migration n'a pas été appliquée à un projet Supabase.** `supabase/schema.sql`
   est un instantané périmé (déjà divergent avant cette étape) :
   `supabase/migrations/` reste la source de vérité.
3. **`transition_taggo` est redéfinie** pour ajouter la garde d'expiration. La
   fonction d'origine est restaurable depuis la migration étape 5. Ses droits
   d'exécution sont **identiques** à l'étape 5 (`authenticated` uniquement) :
   cette migration n'élargit pas la surface d'appel.
4. **Le tableau de bord rafraîchit l'abonnement toutes les 60 secondes** quand il
   reste ouvert. En dehors de cette fenêtre, l'état peut être jusqu'à une minute
   ancien — le balayage serveur reste, lui, exact à chaque lecture.
5. **Un TAGGO `assigned` ou `activated` dont la période expire** n'est pas basculé
   en `expired` : le graphe de transitions interdit cette arête, et ces TAGGO
   n'ont pas de page publique. L'incohérence est sans effet visible.
6. **`renew_taggo_subscription` n'est appelée par aucun code.** C'est
   volontaire : elle est prête pour le branchement Stripe Billing, jamais
   exécutée tant que le tarif n'est pas décidé.
7. **Le dépôt `api/subscriptions/` ne contient qu'un fichier de test.** Les trois
   handlers sont chacun dans leur propre fichier ; l'audit de sécurité vérifie
   que **chacun** résout le JWT.
8. **`get_public_taggo_state` déclenche une écriture depuis une lecture
   anonyme.** La fonction est `security definer`, l'écriture est strictement
   bornée aux périodes **déjà échues**, et l'opération est idempotente : elle ne
   peut ni créer, ni prolonger, ni supprimer une période. Acceptable tant que le
   balayage se limite à porter `active` → `expired` ; il faudrait le retirer de
   ce chemin le jour où il écrireait autre chose.

### 15.1 Vérification sur PostgreSQL réel

Cette étape a été validée sur une instance **PostgreSQL 16** en appliquant les
**9 migrations du projet dans l'ordre**, puis en exécutant des assertions
comportementales. Ce qui est couvert :

| Domaine | Vérifié |
| --- | --- |
| Application des migrations | les 9 fichiers s'appliquent en séquence, sans erreur |
| Année calendaire | 366 j sur la période contenant le 29/02 ; recalage 29/02 → 28/02 |
| Contrainte de durée | une durée inventée est refusée par la base |
| Prédicat public | `true` seulement avec une période `active` et non échue |
| États publics | ordre de priorité complet, dont `subscription_required` et `unactivated` prioritaire |
| Expiration | blocage avant balayage, persistance par le balayage, idempotence |
| Scans | `recorded`, `duplicate`, `not_active`, `not_found`, et fenêtre anti-abus non consommée par un refus |
| Cycle de vie | `activated`/`expired` → `active` refusés sans période, autorisés avec ; sortie de `active` toujours possible |
| Réactivation | refus sans période valide, refus pour un tiers, succès pour le propriétaire |
| Idempotence | un rejeu ne prolonge pas une période |
| RLS | invisibilité publique sans abonnement et expiré ; visibilité **propriétaire** préservée ; tiers ne voit rien |
| Droits | aucune fonction d'écriture exécutable par `anon`/`authenticated`, archive inaccessible |
| Non-destruction | 3 lignes historiques : 0 perte, restauration vérifiée |

**Ce que cette vérification ne remplace pas** : un projet Supabase réel
(politiques RLS Supabase, `auth.uid()` branché sur de vrais JWT, portail de
supabase). Les points ci-dessus restent à rejouer une fois en staging.

*Bug trouvé et corrigé au passage : la migration de l'étape 11
(`20260931000000_taggo_scans.sql`) terminait deux blocs `if` par `end;` au lieu
de `end if;`. PL/pgSQL rejette cela : le fichier **ne pouvait pas s'appliquer**,
et donc ni la table des scans, ni `record_taggo_scan`, ni les RPC d'analytics
n'existaient en base. Le test `src/lib/migrationSqlSyntax.test.ts` verrouille
maintenant cette famille d'erreur.*

## 16. Tests

| Fichier | Couverture |
| --- | --- |
| `api/_lib/subscriptionServer.test.ts` | normalisation, calcul du temps restant, isolation propriétaire, pannes, refus sans prix, et **impossibilité pour le client d'écrire un état financier** |
| `api/subscriptions/subscriptionsApi.test.ts` | JWT obligatoire, propriétaire déduit du JWT, refus owner, méthodes, aucune fuite Stripe |
| `src/features/subscriptions/subscriptionClient.test.ts` | ce que le navigateur envoie (et n'envoie pas), états affichés, distinction suspendu/remplacé/expiré, défaut prudent `subscriptionRequired` |
| `src/features/subscriptions/TaggoSubscriptionPanel.test.tsx` | états du panneau, TAGGO expiré, TAGGO sans abonnement (jamais présenté comme expiré), absence de prix, pas de prolongation par un clic |
| `src/features/qr/localSubscriptionStore.test.ts` | année calendaire et cas bissextiles, refus d'accès sans période, borne à l'échéance exacte, idempotence du balayage |
| `src/features/qr/qrRepository.test.ts` | état public selon la période, priorité `unactivated` sur `subscription_required` |
| `src/pages/PublicQrPage.test.tsx` | écran public pour `expired` **et** `subscription_required`, sans révéler la nature de la situation |
| `src/lib/taggoLifecycle.test.ts` | scénarios 1 à 24 : inclusion, non payé, expiration, réactivation, doublons, concurrence, multi-TAGGO, cohérence du graphe, durée calendaire |
| `src/lib/subscriptionSqlAudit.test.ts` | le SQL dit ce qu'il doit dire : statuts, durées calendaires, RLS, idempotence, **absence de `DELETE` destructif**, `record_taggo_scan`, garde-fou `transition_taggo`, archive |
| `src/lib/migrationSqlSyntax.test.ts` | les migrations s'appliquent : `end if;`, dollar-quotes, `security definer` + `search_path` |
| `src/lib/securityAudit.test.ts` | aucune écriture client, aucun prix inventé, aucun secret, aucune donnée bancaire |
| `src/emails/emails.test.ts` | les trois nouveaux templates rendent HTML et texte sans donnée financière |

## 17. Fichiers

**Migration**

- `supabase/migrations/20260931100000_taggo_subscriptions.sql`

**Serveur**

- `api/_lib/subscriptionServer.ts`
- `api/subscriptions/taggo.ts`
- `api/subscriptions/renew.ts`
- `api/subscriptions/auto-renew.ts`

**Frontend**

- `src/features/subscriptions/subscriptionTypes.ts`
- `src/features/subscriptions/subscriptionClient.ts`
- `src/features/subscriptions/TaggoSubscriptionPanel.tsx`
- `src/features/subscriptions/TaggoSubscriptionPanel.css`
- `src/emails/templates/subscription.ts`

**Modifiés**

- `src/pages/QrDetailPage.tsx` (panneau d'abonnement)
- `src/pages/PublicQrPage.tsx` (états `expired` et `subscription_required`)
- `src/pages/SettingsPage.tsx` (section « Abonnement »)
- `src/features/qr/qrTypes.ts` (`PublicTaggoState` + `expired` + `subscription_required`)
- `src/features/qr/LocalQrRepository.ts` (états locaux alignés sur la base)
- `src/emails/emailTypes.ts`, `src/emails/index.ts` (vocabulaire)
- `src/lib/securityAudit.test.ts` (liste des endpoints, audit étape 12)

**Correction d'une étape antérieure**

- `supabase/migrations/20260931000000_taggo_scans.sql` — deux blocs `if` se
  terminaient par `end;` au lieu de `end if;`, ce qui rendait le fichier de
  migration **inapplicable**. Détail et justification en § 15.1.

**Ajouté pour cette étape**

- `src/features/qr/localSubscriptionStore.ts` (démo locale : mêmes règles de
  visibilité et de durée calendaire que la base, sans abonnement ni paiement)
