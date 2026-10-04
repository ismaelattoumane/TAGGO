-- ===========================================================================
-- Étape 13.1 — F4 : le cycle de vie d'un TAGGO est écrit par le serveur.
--
-- Exécution : voir supabase/tests/README.md.
--
-- Les tentatives sont exécutées avec le RÔLE CLIENT RÉEL (`authenticated`) et
-- un JWT RÉEL mis en place exactement comme PostgREST le fait après validation
-- d'un Bearer token : `request.jwt.claims` reçoit les claims, `auth.uid()` les
-- relit. Aucune conclusion n'est tirée de `service_role` : ce rôle sert
-- uniquement à installer des données de test en tant que propriétaire de la
-- table, jamais à prouver qu'un utilisateur normal est autorisé ou refusé.
-- ===========================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(45);

-- ---------------------------------------------------------------------------
-- Données de test (posées avec les droits du propriétaire de la table, donc
-- hors RLS : c'est de la mise en place, pas une démonstration d'autorisation).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-4111-8111-000000000001', 'f4-owner@example.com', '{"full_name":"F4 Owner"}');
insert into auth.users (id, email, raw_user_meta_data)
values ('22222222-2222-4222-8222-000000000002', 'f4-attacker@example.com', '{"full_name":"F4 Attacker"}');

-- TAGGO possédé par `owner`, dans l'état produit par l'activation réelle.
insert into public.qr_codes (owner_id, public_id, status, lifecycle_status, is_public, title, destination_url)
values ('11111111-1111-4111-8111-000000000001', 'TGG-F4TEST1', 'draft', 'activated', false, 'F4 test', 'https://example.com/f4');

-- TAGGO du stock, non possédé : sert à prouver qu'un client ne peut plus
-- s'attribuer un TAGGO disponible.
insert into public.qr_codes (public_id, status, lifecycle_status, is_public)
values ('TGG-F4STOCK', 'draft', 'available', false);

-- ===========================================================================
-- 1. Le droit SQL pur : les colonnes serveur ne sont pas accordées
-- ===========================================================================
select is(has_column_privilege('authenticated', 'public.qr_codes', 'lifecycle_status', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur lifecycle_status');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'status', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur status');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'activated_at', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur activated_at');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'reserved_at', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur reserved_at');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'assigned_at', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur assigned_at');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'is_public', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur is_public');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'owner_id', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur owner_id');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'public_id', 'UPDATE'), false,
  'authenticated n''a pas UPDATE sur public_id');
select is(has_column_privilege('anon', 'public.qr_codes', 'lifecycle_status', 'UPDATE'), false,
  'anon n''a pas UPDATE sur lifecycle_status');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'owner_id', 'INSERT'), true,
  'authenticated garde INSERT sur owner_id : la création d''un TAGGO reste possible');

-- Le contenu, lui, reste éditable : sinon le produit est cassé.
select is(has_column_privilege('authenticated', 'public.qr_codes', 'title', 'UPDATE'), true,
  'authenticated garde UPDATE sur title');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'destination_url', 'UPDATE'), true,
  'authenticated garde UPDATE sur destination_url');
select is(has_column_privilege('authenticated', 'public.qr_codes', 'description', 'UPDATE'), true,
  'authenticated garde UPDATE sur description');

-- ===========================================================================
-- 2. Surface d'appel des RPC de cycle de vie
-- ===========================================================================
select is(has_function_privilege('authenticated', 'public.assign_taggo_to_user(uuid)', 'EXECUTE'), false,
  'assign_taggo_to_user n''est plus exécutable par un client');
select is(has_function_privilege('anon', 'public.assign_taggo_to_user(uuid)', 'EXECUTE'), false,
  'assign_taggo_to_user n''est plus exécutable par un anonyme');
select is(has_function_privilege('public', 'public.assign_taggo_to_user(uuid)', 'EXECUTE'), false,
  'assign_taggo_to_user n''est plus exécutable par PUBLIC');
select is(has_function_privilege('anon', 'public.transition_taggo(uuid, text)', 'EXECUTE'), false,
  'transition_taggo n''est pas exécutable par un anonyme');
select is(has_function_privilege('anon', 'public.set_taggo_status(uuid, text)', 'EXECUTE'), false,
  'set_taggo_status n''est pas exécutable par un anonyme');
