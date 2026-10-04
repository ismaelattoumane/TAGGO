-- ===========================================================================
-- Étape 13.1 — F2 : l'anonyme n'obtient que ce qu'il faut pour afficher la
-- page publique, et jamais `owner_id`.
--
-- Rôle client réel `anon`, JWT réel (`request.jwt.claims`). Voir
-- supabase/tests/README.md.
--
-- Une RLS filtre des LIGNES, jamais des COLONNES : la correction ne consiste
-- donc pas à « cacher » `owner_id` dans React, mais à supprimer le chemin qui
-- le renvoyait (`select *` sur la table). Ces tests prouvent que le droit SQL
-- lui-même est retiré, et non que la donnée est masquée plus haut.
-- ===========================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(43);

-- ---------------------------------------------------------------------------
-- Mise en place
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-4111-8111-000000000011', 'f2-owner@example.com', '{"full_name":"F2 Owner"}');

-- 1. TAGGO public, actif, destiné, abonné : c'est le seul visible.
--    Il est créé `draft` puis mis en ligne par le PROPRIÉTAIRE DE LA TABLE
--    (donc hors RLS, `current_user = relowner`) : le trigger de l'étape 13.1
--    refuse `status <> 'draft'` à l'INSERT pour n'importe qui d'autre. Cette
--    publication par le serveur est exactement ce que fait `set_taggo_status`.
insert into public.qr_codes (owner_id, public_id, status, lifecycle_status, is_public, title, destination_url)
values ('11111111-1111-4111-8111-000000000011', 'TGG-F2OPEN1', 'draft', 'activated', false, 'Public TAGGO', 'https://example.com/public');
update public.qr_codes set status = 'active', lifecycle_status = 'active', is_public = true
where public_id = 'TGG-F2OPEN1';
insert into public.subscriptions (qr_code_id, user_id, status, plan_name, source, auto_renew, started_at, ends_at)
select id, '11111111-1111-4111-8111-000000000011', 'active', 'taggo_annual', 'included', false, now(), now() + interval '1 year'
from public.qr_codes where public_id = 'TGG-F2OPEN1';

-- 2. TAGGO public et destiné mais SANS période : pas publiquement accessible.
insert into public.qr_codes (owner_id, public_id, status, lifecycle_status, is_public, title, destination_url)
values ('11111111-1111-4111-8111-000000000011', 'TGG-F2OPEN2', 'draft', 'activated', false, 'Sans abonnement', 'https://example.com/nosub');
update public.qr_codes set status = 'active', lifecycle_status = 'active', is_public = true
where public_id = 'TGG-F2OPEN2';

-- 3. TAGGO public avec une période ÉCHUE : expiré.
insert into public.qr_codes (owner_id, public_id, status, lifecycle_status, is_public, title, destination_url)
values ('11111111-1111-4111-8111-000000000011', 'TGG-F2OPEN3', 'draft', 'activated', false, 'Expire', 'https://example.com/expire');
update public.qr_codes set status = 'active', lifecycle_status = 'active', is_public = true
where public_id = 'TGG-F2OPEN3';
insert into public.subscriptions (qr_code_id, user_id, status, plan_name, source, auto_renew, started_at, ends_at)
select id, '11111111-1111-4111-8111-000000000011', 'expired', 'taggo_annual', 'included', false, now() - interval '2 years', now() - interval '1 year'
from public.qr_codes where public_id = 'TGG-F2OPEN3';

-- 4. TAGGO du propriétaire, non publié : jamais visible publiquement.
insert into public.qr_codes (owner_id, public_id, status, lifecycle_status, is_public, title, destination_url)
values ('11111111-1111-4111-8111-000000000011', 'TGG-F2PRIV1', 'draft', 'activated', false, 'Prive', 'https://example.com/private');

insert into public.public_profiles (qr_code_id, display_name, headline, bio)
select id, 'Profil public', 'Une accroche', 'Une bio'
from public.qr_codes where public_id = 'TGG-F2OPEN1';

