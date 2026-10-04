-- ===========================================================================
-- Étape 13.1 (suite) — Corrections du durcissement F4 / F3 après re-test réel
-- ===========================================================================
--
--Cette migration NE REMPLACE PAS les deux migrations précédentes de l'étape
-- 13.1 :
--   * `20260931110000_taggo_write_protection` (F4 + F3)
--   * `20260931120000_public_taggo_exposure`   (F2)
-- Elle les COMPLETE, sur trois points que le rejeu des migrations sur une base
-- Supabase locale propre a mis en évidence. Le principe retenu reste celui du
-- projet : jamais de réécriture d'une migration déjà appliquée, toujours de
-- l'aditif (`create or replace`, `drop ... if exists`, `create policy` après
-- `drop policy`).
--
-- ---------------------------------------------------------------------------
-- 1. Le trigger de protection reposait sur le NOM du rôle (`current_user <>
--    'postgres'`)
-- ---------------------------------------------------------------------------
-- Ce n'est pas une preuve d'autorité : c'est une convention de nom. Le nom du
-- propriétaire de la table pourrait changer (migration exécutée dans un autre
-- rôle sur un projet hébergé, `ALTER TABLE ... OWNER TO`, restauration d'un
-- dump), et la protection disparaîtrait silencieusement : les colonnes
-- accordées par erreur redevieraient réinscriptibles.
--
-- La règle appliquée est une RÈGLE, pas un nom : **seul le propriétaire de la
-- table `qr_codes` peut écrire les champs serveur**. C'est exactement le
-- périmètre des fonctions `security definer` du projet (elles s'exécutent avec
-- les droits de leur propriétaire) et rien d'autre. Un jour où un rôle client
-- supplémentaire serait créé, il serait refusé par défaut au lieu de passer.
--
-- `is_public` est ajouté à la liste des champs protégés : c'est l'état de
-- publication, il dépend de l'abonnement (`taggo_subscription_allows_public`),
-- il n'a donc rien à faire dans une écriture directe du client. Il était déjà
-- couvert par les privilèges de colonnes, il est désormais aussi couvert par
-- le trigger : les deux barrières protègent le même ensemble, pas deux
-- ensembles différents.
--
-- ---------------------------------------------------------------------------
-- 2. `assign_taggo_to_user` était un chemin d'affectation sans preuve
-- ---------------------------------------------------------------------------
-- La fonction est accordée à `authenticated` depuis l'étape 5, et elle écrit
-- `owner_id`, `lifecycle_status = 'assigned'` et `assigned_at` — exactement les
-- champs que F4 doit protéger. Sa seule condition est « le TAGGO n'a pas
-- encore de propriétaire et il est `available` ou `reserved` ». Il n'y a
-- AUCUNE preuve d'achat, AUCUNE commande, AUCUNE affectation préalable.
--
-- Conséquence : n'importe quel compte authentifié pouvait s'attribuer un TAGGO
-- du stock — y compris un TAGGO déjà `reserved` pour la commande payée de
-- quelqu'un d'autre. Le modèle commercial (premier TAGGO acheté, puis
-- abonnement) était donc contournable par un seul appel PostgREST, exactement
-- par le mécanisme que F4 doit fermer.
--
-- Cette fonction n'est appelée par AUCUNE page de l'application (seul le
-- contrat `QrRepository.assignTagToUser` la mentionne, et il n'est pas appelé :
-- l'activation passe par `activate_taggo`, l'attribution par
-- `assign_taggo_to_order_customer` ou par le webhook). Elle est donc RETIRÉE
-- du périmètre client plutôt que réécrite : il n'y a pas de flux légitime à
-- préserver, et la réécrire reviendrait à inventer une règle d'affectation.
-- Le dépôt local (`LocalQrRepository`, mode démo) n'est pas concerné : il
-- n'écrit pas en base.
--
-- Les chemins d'affectation LEGITIMES, tous vérifiés, restent :
--   * `assign_taggo_to_order_customer(uuid, uuid)` — `authenticated`, mais elle
--     exige que la commande soit à `auth.uid()` et que le TAGGO soit `reserved`
--     POUR CETTE commande ;
--   * `reserve_taggos_for_paid_order(uuid, integer)` — `service_role`, appelée
--     par le webhook après `mark_shop_order_paid` ;
--   * `assign_taggo_to_customer(text, uuid)` — `service_role` (parcours
--     commercial hors boutique).
--
-- ---------------------------------------------------------------------------
-- 3. F3 — `orders` : la cohérence financière n'était garantie qu'en UPDATE
-- ---------------------------------------------------------------------------
-- La policy d'INSERT exigeait seulement `status = 'draft'`. Un client pouvait
-- donc CRÉER une commande avec `subtotal_cents` et `currency` déjà renseignés,
-- c'est-à-dire fabriquer un montant dans une commande qu'il possède. Même
-- famille de défaut que `orders.currency` en UPDATE : une donnée financière
-- écrite par le client.
--
-- La policy d'DELETE laissait supprimer Y COMPRIS une commande `paid` : la
-- suppression cascade ses `order_items` et passe `taggo_assignments.order_id`
-- à NULL. L'historique d'une commande payée — et le lien entre le paiement et
-- les TAGGO livrés — disparaissent alors, et la rejouabilité du webhook s'appuie
-- précisément sur cette commande.
--
-- Aucun code applicatif ne supprime de commande : la restriction ne casse donc
-- rien. La création de commande passe par `create_order()` et
-- `create_shop_order()`, toutes deux `security definer` : elles s'exécutent
-- avec les droits du propriétaire de la table et ne sont PAS soumises à la
-- RLS, donc la policy durcie ne peut pas les bloquer.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Trigger — règle de propriété au lieu d'un nom de rôle
-- ---------------------------------------------------------------------------
create or replace function public.protect_qr_codes_server_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  table_owner name;
begin
  -- Propriétaire RÉEL de la table, lu dans le catalogue. Il ne peut pas être
  -- deviné ni diverger du nom d'un rôle codé en dur.
  select pg_get_userbyid(c.relowner) into table_owner
  from pg_class c
  where c.oid = 'public.qr_codes'::regclass;

  if tg_op = 'INSERT' then
    -- Un TAGGO naît `draft` et non public. Les horodatages de réserve,
    -- d'affectation et d'activation sont posés par le serveur.
    if new.reserved_at is not null
       or new.assigned_at is not null
       or new.activated_at is not null then
      raise exception 'qr_codes_server_fields_are_read_only'
        using errcode = '42501',
              hint = 'reserved_at, assigned_at and activated_at are written by the server only.';
    end if;
    if new.status <> 'draft' or new.is_public then
      raise exception 'qr_codes_must_be_created_as_draft'
        using errcode = '42501',
              hint = 'A TAGGO is created as status=draft, is_public=false. Use set_taggo_status to publish it.';
    end if;
    return new;
  end if;

  -- `updated_at` est entretenu pour toute écriture, quelle qu'en soit la
  -- source : le navigateur ne l'envoyait pas, il restait donc figé.
  new.updated_at := now();

  -- Un propriétaire change le CONTENU de son TAGGO (titre, description,
  -- destination). Il ne change ni sa POSITION dans le cycle de vie, ni son
  -- affectation, ni son état de publication : ces champs appartiennent aux
  -- fonctions `security definer`, qui s'exécutent avec les droits du
  -- propriétaire de la table.
  if new.id               is distinct from old.id
     or new.owner_id      is distinct from old.owner_id
     or new.public_id     is distinct from old.public_id
     or new.created_at    is distinct from old.created_at
     or new.status            is distinct from old.status
     or new.lifecycle_status  is distinct from old.lifecycle_status
     or new.reserved_at       is distinct from old.reserved_at
     or new.assigned_at       is distinct from old.assigned_at
     or new.activated_at      is distinct from old.activated_at
     or new.is_public         is distinct from old.is_public
  then
    if current_user <> table_owner then
      raise exception 'qr_codes_server_fields_are_read_only'
        using errcode = '42501',
              hint = 'Use transition_taggo / set_taggo_status / activate_taggo instead of writing lifecycle, assignment or publication columns.';
    end if;
  end if;

  return new;
