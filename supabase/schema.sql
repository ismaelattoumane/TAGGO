-- ===========================================================================
-- TAGGO — INSTANTANÉ DU SCHÉMA (FICHIER GÉNÉRÉ, NE PAS ÉDITER À LA MAIN)
-- ===========================================================================
--
-- Source de vérité : supabase/migrations/*.sql, dans l'ordre du dépôt.
-- Ce fichier en est un instantané, produit par `scripts/db-schema.sh dump`
-- après application de TOUTES les migrations sur une base propre.
--
-- Il sert à provisionner un projet Supabase NEUF (Dashboard > SQL Editor, ou
-- `supabase db push` sur un projet vide). Il ne sert PAS à mettre à jour un
-- projet déjà en place : pour cela, on applique les migrations.
--
-- Régénérer :  scripts/db-schema.sh dump
-- Vérifier   :  scripts/db-schema.sh check   (échoue si le fichier a dérivé)
--
-- Les privilèges (`GRANT` / `REVOKE`) sont conservés : ils font partie du
-- modèle de sécurité autant que les policies, et c'est précisément leur
-- absence qui avait permis à `anon` d'écrire dans `qr_codes`.
-- ===========================================================================

-- pgcrypto est requis par `generate_taggo_public_id`, qui appelle
-- `extensions.gen_random_bytes`. Sur Supabase, pgcrypto est déjà présent dans
-- le schéma `extensions` : ces deux lignes ne font donc rien sur un projet
-- existant, et elles rendent l'instantané jouable aussi sur une base vierge.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: qr_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid,
    public_id text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    destination_url text,
    title text,
    description text,
    is_public boolean DEFAULT false NOT NULL,
    lifecycle_status text DEFAULT 'available'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reserved_at timestamp with time zone,
    assigned_at timestamp with time zone,
    activated_at timestamp with time zone,
    CONSTRAINT qr_codes_destination_url_check CHECK (((destination_url IS NULL) OR (destination_url ~* '^https?://[^[:space:]/]+([/:?#].*)?$'::text))),
    CONSTRAINT qr_codes_lifecycle_status_check CHECK ((lifecycle_status = ANY (ARRAY['available'::text, 'reserved'::text, 'assigned'::text, 'activated'::text, 'active'::text, 'inactive'::text, 'expired'::text, 'suspended'::text, 'replaced'::text, 'cancelled'::text]))),
    CONSTRAINT qr_codes_public_id_check CHECK ((public_id ~ '^TGG-[A-Z0-9]{7}$'::text)),
    CONSTRAINT qr_codes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'inactive'::text, 'archived'::text]))),
    CONSTRAINT qr_codes_title_check CHECK (((title IS NULL) OR ((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 80))))
);


--
-- Name: activate_taggo(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.activate_taggo(p_public_id text) RETURNS public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  selected_qr public.qr_codes;
begin
  update public.qr_codes q
  set owner_id = auth.uid(), lifecycle_status = 'activated', status = 'draft', activated_at = coalesce(activated_at, now()), updated_at = now()
  where q.public_id = upper(trim(p_public_id))
    and q.lifecycle_status = 'assigned'
    and exists (
      select 1 from public.taggo_assignments a
      where a.qr_code_id = q.id and a.assigned_user_id = auth.uid() and a.status = 'assigned'
    )
  returning q.* into selected_qr;
  return selected_qr;
end;
$$;


--
-- Name: assign_taggo_to_customer(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_taggo_to_customer(p_external_order_id text, p_user_id uuid) RETURNS public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  selected_qr public.qr_codes;
  selected_qr_id uuid;
begin
  if p_user_id is null or nullif(trim(p_external_order_id), '') is null then
    raise exception 'user_id and external_order_id are required';
  end if;

  update public.taggo_assignments
  set assigned_user_id = p_user_id, status = 'assigned', assigned_at = coalesce(assigned_at, now()), updated_at = now()
  where external_order_id = trim(p_external_order_id) and status <> 'cancelled'
  returning qr_code_id into selected_qr_id;

  if not found then
    raise exception 'TAGGO assignment not found';
  end if;

  update public.qr_codes
  set lifecycle_status = 'assigned', assigned_at = coalesce(assigned_at, now()), updated_at = now()
  where id = selected_qr_id
  returning * into selected_qr;
  return selected_qr;
end;
$$;


--
-- Name: assign_taggo_to_order_customer(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_taggo_to_order_customer(p_order_id uuid, p_taggo_id uuid) RETURNS public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  order_customer uuid;
  assigned_qr_id uuid;
  selected_qr public.qr_codes;
begin
  select customer_id into order_customer
  from public.orders
  where id = p_order_id and customer_id = auth.uid();
  if not found then
    raise exception 'Order not found or not owned by current user';
  end if;

  update public.taggo_assignments a
  set assigned_user_id = auth.uid(),
      status = 'assigned',
      assigned_at = coalesce(assigned_at, now()),
      updated_at = now()
  where a.qr_code_id = p_taggo_id
    and a.order_id = p_order_id
    and a.status = 'reserved'
  returning a.qr_code_id into assigned_qr_id;

  if not found then
    raise exception 'TAGGO not reserved for this order or already assigned';
  end if;

  update public.qr_codes q
  set owner_id = auth.uid(),
      lifecycle_status = 'assigned',
      assigned_at = coalesce(assigned_at, now()),
      updated_at = now()
  where q.id = assigned_qr_id
    and q.owner_id is null
    and q.lifecycle_status = 'reserved'
  returning q.* into selected_qr;

  if not found then
    raise exception 'TAGGO not in reserved state or already owned';
  end if;

  update public.orders
  set status = 'assigned', updated_at = now()
  where id = p_order_id;

  return selected_qr;
end;
$$;


--
-- Name: assign_taggo_to_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_taggo_to_user(p_qr_id uuid) RETURNS public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  selected_qr public.qr_codes;
begin
  update public.qr_codes q
  set owner_id = auth.uid(),
      lifecycle_status = 'assigned',
      assigned_at = coalesce(assigned_at, now()),
      updated_at = now()
  where q.id = p_qr_id
    and q.owner_id is null
    and q.lifecycle_status in ('available', 'reserved')
  returning q.* into selected_qr;
  return selected_qr;
end;
$$;


--
-- Name: begin_email_event(text, text, uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_email_event(p_dedupe_key text, p_email_type text, p_order_id uuid, p_recipient_hash text, p_recipient_length integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  inserted_id uuid;
  normalized_key text;
begin
  normalized_key := left(trim(coalesce(p_dedupe_key, '')), 200);

  if nullif(normalized_key, '') is null then
    raise exception 'invalid_dedupe_key';
  end if;

  -- L'adresse n'est jamais stockée en clair : le serveur fournit déjà son
  -- empreinte SHA-256 (aucune extension PostgreSQL supplémentaire requise).
  insert into public.email_events (
    dedupe_key, email_type, order_id, recipient_hash, recipient_length
  )
  values (
    normalized_key,
    p_email_type,
    p_order_id,
    left(trim(coalesce(p_recipient_hash, '')), 64),
    p_recipient_length
  )
  on conflict (dedupe_key) do nothing
  returning id into inserted_id;

  -- `true` = premier traitement. `false` = déjà traité, aucun envoi possible.
  return inserted_id is not null;
end;
$$;


--
-- Name: begin_stripe_event(text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.begin_stripe_event(p_stripe_event_id text, p_event_type text, p_order_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  inserted_id uuid;
begin
  if nullif(trim(p_stripe_event_id), '') is null then
    raise exception 'invalid_event';
  end if;

  insert into public.stripe_webhook_events (stripe_event_id, event_type, order_id)
  values (trim(p_stripe_event_id), p_event_type, p_order_id)
  on conflict (stripe_event_id) do nothing
  returning id into inserted_id;

  return inserted_id is not null;
end;
$$;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    subtotal_cents integer,
    currency text,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    paid_at timestamp with time zone,
    CONSTRAINT orders_currency_check CHECK (((currency IS NULL) OR (currency ~ '^[A-Z]{3}$'::text))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'ready_for_assignment'::text, 'assigned'::text, 'paid'::text, 'cancelled'::text])))
);


--
-- Name: create_order(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_order() RETURNS public.orders
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  new_order public.orders;
begin
  insert into public.orders (customer_id, status)
  values (auth.uid(), 'draft')
  returning * into new_order;
  return new_order;
end;
$$;


--
-- Name: create_shop_order(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_shop_order(p_items jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  customer uuid := auth.uid();
  item jsonb;
  variant_row public.product_variants;
  new_order public.orders;
  line_quantity integer;
  line_total integer;
  order_total integer := 0;
  order_currency text;
  priced_lines jsonb := '[]'::jsonb;
begin
  if customer is null then
    raise exception 'unauthenticated';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;

  if jsonb_array_length(p_items) > 20 then
    raise exception 'invalid_quantity';
  end if;

  -- 1. Validation + tarification serveur (le client n'envoie que variantId + quantity).
  for item in select * from jsonb_array_elements(p_items) loop
    if coalesce(jsonb_typeof(item -> 'variantId'), '') <> 'string'
       or coalesce(jsonb_typeof(item -> 'quantity'), '') <> 'number' then
      raise exception 'invalid_item';
    end if;

    line_quantity := (item ->> 'quantity')::integer;
    if line_quantity is null or line_quantity < 1 or line_quantity > 10 then
      raise exception 'invalid_quantity';
    end if;

    begin
      select * into variant_row
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = (item ->> 'variantId')::uuid
        and v.available
        and p.status = 'active'
      for update of v;
    exception when invalid_text_representation then
      raise exception 'variant_not_found';
    end;

    if not found then
      raise exception 'variant_not_found';
    end if;

    -- Prix non publié : aucune Checkout Session, aucune commande.
    if variant_row.price_cents is null then
      raise exception 'price_unavailable';
    end if;

    if variant_row.stock is not null and variant_row.stock < line_quantity then
      raise exception 'variant_unavailable';
    end if;

    if order_currency is null then
      order_currency := variant_row.currency;
    elsif order_currency <> variant_row.currency then
      raise exception 'invalid_currency';
    end if;

    line_total := variant_row.price_cents * line_quantity;
    order_total := order_total + line_total;

    priced_lines := priced_lines || jsonb_build_array(jsonb_build_object(
      'variant_id', variant_row.id,
      'product_id', variant_row.product_id,
      'quantity', line_quantity,
      'unit_price_cents', variant_row.price_cents,
      'line_total_cents', line_total
    ));
  end loop;

  if order_total <= 0 then
    raise exception 'price_unavailable';
  end if;

  -- 2. Création de la commande (jamais `paid`).
  insert into public.orders (customer_id, status, subtotal_cents, currency)
  values (customer, 'pending', order_total, order_currency)
  returning * into new_order;

  -- 3. Lignes de commande.
  --    Le stock textile n'est PAS décrémenté ici : une commande en attente de
  --    paiement ne doit pas consommer un stock. Seul `available` est vérifié
  --    ci-dessus. Tant que le stock n'est pas géré (`stock is null`), la
  --    disponibilité reste une décision serveur explicite.
  for item in select * from jsonb_array_elements(priced_lines) loop
    insert into public.order_items (
      order_id, product_type, quantity, product_id, variant_id,
      unit_price_cents, line_total_cents
    ) values (
      new_order.id,
      'apparel',
      (item ->> 'quantity')::integer,
      (item ->> 'product_id')::uuid,
      (item ->> 'variant_id')::uuid,
      (item ->> 'unit_price_cents')::integer,
      (item ->> 'line_total_cents')::integer
    );
  end loop;

  return jsonb_build_object(
    'order_id', new_order.id,
    'status', new_order.status,
    'subtotal_cents', order_total,
    'currency', order_currency,
    'variant_count', jsonb_array_length(priced_lines)
  );
end;
$$;


--
-- Name: expire_due_taggo_subscriptions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.expire_due_taggo_subscriptions() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  expired_taggo_ids uuid[];
  expired_subscriptions integer := 0;
  expired_taggos integer := 0;
begin
  with due as (
    update public.subscriptions s
    set status = 'expired',
        expired_at = coalesce(s.expired_at, now()),
        updated_at = now()
    where s.status = 'active'
      and s.ends_at is not null
      and s.ends_at <= now()
    returning s.qr_code_id
  )
  select coalesce(array_agg(qr_code_id), '{}'), count(*)
  into expired_taggo_ids, expired_subscriptions
  from due;

  -- Transition TAGGO `active -> expired` : autorisée par le graphe existant
  -- (`transition_taggo`). Seul `active` est traité : un TAGGO `assigned` ou
  -- `activated` n'a pas de page publique, et le graphe interdit de le passer
  -- directement à `expired`.
  if array_length(expired_taggo_ids, 1) > 0 then
    update public.qr_codes q
    set lifecycle_status = 'expired',
        status = 'inactive',
        updated_at = now()
    where q.id = any(expired_taggo_ids)
      and q.lifecycle_status = 'active';

    get diagnostics expired_taggos = row_count;
  end if;

  return jsonb_build_object(
    'expired_subscriptions', expired_subscriptions,
    'expired_taggos', expired_taggos
  );
end;
$$;


--
-- Name: finish_email_event(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_email_event(p_dedupe_key text, p_status text, p_detail text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.email_events
  set status = p_status,
      detail = left(coalesce(p_detail, ''), 300),
      processed_at = now()
  where dedupe_key = left(trim(coalesce(p_dedupe_key, '')), 200);
end;
$$;


--
-- Name: finish_stripe_event(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_stripe_event(p_stripe_event_id text, p_status text, p_detail text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.stripe_webhook_events
  set status = p_status,
      detail = left(coalesce(p_detail, ''), 300),
      processed_at = now()
  where stripe_event_id = trim(p_stripe_event_id);
end;
$$;


--
-- Name: generate_taggo_public_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_taggo_public_id() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  index integer;
begin
  loop
    candidate := 'TGG-';
    for index in 1..7 loop
      -- `extensions.` est explicite : sur Supabase, pgcrypto est installé dans
      -- le schéma `extensions`, et `search_path = public` (plus `security
      -- definer`) interdit de compter sur une résolution implicite.
      candidate := candidate || substr(alphabet, (get_byte(extensions.gen_random_bytes(1), 0) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.qr_codes where public_id = candidate);
  end loop;
  return candidate;
end;
$$;


--
-- Name: get_confirmed_order_recipient(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_confirmed_order_recipient(p_order_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select u.email
  from public.orders o
  join auth.users u on u.id = o.customer_id
  where o.id = p_order_id
    and o.status = 'paid'
    and u.email_confirmed_at is not null
    and nullif(trim(u.email_change), '') is null
  limit 1;
$$;


--
-- Name: get_public_taggo_state(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_taggo_state(p_public_id text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  normalized text := upper(trim(coalesce(p_public_id, '')));
  found_qr public.qr_codes;
  allows_public boolean;
begin
  if normalized = '' then
    return 'not_found';
  end if;

  select q.* into found_qr
  from public.qr_codes q
  where q.public_id = normalized;

  if not found then
    return 'not_found';
  end if;

  allows_public := public.taggo_subscription_allows_public(found_qr.id);

  if not allows_public and exists (
    select 1 from public.subscriptions s where s.qr_code_id = found_qr.id
  ) then
    return 'expired';
  end if;

  if found_qr.lifecycle_status in ('available', 'reserved', 'assigned', 'activated') then
    return 'unactivated';
  end if;

  if not allows_public then
    return 'subscription_required';
  end if;

  if found_qr.status = 'active'
     and found_qr.is_public
     and found_qr.destination_url is not null then
    return 'active';
  end if;

  return 'unavailable';
end;
$$;


--
-- Name: get_shop_order_payment_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_shop_order_payment_status(p_order_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target public.orders;
  taggo_total integer;
begin
  select * into target from public.orders
  where id = p_order_id and customer_id = auth.uid();
  if not found then
    raise exception 'order_not_found';
  end if;

  select count(*) into taggo_total
  from public.taggo_assignments a
  where a.order_id = p_order_id and a.status <> 'cancelled';

  return jsonb_build_object(
    'order_id', target.id,
    'status', target.status,
    'paid', target.status = 'paid',
    'paid_at', target.paid_at,
    'currency', target.currency,
    'subtotal_cents', target.subtotal_cents,
    'taggo_count', taggo_total
  );
end;
$$;


--
-- Name: get_taggo_scan_stats(uuid, uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_taggo_scan_stats(p_qr_id uuid, p_owner_id uuid, p_days integer, p_bucket text DEFAULT 'day'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  window_days integer;
  bucket_unit text;
  total bigint;
  today bigint;
  last_7 bigint;
  last_30 bigint;
  series jsonb;
  recent jsonb;
begin
  if p_qr_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  window_days := case
    when p_days = 7 then 7
    when p_days = 30 then 30
    when p_days = 90 then 90
    else null
  end;

  if window_days is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_period');
  end if;

  bucket_unit := case
    when p_bucket = 'week' then 'week'
    else 'day'
  end;

  -- Contrôle d'appartenance : c'est ICI que le propriétaire est vérifié.
  if not exists (
    select 1 from public.qr_codes q
    where q.id = p_qr_id and q.owner_id = p_owner_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  select count(*) into total
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id;

  -- « Aujourd'hui » est calculé en UTC : la borne est donc reproductible et
  -- ne dépend pas du fuseau du navigateur ou du serveur d'application.
  select count(*) into today
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= date_trunc('day', now() at time zone 'utc');

  select count(*) into last_7
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= now() - interval '7 days';

  select count(*) into last_30
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= now() - interval '30 days';

  select coalesce(jsonb_agg(row_to_json(series_row) order by series_row.bucket_start), '[]'::jsonb)
  into series
  from (
    select
      date_trunc(bucket_unit, scanned_at at time zone 'utc') as bucket_start,
      count(*)::bigint as scans
    from public.taggo_scans
    where qr_code_id = p_qr_id
      and scanned_at >= now() - make_interval(days => window_days)
    group by 1
  ) as series_row;

  -- Scans récents : horodatage uniquement, aucune donnée de visiteur n'existe
  -- dans la table, donc rien d'autre ne peut être exposé.
  select coalesce(jsonb_agg(to_jsonb(recent_row) order by recent_row.scanned_at desc), '[]'::jsonb)
  into recent
  from (
    select scanned_at
    from public.taggo_scans
    where qr_code_id = p_qr_id
    order by scanned_at desc
    limit 10
  ) as recent_row;

  return jsonb_build_object(
    'ok', true,
    'total', total,
    'today', today,
    'last_7', last_7,
    'last_30', last_30,
    'days', window_days,
    'bucket', bucket_unit,
    'series', series,
    'recent', recent
  );
end;
$$;


--
-- Name: get_taggo_subscription_status(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_taggo_subscription_status(p_qr_id uuid, p_owner_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  row public.subscriptions;
  owned boolean;
  lifecycle text;
  sweep jsonb;
begin
  if p_qr_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  -- Effet de bord assumé et borné : écrit l'expiration réellement échue.
  sweep := public.expire_due_taggo_subscriptions();

  select exists (
    select 1 from public.qr_codes q
    where q.id = p_qr_id and q.owner_id = p_owner_id
  ) into owned;

  if not owned then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  select q.lifecycle_status into lifecycle
  from public.qr_codes q
  where q.id = p_qr_id;

  select s.* into row
  from public.subscriptions s
  where s.qr_code_id = p_qr_id;

  if not found then
    --(TAGGO SANS PÉRIODE : créé hors boutique, antérieur à l'étape 12, ou
    -- période supprimée par erreur. Aucune période n'est inventée : ce n'est pas
    -- un « actif », c'est un « non géré ».
    --
    -- `subscription_required` est explicite car cet état BLOQUE l'accès public
    -- (voir `taggo_subscription_allows_public`). Sans ce signal, le panneau
    -- propriétaire afficherait « aucune information » alors que son TAGGO est
    -- publiquement inaccessible — un diagnostic faux.
    return jsonb_build_object(
      'ok', true,
      'managed', false,
      'subscription_required', true,
      'reason', 'subscription_required',
      'renewal_available', false,
      'qr_id', p_qr_id,
      'lifecycle_status', lifecycle,
      'sweep', sweep
    );
  end if;

  -- Période présente mais échue : `renewal_unavailable` est renvoyé parce que
  -- le prix de renouvellement n'est pas configuré. Le propriétaire reçoit un
  -- refus explicite, jamais un échec silencieux.
  return jsonb_build_object(
    'ok', true,
    'managed', true,
    'subscription_required', false,
    'qr_id', p_qr_id,
    'lifecycle_status', lifecycle,
    'subscription_status', row.status,
    'source', row.source,
    'auto_renew', row.auto_renew,
    'started_at', row.started_at,
    'ends_at', row.ends_at,
    'expired_at', row.expired_at,
    'renewal_available', false,
    'sweep', sweep
  );
end;
$$;


--
-- Name: grant_included_taggo_period(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_included_taggo_period(p_qr_id uuid, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  owner uuid;
  starts timestamptz;
begin
  if p_qr_id is null then
    return false;
  end if;

  select q.owner_id into owner
  from public.qr_codes q
  where q.id = p_qr_id;

  -- Un TAGGO sans propriétaire n'a pas de période : on n'invente pas.
  if owner is null then
    return false;
  end if;

  starts := coalesce(p_starts_at, now());

  insert into public.subscriptions (
    qr_code_id, user_id, status, plan_name, source,
    auto_renew, started_at, ends_at
  )
  values (
    p_qr_id, owner, 'active', 'taggo_annual', 'included', false,
    -- ANNÉE CALENDAIRE, pas 365 jours : `interval '1 year'` conserve le jour et le
    -- mois, donc 01/03/2027 -> 01/03/2028 (366 j) comme 01/03/2028 ->
    -- 01/03/2029 (365 j). Seul site de calcul de `ends_at` pour la période
    -- incluse.
    starts, starts + interval '1 year'
  )
  on conflict (qr_code_id) do nothing;

  return true;
end;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;
  return new;
end;
$$;


--
-- Name: mark_shop_order_paid(uuid, text, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_shop_order_paid(p_order_id uuid, p_stripe_session_id text, p_stripe_payment_intent_id text, p_amount_total integer, p_currency text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target public.orders;
begin
  select * into target from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- Idempotent : un webhook rejoué ne doit pas changer l'état.
  if target.status = 'paid' then
    return jsonb_build_object('order_id', target.id, 'status', 'paid', 'already_paid', true);
  end if;

  if target.status not in ('pending', 'draft') then
    raise exception 'invalid_order_status';
  end if;

  if target.subtotal_cents is null or p_amount_total is distinct from target.subtotal_cents then
    raise exception 'amount_mismatch';
  end if;

  if upper(coalesce(p_currency, '')) <> upper(coalesce(target.currency, ''))
     or upper(coalesce(p_currency, '')) <> 'EUR' then
    raise exception 'currency_mismatch';
  end if;

  if target.stripe_checkout_session_id is not null
     and target.stripe_checkout_session_id <> p_stripe_session_id then
    raise exception 'session_mismatch';
  end if;

  update public.orders
  set status = 'paid',
      paid_at = coalesce(paid_at, now()),
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_stripe_session_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_payment_intent_id),
      updated_at = now()
  where id = p_order_id
  returning * into target;

  return jsonb_build_object('order_id', target.id, 'status', target.status, 'already_paid', false);
end;
$$;


--
-- Name: prevent_taggo_delete_if_in_use(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_taggo_delete_if_in_use() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if exists (select 1 from public.taggo_assignments a where a.qr_code_id = old.id) then
    raise exception 'qr_code_has_assignment_history'
      using errcode = '23503',
            detail = 'A TAGGO with assignment history cannot be physically deleted.';
  end if;

  if exists (select 1 from public.subscriptions s where s.qr_code_id = old.id) then
    raise exception 'qr_code_has_subscription_history'
      using errcode = '23503',
            detail = 'A TAGGO with subscription history cannot be physically deleted.';
  end if;

  if exists (select 1 from public.public_profiles p where p.qr_code_id = old.id) then
    raise exception 'qr_code_has_public_profile'
      using errcode = '23503',
            detail = 'A TAGGO with a public profile cannot be physically deleted.';
  end if;

  if exists (select 1 from public.taggo_scans s where s.qr_code_id = old.id) then
    raise exception 'qr_code_has_scan_history'
      using errcode = '23503',
            detail = 'A TAGGO with scan history cannot be physically deleted.';
  end if;

  if exists (select 1 from public.order_items i where i.taggo_id = old.id) then
    raise exception 'qr_code_has_order_reference'
      using errcode = '23503',
            detail = 'A TAGGO attached to an order cannot be physically deleted.';
  end if;

  return old;
end;
$$;


--
-- Name: protect_profile_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_profile_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  trusted_email text;
  caller_role text := coalesce(current_setting('role', true), '');
  auth_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if auth_user_id is not null then
      if auth_user_id is distinct from new.id then
        raise exception 'profile_id_must_match_authenticated_user'
          using errcode = '42501';
      end if;
    elsif caller_role not in ('none', 'postgres', 'service_role') then
      raise exception 'profile_insert_requires_authenticated_owner'
        using errcode = '42501';
    end if;

    select u.email into trusted_email
    from auth.users u
    where u.id = new.id;

    if trusted_email is null then
      raise exception 'profile_auth_user_email_missing'
        using errcode = '42501';
    end if;

    new.email := trusted_email;
    return new;
  end if;

  if new.email is distinct from old.email then
    if current_user = 'postgres'
       and caller_role in ('none', 'postgres') then
      return new;
    end if;

    if caller_role = 'service_role' then
      return new;
    end if;

    raise exception 'profile_email_is_read_only'
      using errcode = '42501',
            hint = 'Email changes must go through Supabase Auth and are synchronized from auth.users.';
  end if;

  return new;
end;
$$;


--
-- Name: protect_qr_codes_server_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_qr_codes_server_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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


--
-- Name: provision_taggo_stock(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.provision_taggo_stock(p_quantity integer) RETURNS SETOF public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  created_qr public.qr_codes;
  index integer;
begin
  if p_quantity is null or p_quantity < 1 or p_quantity > 10000 then
    raise exception 'quantity must be between 1 and 10000';
  end if;

  for index in 1..p_quantity loop
    insert into public.qr_codes (owner_id, public_id, status, lifecycle_status, is_public)
    values (null, public.generate_taggo_public_id(), 'draft', 'available', false)
    returning * into created_qr;
    return next created_qr;
  end loop;
end;
$$;


--
-- Name: public_taggo_is_visible(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.public_taggo_is_visible(p_qr_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: reactivate_taggo_subscription(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reactivate_taggo_subscription(p_qr_id uuid, p_owner_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  selected_qr public.qr_codes;
begin
  if p_qr_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  select q.* into selected_qr
  from public.qr_codes q
  where q.id = p_qr_id and q.owner_id = p_owner_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  -- Le renouvellement doit être CONFIRMÉ : c'est la condition bloquante.
  if not exists (
    select 1 from public.subscriptions s
    where s.qr_code_id = p_qr_id
      and s.status = 'active'
      and s.ends_at is not null
      and s.ends_at > now()
  ) then
    return jsonb_build_object('ok', false, 'reason', 'no_valid_subscription');
  end if;

  -- Graphe de transitions existant : `expired -> active`.
  if selected_qr.lifecycle_status not in ('expired', 'suspended', 'inactive') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition');
  end if;

  update public.qr_codes q
  set lifecycle_status = 'active',
      status = 'active',
      updated_at = now()
  where q.id = p_qr_id
    and q.owner_id = p_owner_id
    and q.lifecycle_status in ('expired', 'suspended', 'inactive')
  returning q.* into selected_qr;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition');
  end if;

  return jsonb_build_object(
    'ok', true,
    'qr_code_id', selected_qr.id,
    'lifecycle_status', selected_qr.lifecycle_status,
    'status', selected_qr.status
  );
end;
$$;


--
-- Name: record_taggo_scan(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_taggo_scan(p_public_id text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target public.qr_codes;
  min_interval integer;
  latest timestamptz;
begin
  if nullif(trim(coalesce(p_public_id, '')), '') is null then
    return 'not_found';
  end if;

  -- Résolution côté serveur : normalise et recherche le code public.
  -- [GARANTIE ÉTAPE 11 — INCHANGÉE] Seul un TAGGO public, actif et destiné est
  -- retenu. La consultation n'est faite que par la base.
  select * into target
  from public.qr_codes q
  where q.public_id = upper(trim(p_public_id))
    and q.status = 'active'
    and q.is_public = true
    and q.destination_url is not null
  limit 1;

  -- [ÉTAPE 12] Période échue OU absente : la page affiche un état, pas la
  -- destination. La fenêtre anti-abus n'est volontairement PAS consommée ici.
  if found and not public.taggo_subscription_allows_public(target.id) then
    return 'not_active';
  end if;

  -- [GARANTIE ÉTAPE 11 — INCHANGÉE] On ne distingue pas « inexistant » et
  -- « inactif » du point de vue du visiteur : dans les deux cas rien n'est
  -- enregistré.
  if not found then
    return case
      when exists (
        select 1 from public.qr_codes q
        where q.public_id = upper(trim(p_public_id))
      ) then 'not_active'
      else 'not_found'
    end;
  end if;

  -- [GARANTIE ÉTAPE 11 — INCHANGÉE]
  select coalesce(max(s.min_interval_seconds), 30)
  into min_interval
  from public.taggo_scan_settings s
  where s.id = true;

  -- [GARANTIE ÉTAPE 11 — INCHANGÉE] Anti-abus : fenêtre purement temporelle par
  -- TAGGO. Aucune IP, aucun cookie, aucun identifiant de visiteur n'est lu ni
  -- stocké.
  select max(sc.scanned_at) into latest
  from public.taggo_scans sc
  where sc.qr_code_id = target.id
    and sc.scanned_at > now() - make_interval(secs => min_interval);

  if latest is not null then
    return 'duplicate';
  end if;

  -- [GARANTIE ÉTAPE 11 — INCHANGÉE] `scanned_at` est posé par la base (now()),
  -- jamais transmis par l'appelant.
  insert into public.taggo_scans (qr_code_id, scanned_at)
  values (target.id, now());

  return 'recorded';
end;
$$;


--
-- Name: renew_taggo_subscription(uuid, uuid, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.renew_taggo_subscription(p_qr_id uuid, p_owner_id uuid, p_starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_stripe_subscription_id text DEFAULT NULL::text, p_stripe_price_id text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  owner uuid;
  starts timestamptz;
begin
  if p_qr_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  select q.owner_id into owner
  from public.qr_codes q
  where q.id = p_qr_id and q.owner_id = p_owner_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  starts := coalesce(p_starts_at, now());

  insert into public.subscriptions (
    qr_code_id, user_id, status, plan_name, source,
    auto_renew, started_at, ends_at,
    stripe_subscription_id, stripe_price_id,
    expired_at, updated_at
  )
  values (
    p_qr_id, owner, 'active', 'taggo_annual', 'renewal', false,
    -- ANNÉE CALENDAIRE, pas 365 jours (cf. § « DURÉE » et
    -- `subscriptions_period_check`).
    starts, starts + interval '1 year',
    nullif(trim(coalesce(p_stripe_subscription_id, '')), ''),
    nullif(trim(coalesce(p_stripe_price_id, '')), ''),
    null, now()
  )
  on conflict (qr_code_id) do update
  set status = 'active',
      source = 'renewal',
      started_at = starts,
      ends_at = starts + interval '1 year',
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.subscriptions.stripe_subscription_id),
      stripe_price_id = coalesce(excluded.stripe_price_id, public.subscriptions.stripe_price_id),
      expired_at = null,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'qr_code_id', p_qr_id,
    'started_at', starts,
    'ends_at', starts + interval '1 year'
  );
end;
$$;


--
-- Name: reserve_taggo_for_order(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_taggo_for_order(p_external_order_id text, p_external_product_id text DEFAULT NULL::text) RETURNS public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  existing_assignment public.taggo_assignments;
  selected_qr public.qr_codes;
begin
  if nullif(trim(p_external_order_id), '') is null then
    raise exception 'external_order_id is required';
  end if;

  select * into existing_assignment
  from public.taggo_assignments
  where external_order_id = trim(p_external_order_id)
  for update;

  if found then
    select * into selected_qr from public.qr_codes where id = existing_assignment.qr_code_id;
    return selected_qr;
  end if;

  select * into selected_qr
  from public.qr_codes
  where lifecycle_status = 'available' and owner_id is null
  order by created_at, id
  for update skip locked
  limit 1;

  if not found then
    raise exception 'No TAGGO code is available';
  end if;

  update public.qr_codes
  set lifecycle_status = 'reserved', reserved_at = coalesce(reserved_at, now()), updated_at = now()
  where id = selected_qr.id;

  insert into public.taggo_assignments (qr_code_id, external_order_id, external_product_id)
  values (selected_qr.id, trim(p_external_order_id), nullif(trim(p_external_product_id), ''));

  select * into selected_qr from public.qr_codes where id = selected_qr.id;
  return selected_qr;
end;
$$;


--
-- Name: reserve_taggo_for_order_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_taggo_for_order_id(p_order_id uuid) RETURNS public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  existing_assignment public.taggo_assignments;
  selected_qr public.qr_codes;
begin
  if not exists (select 1 from public.orders where id = p_order_id) then
    raise exception 'Order not found';
  end if;

  select * into existing_assignment
  from public.taggo_assignments
  where order_id = p_order_id
  for update;

  if found then
    select * into selected_qr from public.qr_codes where id = existing_assignment.qr_code_id;
    return selected_qr;
  end if;

  select * into selected_qr
  from public.qr_codes
  where lifecycle_status = 'available' and owner_id is null
  order by created_at, id
  for update skip locked
  limit 1;

  if not found then
    raise exception 'No TAGGO code is available';
  end if;

  update public.qr_codes
  set lifecycle_status = 'reserved',
      reserved_at = coalesce(reserved_at, now()),
      updated_at = now()
  where id = selected_qr.id;

  insert into public.taggo_assignments (qr_code_id, order_id, status)
  values (selected_qr.id, p_order_id, 'reserved');

  insert into public.order_items (order_id, product_type, quantity, taggo_id)
  values (p_order_id, 'taggo', 1, selected_qr.id);

  update public.orders
  set status = 'ready_for_assignment', updated_at = now()
  where id = p_order_id;

  select * into selected_qr from public.qr_codes where id = selected_qr.id;
  return selected_qr;
end;
$$;


--
-- Name: reserve_taggos_for_paid_order(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reserve_taggos_for_paid_order(p_order_id uuid, p_quantity integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: set_taggo_auto_renew(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_taggo_auto_renew(p_qr_id uuid, p_owner_id uuid, p_auto_renew boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_qr_id is null or p_owner_id is null or p_auto_renew is null then
    return false;
  end if;

  update public.subscriptions s
  set auto_renew = p_auto_renew, updated_at = now()
  where s.qr_code_id = p_qr_id
    and exists (
      select 1 from public.qr_codes q
      where q.id = p_qr_id and q.owner_id = p_owner_id
    );

  return found;
end;
$$;


--
-- Name: set_taggo_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_taggo_status(p_qr_id uuid, p_status text) RETURNS public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  target public.qr_codes;
  next_lifecycle text;
begin
  if p_qr_id is null or p_status is null then
    raise exception 'qr_id and status are required';
  end if;

  if p_status not in ('draft', 'active', 'inactive', 'archived') then
    raise exception 'invalid_status';
  end if;

  select q.* into target
  from public.qr_codes q
  where q.id = p_qr_id
  for update;

  -- Absence ou TAGGO d'autrui : pas d'erreur, pas d'écriture. La fonction est
  --Muette, comme `transition_taggo`.
  if not found or target.owner_id is distinct from auth.uid() then
    return null;
  end if;

  if p_status = 'active' then
    if target.lifecycle_status in ('replaced', 'cancelled') then
      raise exception 'invalid_lifecycle_transition';
    end if;
    if not public.taggo_subscription_allows_public(p_qr_id) then
      raise exception 'subscription_required';
    end if;
    next_lifecycle := 'active';
  elsif p_status = 'inactive' then
    next_lifecycle := 'inactive';
  else
    next_lifecycle := target.lifecycle_status;
  end if;

  update public.qr_codes q
  set status           = p_status,
      lifecycle_status = next_lifecycle,
      is_public        = (p_status = 'active'),
      updated_at       = now()
  where q.id = p_qr_id
    and q.owner_id = auth.uid()
  returning q.* into target;

  return target;
end;
$$;


--
-- Name: sync_profile_email_from_auth(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_profile_email_from_auth() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Pending changes are not proof that the new address is controlled by the
  -- user. Auth updates the effective address after its confirmation flow.
  if new.email_confirmed_at is null
     or nullif(trim(new.email_change), '') is not null then
    return new;
  end if;

  update public.profiles
     set email = new.email,
         updated_at = now()
   where id = new.id
     and email is distinct from new.email;

  return new;
end;
$$;


--
-- Name: taggo_is_owned_by_current_user(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.taggo_is_owned_by_current_user(p_qr_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.qr_codes q
    where q.id = p_qr_id
      and q.owner_id is not null
      and q.owner_id = auth.uid()
  );
$$;


--
-- Name: taggo_subscription_allows_public(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.taggo_subscription_allows_public(p_qr_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.subscriptions s
    where s.qr_code_id = p_qr_id
      and s.status = 'active'
      and s.ends_at is not null
      and s.ends_at > now()
  );
$$;


--
-- Name: transition_taggo(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.transition_taggo(p_qr_id uuid, p_target_status text) RETURNS public.qr_codes
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  selected_qr public.qr_codes;
begin
  -- Règle specificite a l'abonnement : une periode echue interdit l'entree en
  -- `active`. Sans cette condition, le cycle de vie public serait utilisable
  -- pour contourner l'expiration.
  if p_target_status = 'active' and not public.taggo_subscription_allows_public(p_qr_id) then
    return null;
  end if;

  update public.qr_codes q
  set lifecycle_status = p_target_status,
      status = case
        when p_target_status = 'active' then 'active'
        when p_target_status = 'inactive' then 'inactive'
        else q.status
      end,
      updated_at = now()
  where q.id = p_qr_id
    and q.owner_id = auth.uid()
    and (
      (q.lifecycle_status = 'activated' and p_target_status = 'active')
      or (q.lifecycle_status = 'active' and p_target_status in ('inactive', 'expired', 'suspended', 'replaced'))
      or (q.lifecycle_status = 'inactive' and p_target_status in ('active', 'replaced', 'cancelled'))
      or (q.lifecycle_status = 'expired' and p_target_status in ('active', 'replaced', 'cancelled'))
      or (q.lifecycle_status = 'suspended' and p_target_status in ('active', 'replaced', 'cancelled'))
    )
  returning q.* into selected_qr;
  return selected_qr;
end;
$$;


--
-- Name: email_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dedupe_key text NOT NULL,
    email_type text NOT NULL,
    order_id uuid,
    recipient_hash text,
    recipient_length integer,
    status text DEFAULT 'processing'::text NOT NULL,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT email_events_email_type_check CHECK ((email_type = ANY (ARRAY['ORDER_CONFIRMED'::text, 'ORDER_SHIPPED'::text, 'ORDER_DELIVERED'::text, 'REVIEW_REQUEST'::text, 'CART_ABANDONED'::text, 'WELCOME'::text, 'PASSWORD_RESET'::text, 'SUBSCRIPTION_EXPIRING'::text, 'SUBSCRIPTION_EXPIRED'::text, 'SUBSCRIPTION_RENEWED'::text]))),
    CONSTRAINT email_events_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'sent'::text, 'skipped'::text, 'failed'::text])))
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    product_type text DEFAULT 'taggo'::text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    taggo_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    product_id uuid,
    variant_id uuid,
    unit_price_cents integer,
    line_total_cents integer,
    CONSTRAINT order_items_product_type_check CHECK ((product_type = ANY (ARRAY['taggo'::text, 'apparel'::text]))),
    CONSTRAINT order_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_variants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    size text,
    color text,
    price_cents integer,
    currency text,
    sku text,
    available boolean DEFAULT false NOT NULL,
    stock integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT product_variants_currency_check CHECK (((currency IS NULL) OR (currency ~ '^[A-Z]{3}$'::text))),
    CONSTRAINT product_variants_price_cents_check CHECK (((price_cents IS NULL) OR (price_cents > 0))),
    CONSTRAINT product_variants_price_currency_check CHECK (((price_cents IS NULL) = (currency IS NULL))),
    CONSTRAINT product_variants_stock_check CHECK (((stock IS NULL) OR (stock >= 0)))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    short_description text,
    description text,
    status text DEFAULT 'draft'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT products_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 120))),
    CONSTRAINT products_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'archived'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    first_name text,
    last_name text,
    display_name text
);


--
-- Name: public_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    qr_code_id uuid NOT NULL,
    display_name text NOT NULL,
    headline text,
    bio text,
    profile_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: public_taggo_cards; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_taggo_cards AS
 SELECT id,
    public_id,
    title,
    destination_url,
    status
   FROM public.qr_codes q
  WHERE ((is_public = true) AND (status = 'active'::text) AND (destination_url IS NOT NULL) AND public.taggo_subscription_allows_public(id));


--
-- Name: stripe_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stripe_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    stripe_event_id text NOT NULL,
    event_type text NOT NULL,
    order_id uuid,
    status text DEFAULT 'processing'::text NOT NULL,
    detail text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT stripe_webhook_events_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'processed'::text, 'ignored'::text, 'failed'::text])))
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'trial'::text NOT NULL,
    plan_name text DEFAULT 'starter'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    qr_code_id uuid NOT NULL,
    auto_renew boolean DEFAULT false NOT NULL,
    source text,
    stripe_customer_id text,
    stripe_subscription_id text,
    stripe_price_id text,
    expired_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscriptions_period_check CHECK (((ends_at IS NULL) OR (started_at IS NULL) OR ((ends_at > started_at) AND ((EXTRACT(epoch FROM (ends_at - started_at)) >= (31500000)::numeric) AND (EXTRACT(epoch FROM (ends_at - started_at)) <= (31680000)::numeric))))),
    CONSTRAINT subscriptions_source_check CHECK ((source = ANY (ARRAY['included'::text, 'renewal'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text])))
);


--
-- Name: subscriptions_unattached_archive; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions_unattached_archive (
    row_id uuid NOT NULL,
    user_id uuid,
    status text,
    plan_name text,
    started_at timestamp with time zone,
    ends_at timestamp with time zone,
    archived_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: taggo_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.taggo_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    qr_code_id uuid NOT NULL,
    external_order_id text,
    external_product_id text,
    assigned_user_id uuid,
    status text DEFAULT 'reserved'::text NOT NULL,
    assigned_by text DEFAULT 'store'::text NOT NULL,
    reserved_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    order_id uuid,
    CONSTRAINT taggo_assignments_status_check CHECK ((status = ANY (ARRAY['reserved'::text, 'assigned'::text, 'cancelled'::text])))
);


--
-- Name: taggo_scan_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.taggo_scan_settings (
    id boolean DEFAULT true NOT NULL,
    min_interval_seconds integer DEFAULT 30 NOT NULL,
    CONSTRAINT taggo_scan_settings_id_check CHECK (id),
    CONSTRAINT taggo_scan_settings_min_interval_seconds_check CHECK (((min_interval_seconds >= 1) AND (min_interval_seconds <= 3600)))
);


--
-- Name: taggo_scans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.taggo_scans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    qr_code_id uuid NOT NULL,
    scanned_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_events email_events_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: email_events email_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_slug_key UNIQUE (slug);


--
-- Name: profiles profiles_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: public_profiles public_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_profiles
    ADD CONSTRAINT public_profiles_pkey PRIMARY KEY (id);


--
-- Name: public_profiles public_profiles_qr_code_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_profiles
    ADD CONSTRAINT public_profiles_qr_code_id_key UNIQUE (qr_code_id);


--
-- Name: qr_codes qr_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT qr_codes_pkey PRIMARY KEY (id);


--
-- Name: qr_codes qr_codes_public_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT qr_codes_public_id_key UNIQUE (public_id);


--
-- Name: stripe_webhook_events stripe_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: stripe_webhook_events stripe_webhook_events_stripe_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_stripe_event_id_key UNIQUE (stripe_event_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions_unattached_archive subscriptions_unattached_archive_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions_unattached_archive
    ADD CONSTRAINT subscriptions_unattached_archive_pkey PRIMARY KEY (row_id);


--
-- Name: taggo_assignments taggo_assignments_external_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_assignments
    ADD CONSTRAINT taggo_assignments_external_order_id_key UNIQUE (external_order_id);


--
-- Name: taggo_assignments taggo_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_assignments
    ADD CONSTRAINT taggo_assignments_pkey PRIMARY KEY (id);


--
-- Name: taggo_assignments taggo_assignments_qr_code_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_assignments
    ADD CONSTRAINT taggo_assignments_qr_code_id_key UNIQUE (qr_code_id);


--
-- Name: taggo_scan_settings taggo_scan_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_scan_settings
    ADD CONSTRAINT taggo_scan_settings_pkey PRIMARY KEY (id);


--
-- Name: taggo_scans taggo_scans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_scans
    ADD CONSTRAINT taggo_scans_pkey PRIMARY KEY (id);


--
-- Name: idx_email_events_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_events_order_id ON public.email_events USING btree (order_id);


--
-- Name: idx_email_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_events_type ON public.email_events USING btree (email_type);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_taggo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_taggo_id ON public.order_items USING btree (taggo_id);


--
-- Name: idx_order_items_taggo_unique_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_order_items_taggo_unique_active ON public.order_items USING btree (taggo_id) WHERE (taggo_id IS NOT NULL);


--
-- Name: idx_order_items_variant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_variant_id ON public.order_items USING btree (variant_id);


--
-- Name: idx_orders_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_stripe_session_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_orders_stripe_session_unique ON public.orders USING btree (stripe_checkout_session_id) WHERE (stripe_checkout_session_id IS NOT NULL);


--
-- Name: idx_product_variants_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_variants_product_id ON public.product_variants USING btree (product_id);


--
-- Name: idx_product_variants_unique_option; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_product_variants_unique_option ON public.product_variants USING btree (product_id, COALESCE(size, ''::text), COALESCE(color, ''::text));


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_status ON public.products USING btree (status);


--
-- Name: idx_public_profiles_qr_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_public_profiles_qr_code_id ON public.public_profiles USING btree (qr_code_id);


--
-- Name: idx_qr_codes_lifecycle_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_codes_lifecycle_status ON public.qr_codes USING btree (lifecycle_status);


--
-- Name: idx_qr_codes_owner_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_codes_owner_id ON public.qr_codes USING btree (owner_id);


--
-- Name: idx_qr_codes_public_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_qr_codes_public_id ON public.qr_codes USING btree (public_id);


--
-- Name: idx_stripe_webhook_events_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stripe_webhook_events_order_id ON public.stripe_webhook_events USING btree (order_id);


--
-- Name: idx_subscriptions_qr_code_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_subscriptions_qr_code_unique ON public.subscriptions USING btree (qr_code_id);


--
-- Name: idx_subscriptions_status_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status_ends_at ON public.subscriptions USING btree (status, ends_at);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: idx_taggo_assignments_assigned_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taggo_assignments_assigned_user_id ON public.taggo_assignments USING btree (assigned_user_id);


--
-- Name: idx_taggo_assignments_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taggo_assignments_order_id ON public.taggo_assignments USING btree (order_id);


--
-- Name: idx_taggo_assignments_order_qr_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_taggo_assignments_order_qr_unique ON public.taggo_assignments USING btree (order_id, qr_code_id) WHERE (order_id IS NOT NULL);


--
-- Name: idx_taggo_scans_qr_code_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taggo_scans_qr_code_id ON public.taggo_scans USING btree (qr_code_id);


--
-- Name: idx_taggo_scans_qr_code_id_scanned_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_taggo_scans_qr_code_id_scanned_at ON public.taggo_scans USING btree (qr_code_id, scanned_at DESC);


--
-- Name: profiles trg_profile_email_lock; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profile_email_lock BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_email();


--
-- Name: qr_codes trg_qr_codes_protect_server_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_qr_codes_protect_server_fields BEFORE INSERT OR UPDATE ON public.qr_codes FOR EACH ROW EXECUTE FUNCTION public.protect_qr_codes_server_fields();


--
-- Name: qr_codes trg_taggo_delete_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_taggo_delete_guard BEFORE DELETE ON public.qr_codes FOR EACH ROW EXECUTE FUNCTION public.prevent_taggo_delete_if_in_use();


--
-- Name: email_events email_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT email_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_taggo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_taggo_id_fkey FOREIGN KEY (taggo_id) REFERENCES public.qr_codes(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_variant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: public_profiles public_profiles_qr_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_profiles
    ADD CONSTRAINT public_profiles_qr_code_id_fkey FOREIGN KEY (qr_code_id) REFERENCES public.qr_codes(id) ON DELETE CASCADE;


--
-- Name: qr_codes qr_codes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_codes
    ADD CONSTRAINT qr_codes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: stripe_webhook_events stripe_webhook_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stripe_webhook_events
    ADD CONSTRAINT stripe_webhook_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: subscriptions subscriptions_qr_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_qr_code_id_fkey FOREIGN KEY (qr_code_id) REFERENCES public.qr_codes(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: taggo_assignments taggo_assignments_assigned_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_assignments
    ADD CONSTRAINT taggo_assignments_assigned_user_id_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: taggo_assignments taggo_assignments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_assignments
    ADD CONSTRAINT taggo_assignments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: taggo_assignments taggo_assignments_qr_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_assignments
    ADD CONSTRAINT taggo_assignments_qr_code_id_fkey FOREIGN KEY (qr_code_id) REFERENCES public.qr_codes(id) ON DELETE RESTRICT;


--
-- Name: taggo_scans taggo_scans_qr_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taggo_scans
    ADD CONSTRAINT taggo_scans_qr_code_id_fkey FOREIGN KEY (qr_code_id) REFERENCES public.qr_codes(id) ON DELETE CASCADE;


--
-- Name: orders Customers can create orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (((auth.uid() = customer_id) AND (status = 'draft'::text) AND (paid_at IS NULL) AND (subtotal_cents IS NULL) AND (currency IS NULL) AND (stripe_checkout_session_id IS NULL) AND (stripe_payment_intent_id IS NULL)));


--
-- Name: orders Customers can delete their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can delete their own orders" ON public.orders FOR DELETE TO authenticated USING (((auth.uid() = customer_id) AND (status = 'draft'::text) AND (paid_at IS NULL) AND (stripe_checkout_session_id IS NULL) AND (stripe_payment_intent_id IS NULL)));


--
-- Name: orders Customers can update their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can update their own orders" ON public.orders FOR UPDATE TO authenticated USING ((auth.uid() = customer_id)) WITH CHECK (((auth.uid() = customer_id) AND (status = ANY (ARRAY['draft'::text, 'pending'::text])) AND (paid_at IS NULL) AND (stripe_checkout_session_id IS NULL) AND (stripe_payment_intent_id IS NULL) AND (subtotal_cents IS NULL) AND (currency IS NULL)));


--
-- Name: orders Customers can view their own orders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Customers can view their own orders" ON public.orders FOR SELECT USING ((auth.uid() = customer_id));


--
-- Name: qr_codes Owners can delete their QR codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete their QR codes" ON public.qr_codes FOR DELETE USING ((auth.uid() = owner_id));


--
-- Name: qr_codes Owners can insert their QR codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can insert their QR codes" ON public.qr_codes FOR INSERT WITH CHECK (((auth.uid() = owner_id) AND (lifecycle_status = 'activated'::text)));


--
-- Name: public_profiles Owners can manage their public profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can manage their public profile" ON public.public_profiles TO authenticated USING (public.taggo_is_owned_by_current_user(qr_code_id)) WITH CHECK (public.taggo_is_owned_by_current_user(qr_code_id));


--
-- Name: qr_codes Owners can update their QR codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their QR codes" ON public.qr_codes FOR UPDATE TO authenticated USING ((auth.uid() = owner_id)) WITH CHECK ((auth.uid() = owner_id));


--
-- Name: taggo_scans Owners can view scans of their own taggos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view scans of their own taggos" ON public.taggo_scans FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.qr_codes q
  WHERE ((q.id = taggo_scans.qr_code_id) AND (q.owner_id = auth.uid())))));


--
-- Name: qr_codes Owners can view their QR codes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can view their QR codes" ON public.qr_codes FOR SELECT USING ((auth.uid() = owner_id));


--
-- Name: products Public can read active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read active products" ON public.products FOR SELECT USING ((status = 'active'::text));


--
-- Name: product_variants Public can read variants of active products; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read variants of active products" ON public.product_variants FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.products p
  WHERE ((p.id = product_variants.product_id) AND (p.status = 'active'::text)))));


--
-- Name: public_profiles Public can view public QR profile data; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can view public QR profile data" ON public.public_profiles FOR SELECT TO authenticated, anon USING (public.public_taggo_is_visible(qr_code_id));


--
-- Name: profiles Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: order_items Users can view their order items; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their order items" ON public.order_items FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.orders o
  WHERE ((o.id = order_items.order_id) AND (o.customer_id = auth.uid())))));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: subscriptions Users can view their own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own subscriptions" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: email_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: product_variants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: public_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: qr_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: stripe_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions_unattached_archive; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions_unattached_archive ENABLE ROW LEVEL SECURITY;

--
-- Name: taggo_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.taggo_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: taggo_scan_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.taggo_scan_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: taggo_scans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.taggo_scans ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO anon;
GRANT ALL ON SCHEMA public TO authenticated;
GRANT ALL ON SCHEMA public TO service_role;


--
-- Name: TABLE qr_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.qr_codes TO authenticated;
GRANT ALL ON TABLE public.qr_codes TO service_role;


--
-- Name: COLUMN qr_codes.destination_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(destination_url) ON TABLE public.qr_codes TO authenticated;


--
-- Name: COLUMN qr_codes.title; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(title) ON TABLE public.qr_codes TO authenticated;


--
-- Name: COLUMN qr_codes.description; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(description) ON TABLE public.qr_codes TO authenticated;


--
-- Name: FUNCTION activate_taggo(p_public_id text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.activate_taggo(p_public_id text) TO anon;
GRANT ALL ON FUNCTION public.activate_taggo(p_public_id text) TO authenticated;
GRANT ALL ON FUNCTION public.activate_taggo(p_public_id text) TO service_role;


--
-- Name: FUNCTION assign_taggo_to_customer(p_external_order_id text, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_taggo_to_customer(p_external_order_id text, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_taggo_to_customer(p_external_order_id text, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION assign_taggo_to_order_customer(p_order_id uuid, p_taggo_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_taggo_to_order_customer(p_order_id uuid, p_taggo_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_taggo_to_order_customer(p_order_id uuid, p_taggo_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.assign_taggo_to_order_customer(p_order_id uuid, p_taggo_id uuid) TO service_role;


--
-- Name: FUNCTION assign_taggo_to_user(p_qr_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.assign_taggo_to_user(p_qr_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.assign_taggo_to_user(p_qr_id uuid) TO service_role;


--
-- Name: FUNCTION begin_email_event(p_dedupe_key text, p_email_type text, p_order_id uuid, p_recipient_hash text, p_recipient_length integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.begin_email_event(p_dedupe_key text, p_email_type text, p_order_id uuid, p_recipient_hash text, p_recipient_length integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.begin_email_event(p_dedupe_key text, p_email_type text, p_order_id uuid, p_recipient_hash text, p_recipient_length integer) TO service_role;


--
-- Name: FUNCTION begin_stripe_event(p_stripe_event_id text, p_event_type text, p_order_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.begin_stripe_event(p_stripe_event_id text, p_event_type text, p_order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.begin_stripe_event(p_stripe_event_id text, p_event_type text, p_order_id uuid) TO service_role;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.orders TO authenticated;
GRANT ALL ON TABLE public.orders TO service_role;


--
-- Name: COLUMN orders.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.orders TO authenticated;


--
-- Name: FUNCTION create_order(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_order() FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_order() TO authenticated;
GRANT ALL ON FUNCTION public.create_order() TO service_role;


--
-- Name: FUNCTION create_shop_order(p_items jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_shop_order(p_items jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_shop_order(p_items jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.create_shop_order(p_items jsonb) TO service_role;


--
-- Name: FUNCTION expire_due_taggo_subscriptions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.expire_due_taggo_subscriptions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.expire_due_taggo_subscriptions() TO service_role;


--
-- Name: FUNCTION finish_email_event(p_dedupe_key text, p_status text, p_detail text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finish_email_event(p_dedupe_key text, p_status text, p_detail text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finish_email_event(p_dedupe_key text, p_status text, p_detail text) TO service_role;


--
-- Name: FUNCTION finish_stripe_event(p_stripe_event_id text, p_status text, p_detail text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finish_stripe_event(p_stripe_event_id text, p_status text, p_detail text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finish_stripe_event(p_stripe_event_id text, p_status text, p_detail text) TO service_role;


--
-- Name: FUNCTION generate_taggo_public_id(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_taggo_public_id() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_taggo_public_id() TO service_role;


--
-- Name: FUNCTION get_confirmed_order_recipient(p_order_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_confirmed_order_recipient(p_order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_confirmed_order_recipient(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION get_public_taggo_state(p_public_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_public_taggo_state(p_public_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_public_taggo_state(p_public_id text) TO anon;
GRANT ALL ON FUNCTION public.get_public_taggo_state(p_public_id text) TO authenticated;
GRANT ALL ON FUNCTION public.get_public_taggo_state(p_public_id text) TO service_role;


--
-- Name: FUNCTION get_shop_order_payment_status(p_order_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_shop_order_payment_status(p_order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_shop_order_payment_status(p_order_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_shop_order_payment_status(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION get_taggo_scan_stats(p_qr_id uuid, p_owner_id uuid, p_days integer, p_bucket text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_taggo_scan_stats(p_qr_id uuid, p_owner_id uuid, p_days integer, p_bucket text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_taggo_scan_stats(p_qr_id uuid, p_owner_id uuid, p_days integer, p_bucket text) TO service_role;


--
-- Name: FUNCTION get_taggo_subscription_status(p_qr_id uuid, p_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_taggo_subscription_status(p_qr_id uuid, p_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_taggo_subscription_status(p_qr_id uuid, p_owner_id uuid) TO service_role;


--
-- Name: FUNCTION grant_included_taggo_period(p_qr_id uuid, p_starts_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.grant_included_taggo_period(p_qr_id uuid, p_starts_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.grant_included_taggo_period(p_qr_id uuid, p_starts_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION mark_shop_order_paid(p_order_id uuid, p_stripe_session_id text, p_stripe_payment_intent_id text, p_amount_total integer, p_currency text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mark_shop_order_paid(p_order_id uuid, p_stripe_session_id text, p_stripe_payment_intent_id text, p_amount_total integer, p_currency text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mark_shop_order_paid(p_order_id uuid, p_stripe_session_id text, p_stripe_payment_intent_id text, p_amount_total integer, p_currency text) TO service_role;


--
-- Name: FUNCTION prevent_taggo_delete_if_in_use(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.prevent_taggo_delete_if_in_use() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prevent_taggo_delete_if_in_use() TO service_role;


--
-- Name: FUNCTION protect_profile_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_profile_email() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_profile_email() TO service_role;


--
-- Name: FUNCTION protect_qr_codes_server_fields(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.protect_qr_codes_server_fields() FROM PUBLIC;
GRANT ALL ON FUNCTION public.protect_qr_codes_server_fields() TO service_role;


--
-- Name: FUNCTION provision_taggo_stock(p_quantity integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.provision_taggo_stock(p_quantity integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.provision_taggo_stock(p_quantity integer) TO service_role;


--
-- Name: FUNCTION public_taggo_is_visible(p_qr_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.public_taggo_is_visible(p_qr_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.public_taggo_is_visible(p_qr_id uuid) TO anon;
GRANT ALL ON FUNCTION public.public_taggo_is_visible(p_qr_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.public_taggo_is_visible(p_qr_id uuid) TO service_role;


--
-- Name: FUNCTION reactivate_taggo_subscription(p_qr_id uuid, p_owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reactivate_taggo_subscription(p_qr_id uuid, p_owner_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reactivate_taggo_subscription(p_qr_id uuid, p_owner_id uuid) TO service_role;


--
-- Name: FUNCTION record_taggo_scan(p_public_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_taggo_scan(p_public_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_taggo_scan(p_public_id text) TO service_role;


--
-- Name: FUNCTION renew_taggo_subscription(p_qr_id uuid, p_owner_id uuid, p_starts_at timestamp with time zone, p_stripe_subscription_id text, p_stripe_price_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.renew_taggo_subscription(p_qr_id uuid, p_owner_id uuid, p_starts_at timestamp with time zone, p_stripe_subscription_id text, p_stripe_price_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.renew_taggo_subscription(p_qr_id uuid, p_owner_id uuid, p_starts_at timestamp with time zone, p_stripe_subscription_id text, p_stripe_price_id text) TO service_role;


--
-- Name: FUNCTION reserve_taggo_for_order(p_external_order_id text, p_external_product_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reserve_taggo_for_order(p_external_order_id text, p_external_product_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_taggo_for_order(p_external_order_id text, p_external_product_id text) TO service_role;


--
-- Name: FUNCTION reserve_taggo_for_order_id(p_order_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reserve_taggo_for_order_id(p_order_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_taggo_for_order_id(p_order_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.reserve_taggo_for_order_id(p_order_id uuid) TO service_role;


--
-- Name: FUNCTION reserve_taggos_for_paid_order(p_order_id uuid, p_quantity integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.reserve_taggos_for_paid_order(p_order_id uuid, p_quantity integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reserve_taggos_for_paid_order(p_order_id uuid, p_quantity integer) TO service_role;


--
-- Name: FUNCTION set_taggo_auto_renew(p_qr_id uuid, p_owner_id uuid, p_auto_renew boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_taggo_auto_renew(p_qr_id uuid, p_owner_id uuid, p_auto_renew boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_taggo_auto_renew(p_qr_id uuid, p_owner_id uuid, p_auto_renew boolean) TO service_role;


--
-- Name: FUNCTION set_taggo_status(p_qr_id uuid, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_taggo_status(p_qr_id uuid, p_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_taggo_status(p_qr_id uuid, p_status text) TO authenticated;
GRANT ALL ON FUNCTION public.set_taggo_status(p_qr_id uuid, p_status text) TO service_role;


--
-- Name: FUNCTION sync_profile_email_from_auth(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_profile_email_from_auth() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_profile_email_from_auth() TO service_role;


--
-- Name: FUNCTION taggo_is_owned_by_current_user(p_qr_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.taggo_is_owned_by_current_user(p_qr_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.taggo_is_owned_by_current_user(p_qr_id uuid) TO anon;
GRANT ALL ON FUNCTION public.taggo_is_owned_by_current_user(p_qr_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.taggo_is_owned_by_current_user(p_qr_id uuid) TO service_role;


--
-- Name: FUNCTION taggo_subscription_allows_public(p_qr_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.taggo_subscription_allows_public(p_qr_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.taggo_subscription_allows_public(p_qr_id uuid) TO anon;
GRANT ALL ON FUNCTION public.taggo_subscription_allows_public(p_qr_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.taggo_subscription_allows_public(p_qr_id uuid) TO service_role;


--
-- Name: FUNCTION transition_taggo(p_qr_id uuid, p_target_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.transition_taggo(p_qr_id uuid, p_target_status text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.transition_taggo(p_qr_id uuid, p_target_status text) TO authenticated;
GRANT ALL ON FUNCTION public.transition_taggo(p_qr_id uuid, p_target_status text) TO service_role;


--
-- Name: TABLE email_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.email_events TO service_role;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_items TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.order_items TO authenticated;
GRANT ALL ON TABLE public.order_items TO service_role;


--
-- Name: TABLE product_variants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.product_variants TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.product_variants TO authenticated;
GRANT ALL ON TABLE public.product_variants TO service_role;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.products TO anon;
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.products TO authenticated;
GRANT ALL ON TABLE public.products TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: COLUMN profiles.full_name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(full_name) ON TABLE public.profiles TO authenticated;


--
-- Name: COLUMN profiles.avatar_url; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(avatar_url) ON TABLE public.profiles TO authenticated;


--
-- Name: TABLE public_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,MAINTAIN ON TABLE public.public_profiles TO anon;
GRANT ALL ON TABLE public.public_profiles TO authenticated;
GRANT ALL ON TABLE public.public_profiles TO service_role;


--
-- Name: TABLE public_taggo_cards; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.public_taggo_cards TO service_role;
GRANT SELECT ON TABLE public.public_taggo_cards TO anon;
GRANT SELECT ON TABLE public.public_taggo_cards TO authenticated;


--
-- Name: TABLE stripe_webhook_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;


--
-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;


--
-- Name: TABLE subscriptions_unattached_archive; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.subscriptions_unattached_archive TO service_role;


--
-- Name: TABLE taggo_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.taggo_assignments TO service_role;


--
-- Name: TABLE taggo_scan_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.taggo_scan_settings TO service_role;


--
-- Name: TABLE taggo_scans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.taggo_scans TO authenticated;
GRANT ALL ON TABLE public.taggo_scans TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--



-- Application triggers on Supabase-owned auth.users are not included by
-- `pg_dump --schema=public`; recreate them after their public functions.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_sync_auth_email_to_profile ON auth.users;
CREATE TRIGGER trg_sync_auth_email_to_profile
  AFTER UPDATE OF email, email_confirmed_at, email_change ON auth.users
  FOR EACH ROW
  WHEN (
    old.email is distinct from new.email
    or old.email_confirmed_at is distinct from new.email_confirmed_at
    or old.email_change is distinct from new.email_change
  )
  EXECUTE FUNCTION public.sync_profile_email_from_auth();
