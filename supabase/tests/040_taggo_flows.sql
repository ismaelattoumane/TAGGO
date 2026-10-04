-- ===========================================================================
-- Étape 13.1 — les flux métier complets fonctionnent toujours après le
-- durcissement : attribution, activation, abonnement, expiration, analytics,
-- anti-abus, idempotence du webhook et des emails.
--
-- RÈGLE D'OR DES TESTS DE SÉCURITÉ : `service_role` n'est JAMAIS utilisé pour
-- prouver qu'un utilisateur normal est autorisé ou refusé. Il est utilisé ici
-- dans un seul but, explicite : ces fonctions sont, EN PRODUCTION, appelées par
-- le webhook Stripe ou par les routes serveur. On vérifie donc que ces chemins
-- fonctionnent encore — pas qu'un client y a accès. Les contrôles d'accès pour
-- un utilisateur normal sont faits dans 010, 020, 030 et dans
-- scripts/rls-http.test.mjs.
--
-- Les identifiants sont FIXES : le test bascule entre `anon`, `authenticated`
-- et `service_role`, et les tables temporaires appartiendraient à un seul rôle.
-- ===========================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(46);

-- Identifiants de fixtures.
--   TAGGO     : le TAGGO acheté puis activé dans ce scénario.
--   TAGGO_LIB : un TAGGO du stock, jamais publié (scan non compté).
--   COMMANDE  : une commande payée, préparée par le serveur.
create temporary table _ids on commit drop as
select
  'bbbbbbbb-bbbb-4bbb-8bbb-00000000000b'::uuid as commande,
  'cccccccc-cccc-4ccc-8ccc-00000000000c'::uuid as client_id;

-- ---------------------------------------------------------------------------
-- Mise en place (droits du propriétaire de la table : hors RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values ('99999999-9999-4999-8999-000000000009', 'flows@example.com', '{"full_name":"Flows"}');
insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'flows-other@example.com');

-- Un prix est posé UNIQUEMENT dans cette transaction de test : le catalogue de
-- production a volontairement `price_cents = NULL`, et aucun montant ne doit
-- être inventé dans le dépôt.
update public.product_variants
set price_cents = 2500, currency = 'EUR'
where id = '11111111-1111-4111-8111-111111111112';

-- Provisionnement par le serveur : c'est la seule façon d'obtenir du stock.
select is((select count(*)::integer from public.qr_codes where lifecycle_status = 'available'), 0,
  'le stock démarre vide');
select public.provision_taggo_stock(3);
select is((select count(*)::integer from public.qr_codes where lifecycle_status = 'available'), 3,
  'provision_taggo_stock crée exactement 3 TAGGO disponibles');

-- Le TAGGO du scénario et un TAGGO témoin, insérés avec des identifiants fixes.
-- `created_at` est positionné dans le passé : c'est ce qui fait que
-- `reserve_taggos_for_paid_order`, qui choisit le TAGGO disponible le plus
-- ancien (`order by created_at, id`), attribue bien TGG-FLOW001. Sans cela le
-- test dépendrait de l'ordre d'uuid générés.
insert into public.qr_codes (id, public_id, status, lifecycle_status, is_public, title, destination_url, created_at)
values ('dddddddd-dddd-4ddd-8ddd-00000000000d', 'TGG-FLOW001', 'draft', 'available', false, 'Scénario', 'https://example.com/flow', now() - interval '2 days');
insert into public.qr_codes (id, public_id, status, lifecycle_status, is_public, title, destination_url, created_at)
values ('eeeeeeee-eeee-4eee-8eee-00000000000e', 'TGG-FLOW002', 'draft', 'available', false, 'Témoin', 'https://example.com/witness', now() - interval '1 day');

-- La commande payée du scénario : c'est le webhook qui l'a marquée payée, donc
-- le montant, la devise et la référence Stripe viennent du serveur.
insert into public.orders (id, customer_id, status, subtotal_cents, currency, paid_at, stripe_checkout_session_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-00000000000b', '99999999-9999-4999-8999-000000000009',
        'paid', 5000, 'EUR', now(), 'cs_test_flows');