select is(has_function_privilege('authenticated', 'public.transition_taggo(uuid, text)', 'EXECUTE'), true,
  'transition_taggo reste exécutable par le propriétaire');
select is(has_function_privilege('authenticated', 'public.set_taggo_status(uuid, text)', 'EXECUTE'), true,
  'set_taggo_status reste exécutable par le propriétaire');

-- ===========================================================================
-- 3. Tentatives réelles, rôle `authenticated` + vrai JWT
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-000000000001","role":"authenticated","aud":"authenticated","email":"f4-owner@example.com"}';

select throws_ok(
  $$update public.qr_codes set lifecycle_status = 'active' where public_id = 'TGG-F4TEST1'$$,
  '42501', NULL,
  'écriture directe de lifecycle_status refusée'
);
select throws_ok(
  $$update public.qr_codes set status = 'active' where public_id = 'TGG-F4TEST1'$$,
  '42501', NULL,
  'écriture directe de status refusée'
);
select throws_ok(
  $$update public.qr_codes set is_public = true where public_id = 'TGG-F4TEST1'$$,
  '42501', NULL,
  'écriture directe de is_public refusée'
);
select throws_ok(
  $$update public.qr_codes set activated_at = now() where public_id = 'TGG-F4TEST1'$$,
  '42501', NULL,
  'écriture directe de activated_at refusée'
);
select throws_ok(
  $$update public.qr_codes set reserved_at = now() where public_id = 'TGG-F4TEST1'$$,
  '42501', NULL,
  'écriture directe de reserved_at refusée'
);
select throws_ok(
  $$update public.qr_codes set owner_id = '22222222-2222-4222-8222-000000000002' where public_id = 'TGG-F4TEST1'$$,
  '42501', NULL,
  'écriture directe de owner_id refusée'
);
select throws_ok(
  $$update public.qr_codes set lifecycle_status = 'active', status = 'active', is_public = true where public_id = 'TGG-F4TEST1'$$,
  '42501', NULL,
  'écriture combinée des trois champs serveur refusée'
);
select throws_ok(
  $$insert into public.qr_codes (owner_id, public_id, status, lifecycle_status, is_public)
    values ('11111111-1111-4111-8111-000000000001', 'TGG-F4NEW01', 'active', 'active', true)$$,
  '42501', 'qr_codes_must_be_created_as_draft',
  'un client ne peut pas créer un TAGGO déjà actif et public'
);
select throws_ok(
  $$insert into public.qr_codes (owner_id, public_id, status, lifecycle_status, is_public, activated_at)
    values ('11111111-1111-4111-8111-000000000001', 'TGG-F4NEW02', 'draft', 'activated', false, now())$$,
  '42501', 'qr_codes_server_fields_are_read_only',
  'un client ne peut pas fournir activated_at à la création'
);
select throws_ok(
  $$insert into public.qr_codes (owner_id, public_id, status, lifecycle_status)
    values ('22222222-2222-4222-8222-000000000002', 'TGG-F4NEW03', 'draft', 'activated')$$,
  '42501', NULL,
  'un client ne peut pas créer un TAGGO au nom d''un tiers'
);
select throws_ok(
  $$select public.assign_taggo_to_user((select id from public.qr_codes where public_id = 'TGG-F4STOCK'))$$,
  '42501', NULL,
  'un client ne peut pas s''attribuer un TAGGO du stock'
);

-- La création légitime d'un TAGGO fonctionne toujours.
insert into public.qr_codes (owner_id, public_id, title, destination_url, lifecycle_status)
values ('11111111-1111-4111-8111-000000000001', 'TGG-F4NEW04', 'nouveau', 'https://example.com/new', 'activated');
select is((select count(*)::integer from public.qr_codes where public_id = 'TGG-F4NEW04'), 1,
  'un client peut toujours créer son TAGGO');

-- Le contenu légitime passe, et RLS interdit de toucher le TAGGO d'autrui.
update public.qr_codes set title = 'titre legit' where public_id = 'TGG-F4TEST1';
select is((select title from public.qr_codes where public_id = 'TGG-F4TEST1'), 'titre legit',
  'le propriétaire peut modifier le titre de son TAGGO');