-- ===========================================================================
-- 1. Droits SQL réels : plus aucun droit de l'anonyme sur la table
-- ===========================================================================
select is(has_table_privilege('anon', 'public.qr_codes', 'SELECT'), false,
  'anon n''a plus SELECT sur qr_codes');
select is(has_table_privilege('anon', 'public.qr_codes', 'INSERT'), false,
  'anon n''a plus INSERT sur qr_codes');
select is(has_table_privilege('anon', 'public.qr_codes', 'UPDATE'), false,
  'anon n''a plus UPDATE sur qr_codes');
select is(has_table_privilege('anon', 'public.qr_codes', 'DELETE'), false,
  'anon n''a plus DELETE sur qr_codes');
select is(has_table_privilege('anon', 'public.public_taggo_cards', 'SELECT'), true,
  'anon lit la vue publique');
select is(has_table_privilege('anon', 'public.public_taggo_cards', 'INSERT'), false,
  'la vue publique n''est pas inscriptible');
select is(has_table_privilege('anon', 'public.public_taggo_cards', 'UPDATE'), false,
  'la vue publique n''est pas modifiable');
select is(has_table_privilege('anon', 'public.public_taggo_cards', 'DELETE'), false,
  'la vue publique n''est pas supprimable');
select is(has_table_privilege('anon', 'public.taggo_assignments', 'SELECT'), false,
  'anon ne lit pas les affectations de TAGGO');
select is(has_table_privilege('anon', 'public.subscriptions', 'SELECT'), false,
  'anon ne lit pas les abonnements');
select is(has_table_privilege('anon', 'public.orders', 'SELECT'), false,
  'anon ne lit pas les commandes');
select is(has_table_privilege('anon', 'public.stripe_webhook_events', 'SELECT'), false,
  'anon ne lit pas les événements Stripe');
select is(has_table_privilege('anon', 'public.email_events', 'SELECT'), false,
  'anon ne lit pas le journal des emails');
select is(has_table_privilege('anon', 'public.taggo_scan_settings', 'SELECT'), false,
  'anon ne lit pas les réglages anti-abus');
select is(has_table_privilege('anon', 'public.taggo_scans', 'SELECT'), false,
  'anon ne lit pas les scans');
select is(has_table_privilege('anon', 'public.products', 'SELECT'), true,
  'anon lit le catalogue public des produits');

-- ===========================================================================
-- 2. La vue est une liste blanche de colonnes
-- ===========================================================================
select hasnt_column('public', 'public_taggo_cards', 'owner_id',
  'la vue publique ne projette pas owner_id');
select hasnt_column('public', 'public_taggo_cards', 'lifecycle_status',
  'la vue publique ne projette pas lifecycle_status');
select hasnt_column('public', 'public_taggo_cards', 'reserved_at',
  'la vue publique ne projette pas reserved_at');
select hasnt_column('public', 'public_taggo_cards', 'assigned_at',
  'la vue publique ne projette pas assigned_at');
select hasnt_column('public', 'public_taggo_cards', 'activated_at',
  'la vue publique ne projette pas activated_at');
select hasnt_column('public', 'public_taggo_cards', 'created_at',
  'la vue publique ne projette pas created_at');
select hasnt_column('public', 'public_taggo_cards', 'updated_at',
  'la vue publique ne projette pas updated_at');

-- `results_eq` est volontairement évité ici : dans l'image Supabase, la
-- comparaison de texte de pgTAP échoue sur la collation des domaines
-- `information_schema.sql_identifier` ("could not determine which collation").
-- La même vérification en `is()` ne dépend d'aucune collation.
select is(
  (select string_agg(column_name::text, ',' order by ordinal_position)
     from information_schema.columns
    where table_schema = 'public' and table_name = 'public_taggo_cards'),
  'id,public_id,title,destination_url,status',
  'la vue ne contient exactement que les colonnes attendues'
);