end;
$$;

-- La fonction reste `security invoker` (défaut) : c'est la seule façon de
-- distinguer l'appelant. Une version `security definer` vaudrait `postgres`
-- pour tout le monde, y compris pour un client, et ne protégerait rien.
revoke execute on function public.protect_qr_codes_server_fields() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. `assign_taggo_to_user` n'est plus un chemin d'affectation client
-- ---------------------------------------------------------------------------
revoke execute on function public.assign_taggo_to_user(uuid) from public, anon, authenticated;

comment on function public.assign_taggo_to_user(uuid) is
  'Retiree du perimetre client (etape 13.1) : elle ne exigeait ni achat, ni commande, ni affectation prealable, et permettait de s''attribuer un TAGGO du stock, y compris un TAGGO reserve pour la commande payee d''un tiers. Les chemins d''affectation legitimes sont assign_taggo_to_order_customer (authenticated, commande verifiee), reserve_taggos_for_paid_order (service_role, webhook) et assign_taggo_to_customer (service_role).';

-- ---------------------------------------------------------------------------
-- 3. F3 — `orders` : mêmes colonnes financières à l'INSERT et au DELETE
-- ---------------------------------------------------------------------------
drop policy if exists "Customers can create orders" on public.orders;
create policy "Customers can create orders" on public.orders
  for insert to authenticated
  with check (
    auth.uid() = customer_id
    and status = 'draft'
    -- Aucune donnée financière ne peut être écrite à la création : le montant
    -- et la devise sont posés par `create_shop_order`, qui relit le catalogue
    -- serveur. Une commande client naît donc sans montant, comme avant.
    and paid_at is null
    and subtotal_cents is null
    and currency is null
    and stripe_checkout_session_id is null
    and stripe_payment_intent_id is null
  );

