begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('22222222-2222-4222-8222-000000000022', 'owner-141@example.invalid', now(), '{"full_name":"Owner"}'),
  ('33333333-3333-4333-8333-000000000033', 'other-141@example.invalid', now(), '{"full_name":"Other"}');

-- Simulate a missing profile so the authenticated INSERT path is exercised.
delete from public.profiles where id = '22222222-2222-4222-8222-000000000022';

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"22222222-2222-4222-8222-000000000022"}';

insert into public.profiles (id, email, full_name)
values ('22222222-2222-4222-8222-000000000022', 'attacker@example.invalid', 'Owner');

select is(
  (select email from public.profiles where id = '22222222-2222-4222-8222-000000000022'),
  'owner-141@example.invalid',
  'une insertion de profil prend l''email Auth et ignore celui du client'
);

select throws_ok(
  $$insert into public.profiles (id, email, full_name)
    values ('33333333-3333-4333-8333-000000000033', 'forged@example.invalid', 'Other')$$,
  '42501', NULL,
  'un utilisateur ne peut pas insérer le profil d''un autre compte'
);

select throws_ok(
  $$update public.profiles set email = 'forged@example.invalid'
    where id = '22222222-2222-4222-8222-000000000022'$$,
  '42501', NULL,
  'un utilisateur ne peut pas modifier directement son email'
);

update public.profiles
set full_name = 'Updated Owner'
where id = '22222222-2222-4222-8222-000000000022';

select is(
  (select full_name from public.profiles where id = '22222222-2222-4222-8222-000000000022'),
  'Updated Owner',
  'les autres champs du profil restent modifiables'
);

update public.profiles
set full_name = 'Hijacked'
where id = '33333333-3333-4333-8333-000000000033';

select is(
  (select count(*)::integer from public.profiles
   where id = '33333333-3333-4333-8333-000000000033' and full_name = 'Hijacked'),
  0,
  'une mise à jour de profil tiers ne touche aucune ligne'
);

reset role;
update auth.users
   set email = 'pending-141@example.invalid',
       email_change = 'pending-141@example.invalid',
       email_confirmed_at = null
 where id = '22222222-2222-4222-8222-000000000022';

select is(
  (select email from public.profiles where id = '22222222-2222-4222-8222-000000000022'),
  'owner-141@example.invalid',
  'un changement Auth non confirmé ne remplace pas l''email du profil'
);

update auth.users
   set email_change = null,
       email_confirmed_at = now()
 where id = '22222222-2222-4222-8222-000000000022';

select is(
  (select email from public.profiles where id = '22222222-2222-4222-8222-000000000022'),
  'pending-141@example.invalid',
  'un changement Auth confirmé synchronise le profil'
);

insert into public.orders (id, customer_id, status, subtotal_cents, currency, paid_at)
values (
  '66666666-6666-4666-8666-000000000001',
  '22222222-2222-4222-8222-000000000022',
  'paid',
  1000,
  'EUR',
  now()
);

update auth.users
   set email_confirmed_at = null,
       email_change = 'unconfirmed-141@example.invalid'
 where id = '22222222-2222-4222-8222-000000000022';

select is(
  public.get_confirmed_order_recipient('66666666-6666-4666-8666-000000000001'),
  null::text,
  'aucune destination de commande n''est renvoyée pour un email non confirmé'
);

update auth.users
   set email_confirmed_at = now(),
       email_change = null
 where id = '22222222-2222-4222-8222-000000000022';

select is(
  public.get_confirmed_order_recipient('66666666-6666-4666-8666-000000000001'),
  'pending-141@example.invalid',
  'la destination de commande provient de l''email Auth confirmé'
);

update auth.users
   set email_change = 'another-pending-141@example.invalid'
 where id = '22222222-2222-4222-8222-000000000022';

select is(
  public.get_confirmed_order_recipient('66666666-6666-4666-8666-000000000001'),
  null::text,
  'un changement Auth en attente bloque l''envoi à l''ancienne ou nouvelle adresse'
);

reset role;
insert into public.qr_codes (id, owner_id, public_id, status, lifecycle_status, is_public, title, destination_url)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', '22222222-2222-4222-8222-000000000022', 'TGG-1410001', 'draft', 'available', false, 'Expired', 'https://example.invalid/expired'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', '22222222-2222-4222-8222-000000000022', 'TGG-1410002', 'draft', 'available', false, 'Valid', 'https://example.invalid/valid'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', '22222222-2222-4222-8222-000000000022', 'TGG-1410003', 'draft', 'available', false, 'Assigned', 'https://example.invalid/assigned'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004', '22222222-2222-4222-8222-000000000022', 'TGG-1410004', 'draft', 'available', false, 'Paid order', 'https://example.invalid/order'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000005', '22222222-2222-4222-8222-000000000022', 'TGG-1410005', 'draft', 'available', false, 'Expired sub', 'https://example.invalid/sub'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006', '22222222-2222-4222-8222-000000000022', 'TGG-1410006', 'draft', 'available', false, 'Scanned', 'https://example.invalid/scan'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000007', '22222222-2222-4222-8222-000000000022', 'TGG-1410007', 'draft', 'available', false, 'Public profile', 'https://example.invalid/profile'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000008', '22222222-2222-4222-8222-000000000022', 'TGG-1410008', 'draft', 'available', false, 'Unused', 'https://example.invalid/unused'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000009', '22222222-2222-4222-8222-000000000022', 'TGG-1410009', 'draft', 'available', false, 'No subscription', 'https://example.invalid/no-sub'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000010', '22222222-2222-4222-8222-000000000022', 'TGG-1410010', 'draft', 'available', false, 'Inactive subscription', 'https://example.invalid/inactive-sub');

