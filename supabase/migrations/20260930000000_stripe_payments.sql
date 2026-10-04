-- ÉTAPE 9 — Paiement Stripe
-- Catalogue serveur (source de vérité), paiement Stripe, idempotence du webhook,
-- transition `pending -> paid` réservée au serveur, réservation/assignation
-- TAGGO multiple pour les commandes multi-quantités.
--
-- AUCUNE donnée commerciale inventée : `price_cents` est NULL tant que les prix
-- officiels TAGGO n'existent pas. Aucune Checkout Session ne peut donc être créée.
--
-- Cette migration n'altère AUCUNE migration validée (étapes 5-7) : elle crée de
-- nouvelles structures et ajuste les contraintes par ALTER (jamais de réécriture).

-- ---------------------------------------------------------------------------
-- 1. Catalogue serveur
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) between 1 and 120),
  short_description text,
  description text,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text,
  color text,
  -- Prix officiel en centimes. NULL = prix non publié (jamais de prix inventé).
  price_cents integer check (price_cents is null or price_cents > 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  sku text,
  available boolean not null default false,
  -- NULL tant que le stock textile n'est pas défini.
  stock integer check (stock is null or stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un prix exige une devise ; pas de prix, pas de devise.
  constraint product_variants_price_currency_check
    check ((price_cents is null) = (currency is null))
);

create unique index if not exists idx_product_variants_unique_option
  on public.product_variants (product_id, coalesce(size, ''), coalesce(color, ''));

create index if not exists idx_product_variants_product_id on public.product_variants(product_id);
create index if not exists idx_products_status on public.products(status);

alter table public.products enable row level security;
alter table public.product_variants enable row level security;

-- Lecture publique du catalogue. Aucune politique d'écriture : le catalogue est
-- administré côté serveur (service_role uniquement).
drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products" on public.products
  for select using (status = 'active');

drop policy if exists "Public can read variants of active products" on public.product_variants;
create policy "Public can read variants of active products" on public.product_variants
  for select using (exists (
    select 1 from public.products p
    where p.id = product_variants.product_id and p.status = 'active'
  ));

-- ---------------------------------------------------------------------------
-- 2. Commandes : paiement (nouvelle migration, contraintes étendues)
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists subtotal_cents integer,
  add column if not exists currency text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text,
  add column if not exists paid_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('draft', 'pending', 'ready_for_assignment', 'assigned', 'paid', 'cancelled'));

alter table public.orders drop constraint if exists orders_currency_check;
alter table public.orders add constraint orders_currency_check
  check (currency is null or currency ~ '^[A-Z]{3}$');

-- Une commande ne peut porter qu'une seule Checkout Session Stripe.
create unique index if not exists idx_orders_stripe_session_unique
  on public.orders(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.order_items
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null,
  add column if not exists unit_price_cents integer,
  add column if not exists line_total_cents integer;

alter table public.order_items drop constraint if exists order_items_product_type_check;
alter table public.order_items add constraint order_items_product_type_check
  check (product_type in ('taggo', 'apparel'));

create index if not exists idx_order_items_variant_id on public.order_items(variant_id);

-- Sécurité RLS : le client ne doit plus pouvoir passer sa propre commande à
-- `paid` ni écrire les identifiants Stripe.
drop policy if exists "Customers can update their own orders" on public.orders;
create policy "Customers can update their own orders" on public.orders
  for update
  using (auth.uid() = customer_id)
  with check (
    auth.uid() = customer_id
    and status in ('draft', 'pending')
    and paid_at is null
    and stripe_checkout_session_id is null
    and stripe_payment_intent_id is null
    and subtotal_cents is null
  );

-- ---------------------------------------------------------------------------
-- 3. Idempotence des événements Stripe
-- ---------------------------------------------------------------------------

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'ignored', 'failed')),
  detail text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_stripe_webhook_events_order_id
  on public.stripe_webhook_events(order_id);

alter table public.stripe_webhook_events enable row level security;
-- Aucune politique : accessible uniquement via service_role (webhook).

-- ---------------------------------------------------------------------------
-- 4. Réservation multiple : une commande payée = N TAGGO distincts
--    L'étape 7 imposait UN SEUL assignment par commande (index unique sur
--    order_id). On le remplace par une unicité (order_id, qr_code_id).
-- ---------------------------------------------------------------------------

drop index if exists public.idx_taggo_assignments_order_id_unique;
create unique index if not exists idx_taggo_assignments_order_qr_unique
  on public.taggo_assignments(order_id, qr_code_id)
  where order_id is not null;