-- ===========================================================================
-- 1. Commande créée par le client : le montant est calculé en base
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-4999-8999-000000000009","role":"authenticated","aud":"authenticated","email":"flows@example.com"}';

select is(
  (public.create_shop_order('[{"variantId":"11111111-1111-4111-8111-111111111112","quantity":2}]'::jsonb) ->> 'subtotal_cents')::int,
  5000,
  'create_shop_order calcule le sous-total côté serveur (2 x 2500)'
);
select is(
  public.create_shop_order('[{"variantId":"11111111-1111-4111-8111-111111111112","quantity":2}]'::jsonb) ->> 'currency',
  'EUR',
  'la devise provient du catalogue serveur'
);
select is(
  public.create_shop_order('[{"variantId":"11111111-1111-4111-8111-111111111112","quantity":2}]'::jsonb) ->> 'status',
  'pending',
  'une commande créée n''est jamais paid'
);

-- ===========================================================================
-- 2. Webhook Stripe : idempotence et refus des incohérences
--    (`service_role` : c'est l'appelant réel en production)
-- ===========================================================================
reset role;
set local role service_role;

select is(public.begin_stripe_event('evt_test_1', 'checkout.session.completed', 'bbbbbbbb-bbbb-4bbb-8bbb-00000000000b'), true,
  'un nouvel événement Stripe est traité');
select is(public.begin_stripe_event('evt_test_1', 'checkout.session.completed', 'bbbbbbbb-bbbb-4bbb-8bbb-00000000000b'), false,
  'le rejeu du même événement est détecté (idempotence)');

-- Une seconde commande, celle-là EN ATTENTE : c'est le seul état où Stripe peut
-- être contredit, car `mark_shop_order_paid` rend la main sur une commande
-- déjà payée avant même de comparer le montant.
insert into public.orders (id, customer_id, status, subtotal_cents, currency, stripe_checkout_session_id)
values ('f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4', '99999999-9999-4999-8999-000000000009',
        'pending', 5000, 'EUR', 'cs_test_pending');

select throws_ok(
  $$select public.mark_shop_order_paid('f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4', 'cs_test_pending', 'pi_test', 1, 'EUR')$$,
  'P0001', 'amount_mismatch',
  'un montant Stripe différent du total est refusé'
);
select throws_ok(
  $$select public.mark_shop_order_paid('f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4', 'cs_test_pending', 'pi_test', 5000, 'USD')$$,
  'P0001', 'currency_mismatch',
  'une devise Stripe différente de celle de la commande est refusée'
);
select is((select status from public.orders where id = 'f4f4f4f4-f4f4-4f4f-8f4f-f4f4f4f4f4f4'), 'pending',
  'après un refus, la commande reste en attente');
select is(
  (public.mark_shop_order_paid('bbbbbbbb-bbbb-4bbb-8bbb-00000000000b', 'cs_test_flows', 'pi_test', 5000, 'EUR')->>'already_paid')::text,
  'true',
  'le rejeu du webhook ne change pas l''état (already_paid)'
);