-- ===========================================================================
-- 3. Lecture anonyme réelle
-- ===========================================================================
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$select owner_id from public.qr_codes$$,
  '42501', NULL,
  'l''anonyme ne peut pas lire owner_id depuis la table'
);
select throws_ok(
  $$select * from public.qr_codes$$,
  '42501', NULL,
  'l''anonyme ne peut pas faire select * sur qr_codes'
);
select throws_ok(
  $$select owner_id from public.public_taggo_cards$$,
  '42703', 'column "owner_id" does not exist',
  'owner_id n''existe pas dans la vue : impossible à demander, donc à recevoir'
);

-- La vue est en LECTURE SEULE. Sans ce droit retiré, une écriture à travers
-- elle passerait avec les droits du propriétaire de la vue, donc SANS que la
-- RLS de `qr_codes` soit évaluée : l'anonyme pourrait insérer un TAGGO.
select throws_ok(
  $$insert into public.public_taggo_cards (public_id, title, destination_url)
    values ('TGG-F2EVIL1', 'owned by nobody', 'https://evil.example')$$,
  '42501', NULL,
  'l''anonyme ne peut pas écrire un TAGGO à travers la vue publique'
);
select throws_ok(
  $$update public.public_taggo_cards set title = 'pirate' where public_id = 'TGG-F2OPEN1'$$,
  '42501', NULL,
  'l''anonyme ne peut pas modifier un TAGGO à travers la vue publique'
);
select throws_ok(
  $$delete from public.public_taggo_cards where public_id = 'TGG-F2OPEN1'$$,
  '42501', NULL,
  'l''anonyme ne peut pas supprimer un TAGGO à travers la vue publique'
);

-- Les données publiques restent accessibles et correctes.
select is((select count(*)::integer from public.public_taggo_cards), 1,
  'la vue ne renvoie que le seul TAGGO réellement public et abonné');
select is((select public_id from public.public_taggo_cards), 'TGG-F2OPEN1',
  'le bon TAGGO est renvoyé');
select is((select title from public.public_taggo_cards), 'Public TAGGO',
  'le titre public est lisible');
select is((select destination_url from public.public_taggo_cards), 'https://example.com/public',
  'la destination publique est lisible');
select is((select status from public.public_taggo_cards), 'active',
  'le statut public est lisible');

-- Le profil public reste lisible : la page publique n'est pas amputée.
select is((select display_name from public.public_profiles), 'Profil public',
  'le profil public reste lisible par l''anonyme');

-- `get_public_taggo_state` : les états diagnostics restent corrects.
select is(public.get_public_taggo_state('TGG-F2OPEN1'), 'active',
  'état public : active pour un TAGGO publié et abonné');
select is(public.get_public_taggo_state('TGG-F2OPEN2'), 'subscription_required',
  'état public : subscription_required sans période');
select is(public.get_public_taggo_state('TGG-F2OPEN3'), 'expired',
  'état public : expired pour une période échue');
select is(public.get_public_taggo_state('TGG-F2PRIV1'), 'unactivated',
  'état public : unactivated pour un TAGGO jamais activé');
select is(public.get_public_taggo_state('TGG-ZZZZZZZ'), 'not_found',
  'état public : not_found pour un code inconnu');

reset role;

-- ===========================================================================
-- 4. Le propriétaire, lui, lit toujours son propre TAGGO, `owner_id` compris
-- ===========================================================================
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-4111-8111-000000000011","role":"authenticated","aud":"authenticated"}';

select is((select owner_id::text from public.qr_codes where public_id = 'TGG-F2PRIV1'),
  '11111111-1111-4111-8111-000000000011',
  'le propriétaire lit bien son propre owner_id depuis la table');
select is((select count(*)::integer from public.qr_codes), 4,
  'le propriétaire voit ses 4 TAGGO');

select * from finish();
rollback;