-- ---------------------------------------------------------------------------
-- 5. RPC serveur
-- ---------------------------------------------------------------------------

-- 5.1 Création d'une commande de boutique : le serveur relit le catalogue,
--     recalcule les prix et n'accepte que variantId + quantity.
create or replace function public.create_shop_order(p_items jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
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

-- 5.2 Passage à `paid` : strictement serveur (service_role).
create or replace function public.mark_shop_order_paid(
  p_order_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_amount_total integer,
  p_currency text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
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

-- 5.3 Réservation + assignation des TAGGO d'une commande payée (idempotent).
create or replace function public.reserve_taggos_for_paid_order(p_order_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  target public.orders;
  selected_qr public.qr_codes;
  assigned_ids uuid[] := '{}';
  index integer;
  taggo_count integer;
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

  select count(*) into taggo_count
  from public.taggo_assignments a
  where a.order_id = p_order_id and a.status <> 'cancelled';

  -- Déjà traité : on renvoie l'existant, jamais de double réservation.
  if taggo_count > 0 then
    select coalesce(array_agg(a.qr_code_id order by a.qr_code_id), '{}')
    into assigned_ids
    from public.taggo_assignments a
    where a.order_id = p_order_id and a.status <> 'cancelled';

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

    assigned_ids := array_append(assigned_ids, selected_qr.id);
  end loop;

  return jsonb_build_object(
    'order_id', p_order_id,
    'assigned_taggo_ids', assigned_ids,
    'already_reserved', false
  );
end;
$$;

-- 5.4 Idempotence : insert atomique d'un événement Stripe traité.
create or replace function public.begin_stripe_event(
  p_stripe_event_id text,
  p_event_type text,
  p_order_id uuid
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
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

create or replace function public.finish_stripe_event(
  p_stripe_event_id text,
  p_status text,
  p_detail text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.stripe_webhook_events
  set status = p_status,
      detail = left(coalesce(p_detail, ''), 300),
      processed_at = now()
  where stripe_event_id = trim(p_stripe_event_id);
end;
$$;

-- 5.5 Lecture serveur de l'état de paiement (page /checkout/success).
create or replace function public.get_shop_order_payment_status(p_order_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
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

-- ---------------------------------------------------------------------------
-- 6. Droits d'exécution
-- ---------------------------------------------------------------------------

revoke execute on function public.create_shop_order(jsonb) from public, anon;
grant execute on function public.create_shop_order(jsonb) to authenticated;

revoke execute on function public.mark_shop_order_paid(uuid, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.mark_shop_order_paid(uuid, text, text, integer, text) to service_role;

revoke execute on function public.reserve_taggos_for_paid_order(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_taggos_for_paid_order(uuid, integer) to service_role;

revoke execute on function public.begin_stripe_event(text, text, uuid) from public, anon, authenticated;
grant execute on function public.begin_stripe_event(text, text, uuid) to service_role;

revoke execute on function public.finish_stripe_event(text, text, text) from public, anon, authenticated;
grant execute on function public.finish_stripe_event(text, text, text) to service_role;

revoke execute on function public.get_shop_order_payment_status(uuid) from public, anon;
grant execute on function public.get_shop_order_payment_status(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Catalogue TAGGO (prix NULL : aucune donnée commerciale inventée)
-- ---------------------------------------------------------------------------

insert into public.products (id, slug, name, short_description, description, status)
values (
  '11111111-1111-4111-8111-111111111111',
  'tshirt-taggo',
  'T-shirt TAGGO',
  'Le T-shirt connecté TAGGO : un QR code qui mène à votre profil public personnalisable.',
  'Le T-shirt TAGGO porte le TAGGO TAG — un QR code unique qui ouvre votre page publique TAGGO.',
  'active'
)
on conflict (slug) do nothing;

insert into public.products (id, slug, name, short_description, description, status)
values (
  '22222222-2222-4222-8222-222222222222',
  'hoodie-taggo',
  'Hoodie TAGGO',
  'La version chaude du TAGGO : même QR code, même profil public, format hoodie.',
  'Le Hoodie TAGGO reprend le principe du T-shirt TAGGO. Sa production n''est pas encore annoncée.',
  'draft'
)
on conflict (slug) do nothing;

insert into public.product_variants (id, product_id, price_cents, currency, available)
values (
  '11111111-1111-4111-8111-111111111112',
  '11111111-1111-4111-8111-111111111111',
  null,
  null,
  true
)
on conflict (id) do nothing;

insert into public.product_variants (id, product_id, price_cents, currency, available)
values (
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222222',
  null,
  null,
  false
)
on conflict (id) do nothing;