-- ===========================================================================
-- 3. Attribution des TAGGO payés + première année incluse
-- ===========================================================================
-- Premier appel : la commande reçoit son TAGGO. (Aucun résultat n'est conservé
-- dans une table temporaire : le test change de rôle, et une table temporaire
-- n'appartiendrait qu'à un seul d'entre eux.)
select is(
  (public.reserve_taggos_for_paid_order('bbbbbbbb-bbbb-4bbb-8bbb-00000000000b', 1) ->> 'already_reserved')::text,
  'false',
  'la première attribution crée les TAGGO'
);
select is(
  (public.reserve_taggos_for_paid_order('bbbbbbbb-bbbb-4bbb-8bbb-00000000000b', 1) ->> 'already_reserved')::text,
  'true',
  'le rejeu de l''attribution ne réserve pas un second TAGGO'
);
select is(
  (select count(*)::integer from public.taggo_assignments a where a.order_id = 'bbbbbbbb-bbbb-4bbb-8bbb-00000000000b' and a.status <> 'cancelled'),
  1,
  'exactement un TAGGO est affecté à la commande'
);
select is(
  (select q.lifecycle_status from public.qr_codes q where q.public_id = 'TGG-FLOW001'),
  'assigned',
  'le TAGGO affecté passe en lifecycle assigned'
);
select is(
  (select q.owner_id from public.qr_codes q where q.public_id = 'TGG-FLOW001'),
  '99999999-9999-4999-8999-000000000009'::uuid,
  'le propriétaire est bien le client de la commande'
);
select is(
  (select q.assigned_at is not null from public.qr_codes q where q.public_id = 'TGG-FLOW001'),
  true,
  'assigned_at est posé par le serveur'
);
select is(
  (select q.reserved_at from public.qr_codes q where q.public_id = 'TGG-FLOW001'),
  null::timestamptz,
  'reserved_at reste nul : ce TAGGO n''a pas été réservé par une commande en ligne'
);
select is(
  (select s.status from public.subscriptions s join public.qr_codes q on q.id = s.qr_code_id where q.public_id = 'TGG-FLOW001'),
  'active',
  'la première année incluse est ouverte'
);
select is(
  (select s.source from public.subscriptions s join public.qr_codes q on q.id = s.qr_code_id where q.public_id = 'TGG-FLOW001'),
  'included',
  'la période provient de l''achat'
);
select is(
  (select s.ends_at = s.started_at + interval '1 year' from public.subscriptions s join public.qr_codes q on q.id = s.qr_code_id where q.public_id = 'TGG-FLOW001'),
  true,
  'la période est une année calendaire'
);

-- ===========================================================================
-- 4. Activation par le propriétaire
-- ===========================================================================
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-4999-8999-000000000009","role":"authenticated","aud":"authenticated","email":"flows@example.com"}';

select is(
  (select (public.activate_taggo('TGG-FLOW001')).lifecycle_status),
  'activated',
  'activate_taggo fait passer le TAGGO en activated'
);
select is(
  (select q.activated_at is not null from public.qr_codes q where q.public_id = 'TGG-FLOW001'),
  true,
  'activated_at est posé par le serveur'
);

-- Un autre utilisateur ne peut pas activer le TAGGO de quelqu'un d'autre.
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated","aud":"authenticated"}';
-- La comparaison se fait sur `id` : pgTAP ne sait pas comparer deux
-- composites `qr_codes` nuls.
select is(
  (select (public.activate_taggo('TGG-FLOW001')).id),
  null::uuid,
  'un tiers ne peut pas activer le TAGGO d''autrui'
);

set local request.jwt.claims = '{"sub":"99999999-9999-4999-8999-000000000009","role":"authenticated","aud":"authenticated","email":"flows@example.com"}';
select is(
  (select (public.set_taggo_status('dddddddd-dddd-4ddd-8ddd-00000000000d', 'active')).is_public),
  true,
  'set_taggo_status(active) publie le TAGGO'
);

-- ===========================================================================
-- 5. Visibilité publique
-- ===========================================================================
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is((select count(*)::integer from public.public_taggo_cards), 1,
  'la page publique voit exactement le TAGGO publié et abonné');
select is(public.get_public_taggo_state('TGG-FLOW001'), 'active',
  'l''état public est active');

-- ===========================================================================
-- 6. Analytics et anti-abus (fenêtre temporelle, aucune donnée de visiteur)
-- ===========================================================================
reset role;
set local role service_role;

select is(public.record_taggo_scan('TGG-FLOW001'), 'recorded',
  'un scan est enregistré');
select is(public.record_taggo_scan('TGG-FLOW001'), 'duplicate',
  'un scan immédiat est ignoré par la fenêtre anti-abus');
select is(public.record_taggo_scan('TGG-ZZZZZZZ'), 'not_found',
  'un code inconnu n''enregistre rien');
select is(public.record_taggo_scan('TGG-FLOW002'), 'not_active',
  'un TAGGO non public n''enregistre rien');
select is(
  (public.get_taggo_scan_stats('dddddddd-dddd-4ddd-8ddd-00000000000d', '99999999-9999-4999-8999-000000000009', 7, 'day')->>'total')::bigint,
  1::bigint,
  'les statistiques comptent exactement un scan'
);
select is(
  public.get_taggo_scan_stats('dddddddd-dddd-4ddd-8ddd-00000000000d', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 7, 'day')->>'reason',
  'not_owner',
  'les statistiques d''un tiers sont refusées'
);

-- ===========================================================================
-- 7. Expiration, refus de réactivation sans renouvellement, puis renouvellement
-- ===========================================================================
-- Les DEUX bornes sont reculées : `subscriptions_period_check` refuse une
-- période qui ne fait pas un an, donc on ne peut pas expirer une période en ne
-- touche que `ends_at`. C'est le comportement voulu du schéma.
update public.subscriptions
set started_at = now() - interval '2 years', ends_at = now() - interval '1 year'
where qr_code_id = 'dddddddd-dddd-4ddd-8ddd-00000000000d';

select is(
  (public.expire_due_taggo_subscriptions()->>'expired_subscriptions')::int,
  1,
  'le balayage expire exactement la période échue'
);
select is(
  (select lifecycle_status from public.qr_codes where public_id = 'TGG-FLOW001'),
  'expired',
  'le TAGGO passe en lifecycle expired'
);
select is(public.reactivate_taggo_subscription('dddddddd-dddd-4ddd-8ddd-00000000000d', '99999999-9999-4999-8999-000000000009')->>'reason',
  'no_valid_subscription',
  'aucune réactivation sans renouvellement confirmé');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::integer from public.public_taggo_cards), 0,
  'un TAGGO expiré disparaît de la vue publique');