-- Supprimer une commande payée effacerait son historique financier et
-- décrocherait les TAGGO livrés. La suppression reste possible tant que la
-- commande n'a engaged ni paiement ni livraison.
drop policy if exists "Customers can delete their own orders" on public.orders;
create policy "Customers can delete their own orders" on public.orders
  for delete to authenticated
  using (
    auth.uid() = customer_id
    and status = 'draft'
    and paid_at is null
    and stripe_checkout_session_id is null
    and stripe_payment_intent_id is null
  );

-- Les champs financiers d'une commande ne sont donc PLUS DU TOUT modifiables
-- par un client : ni à l'INSERT (policy ci-dessus), ni à l'UPDATE (policy de
-- l'étape 13.1 + `grant update (status)`), ni à l'DELETE (une commande payée
-- n'est plus supprimable).

-- ---------------------------------------------------------------------------
-- 4. La vue publique n'était PAS en lecture seule
-- ---------------------------------------------------------------------------
-- RÉSULTAT DE RE-TEST, et non déduction théorique : avant ce correctif,
-- n'importe quel visiteur ANONYME pouvait insérer une ligne dans
-- `public.qr_codes` :
--
--   insert into public.public_taggo_cards (public_id, title, destination_url)
--   values ('TGG-EVIL001', 'owned by nobody', 'https://evil.example');
--
-- Trois faits se cumulent :
--
--   1. sur Supabase, `ALTER DEFAULT PRIVILEGES ... GRANT ALL ON TABLES` porte
--      aussi sur les VUES : `anon` avait donc INSERT/UPDATE/DELETE sur
--      `public_taggo_cards`. Le `revoke all ... from public` de la migration
--      précédente ne suffisait pas, car `anon` et `authenticated` ont des
--      droits DIRECTS, distincts du rôle PUBLIC ;
--   2. une vue qui n'est pas `security_invoker` écrit dans la table de base
--      avec les droits de son PROPRIÉTAIRE : la RLS de `qr_codes` n'est donc
--      PAS évaluée pour cette écriture ;
--   3. le trigger de l'étape 13.1 compare `current_user` au propriétaire de la
--      table : ici `current_user` est bien le propriétaire, l'écriture passe.
--
-- Autrement dit : la correction F2 (vue publique) créait par contrecoup un
-- chemin d'ANONYMISATION de l'écriture dans `qr_codes`, que F4 venait de
-- fermer. La vue doit être explicitement en lecture seule.
revoke all on public.public_taggo_cards from anon, authenticated;
grant  select on public.public_taggo_cards to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. La RLS n'est plus l'unique barrière sur les tables sans écriture client
-- ---------------------------------------------------------------------------
-- Règle générale : quand AUCUN code applicatif n'écrit une table depuis le
-- client, le droit SQL est retiré. La RLS reste en place (défense en
-- profondeur), mais elle n'est plus seule.
--
-- `qr_codes` : l'anonyme n'a rien à y écrire ; le client authentifié garde
-- exactement INSERT, SELECT, DELETE et les trois colonnes de contenu.
revoke all on public.qr_codes from anon;
revoke update on public.qr_codes from authenticated;
grant  insert, select, delete on public.qr_codes to authenticated;
grant  update (title, description, destination_url) on public.qr_codes to authenticated;

-- `orders` : le client authentifié garde INSERT / SELECT / DELETE (politiques
-- durcies ci-dessus) et UPDATE sur `status` seul. L'anonyme n'a rien à y lire.
revoke all on public.orders from anon;
revoke update on public.orders from authenticated;
grant  insert, select, delete on public.orders to authenticated;
grant  update (status) on public.orders to authenticated;

-- Tables sans aucun chemin d'écriture client, et dont la lecture publique
-- n'est pas nécessaire : plus aucun droit pour `anon` ni `authenticated`.
revoke all on public.taggo_assignments from anon, authenticated;
revoke all on public.stripe_webhook_events from anon, authenticated;
revoke all on public.email_events from anon, authenticated;
revoke all on public.taggo_scan_settings from anon, authenticated;
revoke all on public.subscriptions_unattached_archive from anon, authenticated;

-- Tables dont le client ne fait QUE lire ses propres lignes (les TAGGO qu'il
-- possède) ou le catalogue actif : aucune écriture.
revoke all on public.taggo_scans from anon;
revoke insert, update, delete on public.taggo_scans from authenticated;
revoke insert, update, delete on public.order_items from anon, authenticated;
revoke insert, update, delete on public.products from anon, authenticated;
revoke insert, update, delete on public.product_variants from anon, authenticated;
revoke insert, update, delete, truncate on public.public_profiles from anon;
revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;

-- ---------------------------------------------------------------------------
-- 6. F2 — la policy publique de `public_profiles` ne pouvait plus s'évaluer
-- ---------------------------------------------------------------------------
-- CONSÉQUENCE DU CORRECTIF F2, TROUVÉE EN RE-TESTANT, PAS EN LE RAISONNANT :
-- en retirant `SELECT` sur `public.qr_codes` à `anon` (étape 13.1), la policy
--
--   create policy "Public can view public QR profile data"
--     on public.public_profiles for select using (
--       exists (select 1 from public.qr_codes q where q.id = … ))
--
-- est devenue INÉVALIDE pour l'anonyme : une expression de policy s'exécute
-- avec les droits du rôle appelant, donc l'anonyme devait avoir le droit de
-- lire `qr_codes` pour que la policy puisse être évaluée. Résultat : l'anonyme
-- recevait `permission denied for table qr_codes` au lieu du profil public, et
-- la page publique perdait son contenu alors que le TAGGO, lui, restait
-- visible. Le symptôme est discret parce que la page reste affichable.
--
-- La policy ne doit donc plus RÉFÉRENCER `qr_codes`. Elle délègue à une
-- fonction `security definer` qui porte le même prédicat public — le même
-- choix que celui déjà fait pour `taggo_subscription_allows_public` dans les
-- policies de l'étape 12.
--
-- Le prédicat est STRICTEMENT identique à celui de la vue publique et à
-- l'ancien prédicat de policy : public + actif + destination + période non
-- échue. Il ne retourne qu'un booléen.
create or replace function public.public_taggo_is_visible(p_qr_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.qr_codes q
    where q.id = p_qr_id
      and q.is_public = true
      and q.status = 'active'
      and q.destination_url is not null
      and public.taggo_subscription_allows_public(q.id)
  );
$$;

revoke execute on function public.public_taggo_is_visible(uuid) from public;
grant  execute on function public.public_taggo_is_visible(uuid) to anon, authenticated, service_role;

drop policy if exists "Public can view public QR profile data" on public.public_profiles;
create policy "Public can view public QR profile data" on public.public_profiles
  for select to anon, authenticated
  using (public.public_taggo_is_visible(public_profiles.qr_code_id));

-- La policy d'ÉCRITURE du propriétaire référençait elle aussi `qr_codes`
-- directement. Elle s'applique aussi à SELECT (`for all`) : elle était donc
-- évaluée pour l'anonyme, et faisait échouer la lecture du profil public même
-- après le correctif ci-dessus. Elle délègue au même principe : une fonction
-- `security definer` qui porte la condition, ici l'APPARTENANCE.
--
-- `auth.uid()` reste lisible dans une fonction `security definer` : elle lit
-- le JWT de la session, pas les droits de l'appelant. Le contrôle reste donc
-- bien « ce profil est-il celui du propriétaire connecté ? ».
create or replace function public.taggo_is_owned_by_current_user(p_qr_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.qr_codes q
    where q.id = p_qr_id
      and q.owner_id is not null
      and q.owner_id = auth.uid()
  );
$$;

revoke execute on function public.taggo_is_owned_by_current_user(uuid) from public;
grant  execute on function public.taggo_is_owned_by_current_user(uuid) to authenticated, service_role;

drop policy if exists "Owners can manage their public profile" on public.public_profiles;
create policy "Owners can manage their public profile" on public.public_profiles
  for all to authenticated
  using (public.taggo_is_owned_by_current_user(public_profiles.qr_code_id))
  with check (public.taggo_is_owned_by_current_user(public_profiles.qr_code_id));

-- ---------------------------------------------------------------------------
-- 7. Le rejeu du webhook Stripe échouait réellement
-- ---------------------------------------------------------------------------
-- DÉFAUT TROUVÉ EN EXÉCUTANT LE SCÉNARIO, PAS EN RELISANT LE CODE :
-- `reserve_taggos_for_paid_order` déclare
--
--   assigned_ids uuid[] := '{}';
--   index integer;
--   ...
--   foreach index in array assigned_ids loop      -- <-- uuid[] dans un integer
--     perform public.grant_included_taggo_period(index, included_starts);
--   end loop;
--
-- `FOREACH` affecte chaque élément à la variable de la boucle : PostgreSQL
-- essaie donc de convertir un `uuid` en `integer` et lève
-- « invalid input syntax for type integer: "…" ». La fonction est recréée à
-- l'identique par la migration de l'étape 12 (section 13), qui a AJOUTÉ ce
-- `foreach` — mais en réutilisant la déclaration `index integer` du compteur de
-- boucle de la version d'origine.
--
-- CONSÉQUENCE, et elle est grave : c'est le chemin de REJEU. Il ne s'atteint
-- que lorsque la commande a DÉJÀ reçu ses TAGGO, c'est-à-dire exactement quand
-- Stripe renvoie le même événement une seconde fois. Autrement dit la garantie
-- d'idempotence annoncée par la migration de l'étape 12 n'était pas tenue :
-- le rejeu du webhook levait une erreur au lieu de renvoyer
-- `already_reserved: true`.
--
-- Le correctif est une seule ligne de déclaration (`qr_id uuid` pour le parcours
-- du tableau). Le corps est repris de la version de l'étape 12 sans autre
-- changement : ce correctif ne doit rien modifier d'autre.
--
-- Les deux autres boucles de cette fonction — `for index in 1..p_quantity` —
-- restent sur le compteur `integer` : elles sont correctes, `index` y est un
-- numéro d'itération, pas un identifiant.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_taggos_for_paid_order(
  p_order_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  target public.orders;
  selected_qr public.qr_codes;
  assigned_ids uuid[] := '{}';
  index integer;
  qr_id uuid;
  taggo_count integer;
  included_starts timestamptz;
begin
  select * into target from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if target.status <> 'paid' then
    raise exception 'order_not_paid';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'invalid_quantity';
  end if;

  -- La periode incluse demarre au PAIEMENT confirme.
  included_starts := coalesce(target.paid_at, now());

  select count(*) into taggo_count
  from public.taggo_assignments a
  where a.order_id = p_order_id and a.status <> 'cancelled';

  if taggo_count > 0 then
    select coalesce(array_agg(a.qr_code_id order by a.qr_code_id), '{}')
    into assigned_ids
    from public.taggo_assignments a
    where a.order_id = p_order_id and a.status <> 'cancelled';

    -- Rejeu du webhook : les periodes incluses sont (re)verifiees sans jamais
    -- etre prolongees. `qr_id` est un `uuid` : c'est la seule correction de ce
    -- correctif.
    foreach qr_id in array assigned_ids loop
      perform public.grant_included_taggo_period(qr_id, included_starts);
    end loop;

    return jsonb_build_object(
      'order_id', p_order_id,
      'assigned_taggo_ids', assigned_ids,
      'already_reserved', true
    );
  end if;

  for index in 1..p_quantity loop
    select * into selected_qr
    from public.qr_codes
    where lifecycle_status = 'available' and owner_id is null
    order by created_at, id
    for update skip locked
    limit 1;

    if not found then
      raise exception 'no_taggo_available';
    end if;

    update public.qr_codes
    set lifecycle_status = 'assigned',
        owner_id = target.customer_id,
        assigned_at = coalesce(assigned_at, now()),
        updated_at = now()
    where id = selected_qr.id;

    insert into public.taggo_assignments (
      qr_code_id, order_id, assigned_user_id, status, assigned_by, assigned_at
    ) values (
      selected_qr.id, p_order_id, target.customer_id, 'assigned', 'stripe', now()
    );

    insert into public.order_items (order_id, product_type, quantity, taggo_id)
    values (p_order_id, 'taggo', 1, selected_qr.id);

    -- Premiere annee incluse : une periode d'un an, par TAGGO attribue.
    perform public.grant_included_taggo_period(selected_qr.id, included_starts);

    assigned_ids := array_append(assigned_ids, selected_qr.id);
  end loop;

  return jsonb_build_object(
    'order_id', p_order_id,
    'assigned_taggo_ids', assigned_ids,
    'already_reserved', false
  );
end;
$$;

-- Droits identiques à la version de l'étape 12 : cette fonction n'élargit aucune
-- surface d'appel.
revoke execute on function public.reserve_taggos_for_paid_order(uuid, integer) from public, anon, authenticated;
grant  execute on function public.reserve_taggos_for_paid_order(uuid, integer) to service_role;