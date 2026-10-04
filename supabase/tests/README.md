# Tests PostgreSQL / RLS — TAGGO

Ces tests s'exécutent **dans une vraie base PostgreSQL**, avec les **vrais rôles**
clients (`anon`, `authenticated`) et de **vrais JWT**. Ils ne sont pas exécutés par
`npm run test` : `vitest` n'a pas de base à disposition.

`test:db`, `db:replay` et `db:schema:check` réinitialisent le schéma public.
Ils refusent désormais d'opérer sur une pile dont le nom ne commence pas par
`taggo_test_`. Démarrez une pile dédiée sur des ports libres :

```bash
TAGGO_STACK_NAME=taggo_test_step141 TAGGO_PG_PORT=55432 TAGGO_AUTH_PORT=18081 TAGGO_REST_PORT=13000 npm run db:stack:up
TAGGO_STACK_NAME=taggo_test_step141 TAGGO_PG_PORT=55432 TAGGO_AUTH_PORT=18081 TAGGO_REST_PORT=13000 npm run test:db
TAGGO_STACK_NAME=taggo_test_step141 TAGGO_PG_PORT=55432 TAGGO_AUTH_PORT=18081 TAGGO_REST_PORT=13000 npm run db:schema:check
TAGGO_STACK_NAME=taggo_test_step141 TAGGO_PG_PORT=55432 TAGGO_AUTH_PORT=18081 TAGGO_REST_PORT=13000 npm run db:stack:down
```

Utilisez un nom de pile unique et des ports libres. Le `down` ne supprime que les
trois conteneurs portant ce nom ; ne réutilisez pas un nom qui contient des
données à conserver.

`npm run test:db` enchaîne trois étapes et sort en code non nul si une seule échoue :

1. **Rejeu complet des migrations sur une base propre** (`scripts/db-replay.sh`) :
   le schéma `public` est supprimé puis recréé, et chaque migration est appliquée
   seule, dans l'ordre du dépôt. Une preuve qui ne part pas d'un schéma vide ne
   prouve rien.
2. **Tests pgTAP** (`supabase/tests/*.sql`).
3. **Tests HTTP** (`scripts/rls-http.test.mjs`) : comptes créés par GoTrue, JWT
   réellement signés, appels HTTP réels sur PostgREST. Le test échoue si le JWT
   d'authentification ou le JWT `anon` ne porte pas le rôle attendu.

## Fichiers

| Fichier | Ce qu'il prouve |
| --- | --- |
| `010_taggo_write_protection.sql` | F4 — un utilisateur authentifié ne peut écrire ni `lifecycle_status`, ni `status`, ni `is_public`, ni les horodatages, ni `owner_id`, ni `public_id`, ni s'attribuer un TAGGO du stock. Les RPC autorisées fonctionnent toujours et leurs garde-fous d'abonnement tiennent. |
| `020_public_exposure.sql` | F2 — l'anonyme n'a plus aucun droit sur `qr_codes` ; la vue publique est une liste blanche de colonnes ; elle est en lecture seule ; les données publiques restent correctes et `owner_id` est hors d'atteinte. |
| `030_order_financials.sql` | F3 — `orders.currency` et les autres colonnes financières ne sont modifiables ni à l'INSERT, ni à l'UPDATE, ni par suppression d'une commande payée. Le client garde `status`. |
| `040_taggo_flows.sql` | Non-régression métier — commande, webhook Stripe et son idempotence, attribution, première année incluse, activation, visibilité publique, analytics, anti-abus, expiration, renouvellement, idempotence des emails. |
| `050_security_regressions.sql` | Étape 14.1 — adresse de profil issue de `auth.users`, confirmation Auth avant destination de commande, lecture d'expiration sans écriture et matrice de suppression des TAGGO avec historique. |

## Deux règles que ces tests ne violent jamais

**`service_role` ne prouve jamais qu'un utilisateur est autorisé ou refusé.**
C'est le moyen le plus simple de masquer une régression : un secret de service
contourne la RLS, donc « le test passe » ne dit plus rien. Ici `service_role`
n'apparaît que dans `040`, et uniquement pour vérifier que les fonctions
appelées **en production par le webhook** fonctionnent encore. Toutes les
décisions d'accès sont prises avec `anon` ou `authenticated`.

**Les tables temporaires sont inutilisables ici.** Les tests basculent de rôle, et
une table temporaire n'appartient qu'à un seul d'entre eux : les identifiants de
fixtures sont donc écrits en dur.

## Deux détails d'implémentation qui ont coûté du temps

- **`request.jwt.claims` suffit pour reproduire PostgREST.** C'est exactement ce
  que PostgREST met en place après avoir validé un Bearer token : `set local role
  authenticated;` puis `set local request.jwt.claims = '{"sub":"…","role":"authenticated"}'`.
  `auth.uid()` relit ces claims. Les tests HTTP font la même chose en plus fidèle
  encore, par le réseau.
- **`results_eq` de pgTAP est inutilisable sur `information_schema` dans l'image
  Supabase** : la comparaison échoue sur la collation des domaines
  (`could not determine which collation to use`). `020` utilise `is()` pour la
  vérification concernée.

## Ajouter un test

- Un cas de sécurité sur une table ou une policy → fichier `supabase/tests/NNN_*.sql`,
  en `begin;` / `rollback;`, avec `select plan(N)` puis `select * from finish();`.
- Un cas qui passe par l'API HTTP → `scripts/rls-http.test.mjs`.
- Un cas qui n'a besoin d'aucune base (syntaxe SQL, cohérence des fixtures) →
  `src/lib/*.test.ts`, pour qu'il tourne dans `npm run test`.