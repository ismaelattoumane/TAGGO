-- ===========================================================================
-- Étape 13.1 — F3 : les colonnes financières d'une commande restent sous
-- contrôle serveur.
--
-- Rôle client réel `authenticated`, JWT réel. `service_role` n'est JAMAIS
-- utilisé pour prouver qu'un utilisateur est autorisé ou refusé : il sert
-- uniquement à installer une commande de référence (le serveur crée les
-- commandes via `create_shop_order`, pas le navigateur).
-- ===========================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

insert into auth.users (id, email, raw_user_meta_data)
values ('33333333-3333-4333-8333-000000000003', 'f3-owner@example.com', '{"full_name":"F3 Owner"}');
insert into auth.users (id, email, raw_user_meta_data)
values ('44444444-4444-4444-8444-000000000004', 'f3-other@example.com', '{"full_name":"F3 Other"}');

-- Une commande simple, non payée, appartenant à l'utilisateur.
insert into public.orders (id, customer_id, status)
values ('55555555-5555-4555-8555-000000000005', '33333333-3333-4333-8333-000000000003', 'draft');

-- Une commande payée, créée par le serveur, avec les montants réels.
insert into public.orders (id, customer_id, status, subtotal_cents, currency, paid_at, stripe_checkout_session_id)
values ('66666666-6666-4666-8666-000000000006', '33333333-3333-4333-8333-000000000003', 'paid', 4999, 'EUR', now(), 'cs_test_draft');
update public.orders set stripe_checkout_session_id = 'cs_test_paid' where id = '66666666-6666-4666-8666-000000000006';

