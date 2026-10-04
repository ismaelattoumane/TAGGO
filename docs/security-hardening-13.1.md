# Étape 13.1 — Correctifs de sécurité post-staging

Ce document est le compte rendu de l'audit de sécurité effectué **après** le
premier essai de l'étape 13 sur une pile Supabase locale réelle. Il décrit ce
qui a été trouvé, ce qui a été corrigé, et comment vérifier que les corrections
tiennent.

Il ne remplace pas [supabase/tests/README.md](../supabase/tests/README.md), qui
explique comment lancer les tests.

## Constat de départ

Les migrations et les principaux flux fonctionnaient. L'audit a trouvé **six
défauts**, dont trois n'étaient pas visibles à la lecture du code : ils ont été
trouvés en **exécutant** le scénario.

## Les six défauts

### F4 — le cycle de vie d'un TAGGO s'écrivait directement

Un propriétaire pouvait écrire `lifecycle_status`, `status`, `is_public`,
`activated_at`, `reserved_at`, `assigned_at`, `owner_id` et `public_id` par un
`PATCH` ordinaire. La policy RLS le permettait explicitement
(`lifecycle_status in ('activated','active','inactive')`), donc
`transition_taggo` n'était pas une contrainte : c'était une convenience. Tout
le contrôle d'abonnement (`taggo_subscription_allows_public`) pouvait être
contourné en écrivant `is_public = true` et `lifecycle_status = 'active'`.

### F2 — `owner_id` était lisible par l'anonyme

La policy « Public can view active QR codes » autorisait l'anonyme à lire les
lignes de `qr_codes` — et donc TOUTES leurs colonnes, `owner_id` comprise. Une RLS
filtre des lignes, jamais des colonnes : le frontend ne pouvait que refrain de
faire `select *`, ce qui n'est pas une barrière.

### F3 — `orders.currency` était modifiable par le client

Même famille : `authenticated` avait `UPDATE` sur toute la table `orders`. Un
client pouvait changer la devise d'une commande, donc ce que le serveur avait
calculé, donc la cohérence du montant payé.

### F1 — `assign_taggo_to_user` : un chemin d'affectation sans preuve

Accordée à `authenticated` depuis l'étape 5, elle n'exigeait **ni achat, **ni
commande, **ni affectation préalable** : seulement « le TAGGO n'a pas de
propriétaire et il est disponible ou réservé ». N'importe quel compte
authentifié pouvait donc s'attribuer un TAGGO du stock — y compris un TAGGO
réservé pour la commande payée d'un tiers. Le modèle commercial était
contournable par un seul appel PostgREST.

### F2 (bis) — la vue publique n'était pas en lecture seule

Trouvé en testant la correction F2 elle-même. Sur Supabase,
`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES` porte aussi sur les **vues** :
`anon` avait donc `INSERT` sur `public_taggo_cards`. Et une vue qui n'est pas
`security_invoker` écrit dans la table de base avec les droits de son
propriétaire, **sans que la RLS de `qr_codes` soit évaluée**.

Autrement dit : `anon` pouvait insérer un TAGGO par la vue, et le trigger de
protection le laissait passer puisque `current_user` était bien le propriétaire
de la table. La correction F2 créait par contrecoup un chemin d'écriture
anonyme — sur la table que F4 venait de fermer.

### Non-régression — le rejeu du webhook Stripe était cassé

`reserve_taggos_for_paid_order` déclarait `assigned_ids uuid[]` et
`index integer`, puis faisait `foreach index in array assigned_ids`. PostgreSQL
convertit chaque `uuid` en `integer` : la fonction lève
`invalid input syntax for type integer`. Ce chemin n'est atteint que si la
commande a **déjà** reçu ses TAGGO — c'est-à-dire exactement au rejeu. La
garantie d'idempotence annoncée par l'étape 12 n'était pas tenue.

## Les corrections

Une seule migration, `supabase/migrations/20260931130000_taggo_hardening_followup.sql`,
applique les six corrections. Elle est **additive** : aucune migration déjà
appliquée n'est réécrite, ce qui reste la règle du projet.

