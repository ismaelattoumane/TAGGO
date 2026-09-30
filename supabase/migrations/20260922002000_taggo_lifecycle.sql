alter table public.qr_codes
  add column if not exists reserved_at timestamptz,
  add column if not exists assigned_at timestamptz,
  add column if not exists activated_at timestamptz;

alter table public.qr_codes drop constraint if exists qr_codes_lifecycle_status_check;
alter table public.qr_codes add constraint qr_codes_lifecycle_status_check
  check (lifecycle_status in ('available', 'reserved', 'assigned', 'activated', 'active', 'inactive', 'expired', 'suspended', 'replaced', 'cancelled'));

create or replace function public.reserve_taggo_for_order(
  p_external_order_id text,
  p_external_product_id text default null
)
returns public.qr_codes
language plpgsql
security definer set search_path = public
as $$
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

create or replace function public.assign_taggo_to_customer(
  p_external_order_id text,
  p_user_id uuid
)
returns public.qr_codes
language plpgsql
security definer set search_path = public
as $$
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

create or replace function public.activate_taggo(p_public_id text)
returns public.qr_codes
language plpgsql
security definer set search_path = public
as $$
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

create or replace function public.transition_taggo(
  p_qr_id uuid,
  p_target_status text
)
returns public.qr_codes
language plpgsql
security definer set search_path = public
as $$
declare
  selected_qr public.qr_codes;
begin
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

revoke execute on function public.transition_taggo(uuid, text) from public, anon;
grant execute on function public.transition_taggo(uuid, text) to authenticated;