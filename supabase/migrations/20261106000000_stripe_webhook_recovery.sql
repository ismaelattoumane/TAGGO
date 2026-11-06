-- ===========================================================================
-- TAGGO — Récupération des webhooks Stripe et réparation des affectations
-- ===========================================================================
-- Migration additive : aucune migration appliquée n'est réécrite.
begin;

alter table public.stripe_webhook_events
  drop constraint if exists stripe_webhook_events_status_check;
alter table public.stripe_webhook_events
  add constraint stripe_webhook_events_status_check
  check (status in ('processing', 'processed', 'ignored', 'failed', 'rejected'));

create or replace function public.mark_shop_order_paid(
  p_order_id uuid,
  p_stripe_session_id text,
  p_stripe_payment_intent_id text,
  p_amount_total integer,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.orders;
begin
  select * into target from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;

  if target.status not in ('pending', 'draft', 'paid') then
    raise exception 'invalid_order_status';
  end if;
  if target.subtotal_cents is null or p_amount_total is distinct from target.subtotal_cents then
    raise exception 'amount_mismatch';
  end if;
  if upper(coalesce(p_currency, '')) <> upper(coalesce(target.currency, ''))
     or upper(coalesce(p_currency, '')) <> 'EUR' then
    raise exception 'currency_mismatch';
  end if;
  if nullif(trim(p_stripe_session_id), '') is null
     or (target.stripe_checkout_session_id is not null
         and target.stripe_checkout_session_id is distinct from p_stripe_session_id) then
    raise exception 'session_mismatch';
  end if;
  if target.stripe_payment_intent_id is not null
     and target.stripe_payment_intent_id is distinct from p_stripe_payment_intent_id then
    raise exception 'payment_intent_mismatch';
  end if;

  if target.status = 'paid' then
    update public.orders
    set stripe_checkout_session_id = coalesce(stripe_checkout_session_id, p_stripe_session_id),
        stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_stripe_payment_intent_id),
        updated_at = now()
    where id = p_order_id;
    return jsonb_build_object('order_id', target.id, 'status', 'paid', 'already_paid', true);
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

revoke execute on function public.mark_shop_order_paid(uuid, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.mark_shop_order_paid(uuid, text, text, integer, text)
  to service_role;

create or replace function public.reserve_taggos_for_paid_order(
  p_order_id uuid,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.orders;
  selected_qr public.qr_codes;
  assigned_ids uuid[] := '{}';
  qr_id uuid;
  index integer;
  taggo_count integer;
  missing_count integer;
  included_starts timestamptz;
begin
  select * into target from public.orders where id = p_order_id for update;
  if not found then raise exception 'order_not_found'; end if;
  if target.status <> 'paid' then raise exception 'order_not_paid'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'invalid_quantity';
  end if;

  included_starts := coalesce(target.paid_at, now());

  select count(*)::integer into taggo_count
  from public.taggo_assignments a
  where a.order_id = p_order_id and a.status <> 'cancelled';

  if taggo_count > p_quantity then raise exception 'taggo_assignment_overflow'; end if;

  select coalesce(array_agg(a.qr_code_id order by a.qr_code_id), '{}')
  into assigned_ids
  from public.taggo_assignments a
  where a.order_id = p_order_id and a.status <> 'cancelled';

  -- Répare également la première année incluse des TAGGO déjà présents.
  foreach qr_id in array assigned_ids loop
    perform public.grant_included_taggo_period(qr_id, included_starts);
  end loop;

  missing_count := p_quantity - taggo_count;
  for index in 1..missing_count loop
    select * into selected_qr
    from public.qr_codes
    where lifecycle_status = 'available' and owner_id is null
    order by created_at, id
    for update skip locked
    limit 1;

    if not found then raise exception 'no_taggo_available'; end if;

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

    perform public.grant_included_taggo_period(selected_qr.id, included_starts);
    assigned_ids := array_append(assigned_ids, selected_qr.id);
  end loop;

  return jsonb_build_object(
    'order_id', p_order_id,
    'assigned_taggo_ids', assigned_ids,
    'already_reserved', missing_count = 0
  );
end;
$$;

revoke execute on function public.reserve_taggos_for_paid_order(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_taggos_for_paid_order(uuid, integer)
  to service_role;

create or replace function public.begin_stripe_event(
  p_stripe_event_id text,
  p_event_type text,
  p_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if nullif(trim(p_stripe_event_id), '') is null then raise exception 'invalid_event'; end if;

  insert into public.stripe_webhook_events (stripe_event_id, event_type, order_id)
  values (trim(p_stripe_event_id), p_event_type, p_order_id)
  on conflict (stripe_event_id) do update
  set status = 'processing',
      detail = null,
      processed_at = null,
      created_at = now()
  where public.stripe_webhook_events.status = 'failed'
     or (public.stripe_webhook_events.status = 'processed'
         and public.stripe_webhook_events.detail = 'paid_taggo_pending')
     or (public.stripe_webhook_events.status = 'processing'
         and public.stripe_webhook_events.created_at < now() - interval '5 minutes')
  returning id into inserted_id;

  return inserted_id is not null;
end;
$$;

revoke execute on function public.begin_stripe_event(text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.begin_stripe_event(text, text, uuid)
  to service_role;

commit;