| Correction | Principe |
| --- | --- |
| Champs serveur de `qr_codes` | `REVOKE UPDATE` sur la table, `GRANT UPDATE` sur `title`, `description`, `destination_url` seulement. Un trigger `BEFORE INSERT OR UPDATE` refuse en plus toute écriture des champs serveur **sauf par le propriétaire de la table** — c'est-à-dire les seules fonctions `security definer`. |
| `is_public` | Ajouté aux champs protégés. C'est l'état de publication, il dépend de l'abonnement : il n'a rien à faire dans une écriture directe. |
| `assign_taggo_to_user` | `REVOKE EXECUTE` à `anon`, `authenticated` et `PUBLIC`. Aucune page ne l'utilisait ; la retirer du périmètre ne casse aucun flux. |
| `public_profiles` / `public_taggo_cards` | Vue publique explicite (5 colonnes), en lecture seule. Les policies de `public_profiles` ne référencent plus `qr_codes` : elles délèguent à des fonctions `security definer`, sinon l'anonyme ne pouvait plus les évaluer. |
| `orders` | Aucune donnée financière ni référence Stripe à l'INSERT ; `UPDATE` limité à `status` ; une commande payée n'est plus supprimable. |
| `reserve_taggos_for_paid_order` | Une seule ligne de déclaration corrigée (`qr_id uuid`). Le corps est repris sans autre changement. |

### Pourquoi le trigger compare au propriétaire de la table

Il comparait `current_user` au NOM `'postgres'`. Ce n'est pas une preuve
d'autorité, c'est une convention de nom : si le propriétaire change, la
protection disparaît silencieusement. La règle appliquée est une règle, pas un
nom — **seul le propriétaire de la table peut écrire les champs serveur**, ce
qui est exactement le périmètre des fonctions `security definer`. Un rôle client
ajouté plus tard serait refusé par défaut au lieu de passer.

## Vérifier

```bash
npm run db:stack:up     # PostgreSQL + GoTrue + PostgREST
npm run test:db         # rejeu des migrations + 165 assertions pgTAP + 50 tests HTTP
npm run db:schema:check # l'instantané du schéma n'a pas dérivé
```

## Points signalés et NON corrigés

Trois points ont été vérifiés puis laissés en l'état. Ils sont consignés ici pour
que la décision soit explicite plutôt que silencieuse.

### `profiles.email` reste modifiable par son propriétaire

Vérifié : `has_column_privilege('authenticated', 'public.profiles', 'email',
'UPDATE')` vaut `true`. `profiles.email` sert de destinataire aux emails de
commande (`loadOrderEmailContext`). Un client peut donc réécrire l'adresse de ses
propres emails de commande.

Non corrigé ici parce que le correctif crédible — retirer la colonne des droits
d'écriture et reconstruire l'upsert du profil — touche le parcours de compte,
hors du périmètre de cette étape. La donnée concernée reste celle du client
lui-même.

### Supprimer un TAGGO déjà attribué échoue

`taggo_assignments.qr_code_id` est en `ON DELETE RESTRICT` : la policy
« Owners can delete their QR codes » est correcte, mais un TAGGO attribué ne peut
pas être supprimé. Supprimer un TAGGO sans affectation fonctionne
(`lives_ok` vérifié). Ce n'est pas un défaut de sécurité, c'est un défaut
fonctionnel de l'étape 5 ; le corriger demanderait de choisir une sémantique
(annulation de l'affectation ou interdiction explicite).

### Un appel anonyme déclenche une écriture

`get_public_taggo_state` appelle `expire_due_taggo_subscriptions()`, qui écrit
`lifecycle_status` et `status` sur les TAGGO échus. Vérifié : après un appel anonyme, `updated_at` du TAGGO n'est plus à sa valeur initiale.

C'est un choix assumé de l'étape 12 — l'expiration paresseuse supprime un
travail planifié. Le coût est qu'un visiteur non authentifié provoque une
écriture en base. Le balayage est borné, idempotent, et l'écriture ne peut
toucher que des TAGGO dont la période est déjà échue. Si ce déclenchement par un
anonyme est jugé unwanted, l'alternative est un `pg_cron` ou une fonction
appelée par le serveur.

## Limites

- **Supabase hébergé n'a pas été testé.** Les tests tournent sur `postgres:17.6`,
  `gotrue:v2.196` et `postgrest:v16.1`. Un projet hébergé a des réglages
  différents (`PGRST_DB_SCHEMAS`, `db-schemas`, pooler, politique de mot de
  passe) qui peuvent modifier le comportement.
- **Stripe n'a pas été testé en Test Mode.** Le webhook est vérifié en appelant
  directement les fonctions SQL qu'il appelle, avec une clé Stripe valide. La
  vérification de signature, le mapping des événements Stripe et les transitions
  de session restent à valider en Test Mode.
- Le trigger ne se déclenche pas pour un propriétaire qui réécrirait ses
  privilèges. C'est intentionnel : c'est l'administrateur de la base.