-- ===========================================================================
-- 1. Droits SQL : le client n'a que `status` en UPDATE
-- ===========================================================================
select is(has_column_privilege('authenticated', 'public.orders', 'currency', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur orders.currency');
select is(has_column_privilege('authenticated', 'public.orders', 'subtotal_cents', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur orders.subtotal_cents');
select is(has_column_privilege('authenticated', 'public.orders', 'paid_at', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur orders.paid_at');
select is(has_column_privilege('authenticated', 'public.orders', 'stripe_checkout_session_id', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur orders.stripe_checkout_session_id');
select is(has_column_privilege('authenticated', 'public.orders', 'stripe_payment_intent_id', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur orders.stripe_payment_intent_id');
select is(has_column_privilege('authenticated', 'public.orders', 'customer_id', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur orders.customer_id');
select is(has_column_privilege('authenticated', 'public.orders', 'status', 'UPDATE'), true,
  'authenticated garde UPDATE sur orders.status');
select is(has_table_privilege('anon', 'public.orders', 'SELECT'), false,
  'anon ne lit aucune commande');
select is(has_table_privilege('anon', 'public.orders', 'INSERT'), false,
  'anon ne crée aucune commande');

-- ===========================================================================
-- 2. Tentatives avec un vrai JWT `authenticated`
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-000000000003","role":"authenticated","aud":"authenticated","email":"f3-owner@example.com"}';

-- 2.1 La devise d'une commande existante.
select throws_ok(
  $$update public.orders set currency = 'USD' where id = '55555555-5555-4555-8555-000000000005'$$,
  '42501', NULL,
  'écriture directe de currency refusée'
);
select throws_ok(
  $$update public.orders set subtotal_cents = 1 where id = '55555555-5555-4555-8555-000000000005'$$,
  '42501', NULL,
  'écriture directe de subtotal_cents refusée'
);
select throws_ok(
  $$update public.orders set paid_at = now() where id = '55555555-5555-4555-8555-000000000005'$$,
  '42501', NULL,
  'écriture directe de paid_at refusée'
);
select throws_ok(
  $$update public.orders set stripe_checkout_session_id = 'cs_fabrique' where id = '55555555-5555-4555-8555-000000000005'$$,
  '42501', NULL,
  'écriture directe d''un identifiant Stripe refusée'
);
select throws_ok(
  $$update public.orders set customer_id = '44444444-4444-4444-8444-000000000004' where id = '55555555-5555-4555-8555-000000000005'$$,
  '42501', NULL,
  'écriture de customer_id refusée : on ne cède pas sa commande à un tiers'
);

-- 2.2 Le passage manuel à `paid` reste interdit, même par une commande à 0 €.
select throws_ok(
  $$update public.orders set status = 'paid' where id = '55555555-5555-4555-8555-000000000005'$$,
  '42501', NULL,
  'un client ne peut pas passer sa commande à paid'
);

-- 2.3 La fabrication d'un montant à la CRÉATION.
select throws_ok(
  $$insert into public.orders (customer_id, status, subtotal_cents, currency)
    values ('33333333-3333-4333-8333-000000000003', 'draft', 1, 'USD')$$,
  '42501', NULL,
  'un client ne peut pas créer une commande avec un montant et une devise'
);
select throws_ok(
  $$insert into public.orders (customer_id, status, currency)
    values ('33333333-3333-4333-8333-000000000003', 'draft', 'EUR')$$,
  '42501', NULL,
  'un client ne peut pas créer une commande portant une devise'
);

-- 2.4 La suppression d'une commande payée.
--     Un DELETE ne lève pas d'erreur : la RLS FILTRE la ligne, donc la
--     suppression porte sur zéro ligne. C'est la sémantique PostgreSQL, et le
--     point qui compte est vérifié juste après : la ligne est toujours là.
select is_empty(
  $$delete from public.orders where id = '66666666-6666-4666-8666-000000000006' returning id$$,
  'suppression d''une commande payée : 0 ligne'
);
select is(
  (select count(*)::integer from public.orders where id = '66666666-6666-4666-8666-000000000006'),
  1,
  'la commande payée est toujours présente'
);

-- 2.5 La commande d'un tiers reste invisible, et une commande payée n'est
--     pas modifiable même par son propre propriétaire.
reset role;
insert into public.orders (id, customer_id, status)
values ('88888888-8888-4888-8888-000000000008', '44444444-4444-4444-8444-000000000004', 'draft');
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-000000000003","role":"authenticated","aud":"authenticated","email":"f3-owner@example.com"}';

select is_empty(
  $$update public.orders set status = 'pending' where id = '88888888-8888-4888-8888-000000000008' returning id$$,
  'mise à jour de la commande d''un tiers : 0 ligne'
);
select throws_ok(
  $$update public.orders set status = 'pending' where id = '66666666-6666-4666-8666-000000000006'$$,
  '42501', NULL,
  'même sur SA commande payée, le statut reste verrouillé (with check)'
);
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-000000000004","role":"authenticated","aud":"authenticated"}';
select is_empty(
  $$select id from public.orders where id = '55555555-5555-4555-8555-000000000005'$$,
  'un tiers ne voit pas la commande d''un autre'
);

-- ===========================================================================
-- 3. Les chemins légitimes fonctionnent toujours
-- ===========================================================================
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-000000000003","role":"authenticated","aud":"authenticated","email":"f3-owner@example.com"}';

-- 3.1 Mise à jour du statut : le seul UPDATE client autorisé.
update public.orders set status = 'pending' where id = '55555555-5555-4555-8555-000000000005';
select is((select status from public.orders where id = '55555555-5555-4555-8555-000000000005'), 'pending',
  'le client peut faire passer sa commande de draft à pending');

-- 3.2 Création d'une commande par le RPC serveur : le prix est calculé en base.
select throws_ok(
  $$select public.create_shop_order('[]'::jsonb)$$,
  'P0001', 'empty_cart',
  'create_shop_order refuse un panier vide'
);
select throws_ok(
  $$select public.create_shop_order('[{"variantId":"11111111-1111-4111-8111-111111111112","quantity":1}]'::jsonb)$$,
  'P0001', 'price_unavailable',
  'aucun montant n''est inventé : un prix non publié refuse la commande'
);

-- 3.3 La commande payée garde ses colonnes financières intactes.
reset role;
select is((select currency from public.orders where id = '66666666-6666-4666-8666-000000000006'), 'EUR',
  'la devise d''une commande payée est intacte');
select is((select subtotal_cents from public.orders where id = '66666666-6666-4666-8666-000000000006'), 4999,
  'le montant d''une commande payée est intact');
select is((select stripe_checkout_session_id from public.orders where id = '66666666-6666-4666-8666-000000000006'), 'cs_test_paid',
  'la référence Stripe d''une commande payée est intacte');

-- 3.4 `mark_shop_order_paid` reste réservé au service, et il est idempotent.
select is(has_function_privilege('authenticated', 'public.mark_shop_order_paid(uuid, text, text, integer, text)', 'EXECUTE'), false,
  'mark_shop_order_paid n''est pas exécutable par un client');
select is(has_function_privilege('service_role', 'public.mark_shop_order_paid(uuid, text, text, integer, text)', 'EXECUTE'), true,
  'mark_shop_order_paid reste exécutable par le webhook');

-- 3.5 `attachStripeSession` passe par `service_role` : le droit UPDATE de table
--     ne doit donc pas avoir été retiré au service.
select is(has_table_privilege('service_role', 'public.orders', 'UPDATE'), true,
  'service_role garde UPDATE sur orders (webhook)');

select * from finish();
rollback;