-- Même contenu, mais avec le JWT d'un tiers : RLS filtre, rien n'est écrit.
set local request.jwt.claims = '{"sub":"22222222-2222-4222-8222-000000000002","role":"authenticated","aud":"authenticated","email":"f4-attacker@example.com"}';
select is_empty(
  $$update public.qr_codes set title = 'vole' where public_id = 'TGG-F4TEST1' returning id$$,
  'mise à jour du TAGGO d''un tiers : 0 ligne'
);
select is((select count(*)::integer from public.qr_codes where title = 'vole'), 0,
  'aucune ligne volée n''a été écrite');

-- ===========================================================================
-- 4. Les chemins AUTORISÉS fonctionnent toujours (rôle `authenticated`)
-- ===========================================================================
-- 4.1 Entrer dans `active` sans période est refusé : c'est le garde-fou du
--     modèle commercial, il doit survivre au durcissement.
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-000000000001","role":"authenticated","aud":"authenticated","email":"f4-owner@example.com"}';
select is(
  (select (public.transition_taggo(id, 'active')).id from public.qr_codes where public_id = 'TGG-F4TEST1'),
  null::uuid,
  'transition vers active refusée sans abonnement (retour NULL, aucune écriture)'
);
select is(
  (select lifecycle_status from public.qr_codes where public_id = 'TGG-F4TEST1'),
  'activated',
  'le cycle de vie n''a pas bougé'
);

-- 4.2 Le TAGGO d'autrui n'est pas transitionnable (le JWT est toujours celui
--     du tiers posé ci-dessus).
select is(
  (select (public.transition_taggo(id, 'inactive')).id from public.qr_codes where public_id = 'TGG-F4TEST1'),
  null::uuid,
  'un tiers ne peut pas transitionner le TAGGO de quelqu''un d''autre'
);

-- 4.3 `set_taggo_status` refuse `active` sans période.
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-000000000001","role":"authenticated","aud":"authenticated","email":"f4-owner@example.com"}';
select throws_ok(
  $$select public.set_taggo_status((select id from public.qr_codes where public_id = 'TGG-F4TEST1'), 'active')$$,
  'P0001', 'subscription_required',
  'set_taggo_status(active) refusé sans abonnement'
);

-- 4.4 Avec une période valide, les deux chemins autorisés écrivent vraiment.
reset role;
insert into public.subscriptions (qr_code_id, user_id, status, plan_name, source, auto_renew, started_at, ends_at)
select id, '11111111-1111-4111-8111-000000000001', 'active', 'taggo_annual', 'included', false,
       now(), now() + interval '1 year'
from public.qr_codes where public_id = 'TGG-F4TEST1';

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-000000000001","role":"authenticated","aud":"authenticated","email":"f4-owner@example.com"}';

select is(
  (select (public.transition_taggo(id, 'active')).lifecycle_status from public.qr_codes where public_id = 'TGG-F4TEST1'),
  'active',
  'transition_taggo(active) fonctionne avec un abonnement valide'
);
select is(
  (select (public.set_taggo_status(id, 'inactive')).status from public.qr_codes where public_id = 'TGG-F4TEST1'),
  'inactive',
  'set_taggo_status(inactive) fonctionne'
);
select is(
  (select (public.set_taggo_status(id, 'active')).is_public from public.qr_codes where public_id = 'TGG-F4TEST1'),
  true,
  'set_taggo_status(active) republie le TAGGO'
);
select is(
  (select (public.set_taggo_status(id, 'archived')).status from public.qr_codes where public_id = 'TGG-F4TEST1'),
  'archived',
  'set_taggo_status(archived) fonctionne'
);

-- 4.5 Un TAGGO remplacé ne redevient jamais actif.
select is(
  (select (public.transition_taggo(id, 'replaced')).lifecycle_status from public.qr_codes where public_id = 'TGG-F4TEST1'),
  'replaced',
  'transition_taggo(replaced) fonctionne'
);
select throws_ok(
  $$select public.set_taggo_status((select id from public.qr_codes where public_id = 'TGG-F4TEST1'), 'active')$$,
  'P0001', 'invalid_lifecycle_transition',
  'un TAGGO remplacé ne redevient jamais actif'
);

select * from finish();
rollback;