select is(public.get_public_taggo_state('TGG-FLOW001'), 'expired',
  'l''état public devient expired');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"99999999-9999-4999-8999-000000000009","role":"authenticated","aud":"authenticated","email":"flows@example.com"}';
select is(
  (select (public.transition_taggo('dddddddd-dddd-4ddd-8ddd-00000000000d', 'active')).id),
  null::uuid,
  'un TAGGO expiré ne peut pas être remis en active sans renouvellement'
);
reset role;

-- Renouvellement confirmé par le serveur, puis réactivation.
select is(
  public.renew_taggo_subscription('dddddddd-dddd-4ddd-8ddd-00000000000d', '99999999-9999-4999-8999-000000000009', now(), 'sub_test', 'price_test')->>'ok',
  'true',
  'renew_taggo_subscription ouvre une nouvelle période'
);
select is(
  public.reactivate_taggo_subscription('dddddddd-dddd-4ddd-8ddd-00000000000d', '99999999-9999-4999-8999-000000000009')->>'ok',
  'true',
  'la réactivation réussit une fois le renouvellement confirmé'
);
select is(
  (select lifecycle_status from public.qr_codes where public_id = 'TGG-FLOW001'),
  'active',
  'le TAGGO redevient actif'
);

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*)::integer from public.public_taggo_cards), 1,
  'la page publique redevient visible après renouvellement');
select is(public.get_public_taggo_state('TGG-FLOW001'), 'active',
  'l''état public redevient active');

-- ===========================================================================
-- 8. Idempotence des emails
-- ===========================================================================
reset role;
select is(public.begin_email_event('ORDER_CONFIRMED:cmd', 'ORDER_CONFIRMED', 'bbbbbbbb-bbbb-4bbb-8bbb-00000000000b', 'hash', 0), true,
  'un email de commande est réservé une première fois');
select is(public.begin_email_event('ORDER_CONFIRMED:cmd', 'ORDER_CONFIRMED', 'bbbbbbbb-bbbb-4bbb-8bbb-00000000000b', 'hash', 0), false,
  'le rejeu de l''événement n''envoie pas un second email');

select * from finish();
rollback;