update public.qr_codes
set status = 'active', lifecycle_status = 'active', is_public = true
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000002',
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000009',
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000010'
);

insert into public.subscriptions (qr_code_id, user_id, status, plan_name, source, auto_renew, started_at, ends_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', '22222222-2222-4222-8222-000000000022', 'active', 'taggo_annual', 'included', false, now() - interval '2 years', now() - interval '1 year'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', '22222222-2222-4222-8222-000000000022', 'active', 'taggo_annual', 'included', false, now() - interval '1 month', now() + interval '11 months'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000005', '22222222-2222-4222-8222-000000000022', 'expired', 'taggo_annual', 'included', false, now() - interval '2 years', now() - interval '1 year'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000010', '22222222-2222-4222-8222-000000000022', 'expired', 'taggo_annual', 'included', false, now() - interval '1 month', now() + interval '11 months');

insert into public.orders (id, customer_id, status, subtotal_cents, currency, paid_at)
values ('66666666-6666-4666-8666-000000000002', '22222222-2222-4222-8222-000000000022', 'paid', 2000, 'EUR', now());

insert into public.taggo_assignments (qr_code_id, order_id, assigned_user_id, status, assigned_by, assigned_at)
values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', '66666666-6666-4666-8666-000000000002', '22222222-2222-4222-8222-000000000022', 'assigned', 'stripe', now());

insert into public.order_items (order_id, product_type, quantity, taggo_id)
values ('66666666-6666-4666-8666-000000000002', 'taggo', 1, 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004');

insert into public.taggo_scans (qr_code_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000006');
insert into public.public_profiles (qr_code_id, display_name)
values ('aaaaaaaa-aaaa-4aaa-8aaa-000000000007', 'Public Profile');

create temporary table __step141_qr_snapshot on commit drop as
select id, status, lifecycle_status, updated_at
from public.qr_codes
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select is(
  public.get_public_taggo_state('TGG-1410001'),
  'expired',
  'un abonnement actif mais échu est publiquement expiré avant le balayage'
);

reset role;
select is(
  (select status from public.subscriptions where qr_code_id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  'active',
  'la lecture anonyme ne modifie pas le statut de l''abonnement'
);
select is(
  (select status from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  (select status from __step141_qr_snapshot where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  'la lecture anonyme ne modifie pas le statut public du QR'
);
select is(
  (select lifecycle_status from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  (select lifecycle_status from __step141_qr_snapshot where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  'la lecture anonyme ne modifie pas le cycle de vie du QR'
);
select is(
  (select updated_at from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  (select updated_at from __step141_qr_snapshot where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  'la lecture anonyme ne modifie pas le timestamp du QR'
);
select is(
  public.taggo_subscription_allows_public('aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  false,
  'le prédicat public refuse l''abonnement échu sans balayage'
);
select is(
  public.record_taggo_scan('TGG-1410001'),
  'not_active',
  'un scan échoué ne renvoie pas la destination d''un TAGGO expiré'
);
select is(
  (select count(*)::integer from public.taggo_scans where qr_code_id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'),
  0,
  'aucun scan n''est enregistré pour un TAGGO expiré'
);
select is(
  public.get_public_taggo_state('TGG-1410002'),
  'active',
  'un TAGGO avec abonnement valide reste consultable'
);

select is(
  public.taggo_subscription_allows_public('aaaaaaaa-aaaa-4aaa-8aaa-000000000009'),
  false,
  'le prédicat refuse un TAGGO sans abonnement'
);
select is(
  public.get_public_taggo_state('TGG-1410009'),
  'subscription_required',
  'un TAGGO sans abonnement ne divulgue pas sa destination'
);
select is(
  public.taggo_subscription_allows_public('aaaaaaaa-aaaa-4aaa-8aaa-000000000010'),
  false,
  'le prédicat refuse un abonnement au statut non actif'
);
select is(
  public.get_public_taggo_state('TGG-1410010'),
  'expired',
  'un abonnement non actif ne rend pas le TAGGO public'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"22222222-2222-4222-8222-000000000022"}';
delete from public.qr_codes
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008';

select is(
  (select count(*)::integer from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000008'),
  0,
  'le propriétaire peut supprimer physiquement un TAGGO sans historique'
);

select throws_ok(
  $$delete from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'$$,
  '23503', NULL,
  'une affectation bloque la suppression physique'
);
select throws_ok(
  $$delete from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004'$$,
  '23503', NULL,
  'une référence de commande payée bloque la suppression physique'
);
select throws_ok(
  $$delete from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005'$$,
  '23503', NULL,
  'un abonnement expiré bloque la suppression physique'
);
select throws_ok(
  $$delete from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000006'$$,
  '23503', NULL,
  'un historique de scans bloque la suppression physique'
);
select throws_ok(
  $$delete from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000007'$$,
  '23503', NULL,
  'un profil public lié bloque la suppression physique'
);

set local request.jwt.claims = '{"role":"authenticated","sub":"33333333-3333-4333-8333-000000000033"}';
delete from public.qr_codes
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003';

reset role;
select is(
  (select count(*)::integer from public.qr_codes where id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003'),
  1,
  'un tiers ne peut pas supprimer le TAGGO affecté d''un autre utilisateur'
);

select is(
  has_function_privilege('authenticated', 'public.get_confirmed_order_recipient(uuid)', 'EXECUTE'),
  false,
  'les clients ne peuvent pas appeler la fonction de résolution du destinataire'
);

select * from finish();
rollback;
