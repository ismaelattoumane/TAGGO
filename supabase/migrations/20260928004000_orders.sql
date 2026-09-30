create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'pending', 'ready_for_assignment', 'assigned', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_orders_customer_id on public.orders(customer_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_type text not null default 'taggo' check (product_type in ('taggo')),
  quantity integer not null default 1 check (quantity > 0),
  taggo_id uuid references public.qr_codes(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_taggo_id on public.order_items(taggo_id);
create unique index if not exists idx_order_items_taggo_unique_active
  on public.order_items(taggo_id) where taggo_id is not null;

alter table public.taggo_assignments
  add column if not exists order_id uuid references public.orders(id) on delete set null;

alter table public.taggo_assignments
  alter column external_order_id drop not null;

create index if not exists idx_taggo_assignments_order_id on public.taggo_assignments(order_id);
create unique index if not exists idx_taggo_assignments_order_id_unique
  on public.taggo_assignments(order_id) where order_id is not null;

create or replace function public.create_order()
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  new_order public.orders;
begin
  insert into public.orders (customer_id, status)
  values (auth.uid(), 'draft')
  returning * into new_order;
  return new_order;
end;
$$;

create or replace function public.reserve_taggo_for_order_id(p_order_id uuid)
returns public.qr_codes
language plpgsql
security definer set search_path = public
as $$
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

create or replace function public.assign_taggo_to_order_customer(p_order_id uuid, p_taggo_id uuid)
returns public.qr_codes
language plpgsql
security definer set search_path = public
as $$
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

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Customers can view their own orders" on public.orders;
create policy "Customers can view their own orders" on public.orders
for select using (auth.uid() = customer_id);

drop policy if exists "Customers can create orders" on public.orders;
create policy "Customers can create orders" on public.orders
for insert with check (auth.uid() = customer_id and status = 'draft');

drop policy if exists "Customers can update their own orders" on public.orders;
create policy "Customers can update their own orders" on public.orders
for update using (auth.uid() = customer_id) with check (auth.uid() = customer_id);

drop policy if exists "Customers can delete their own orders" on public.orders;
create policy "Customers can delete their own orders" on public.orders
for delete using (auth.uid() = customer_id);

drop policy if exists "Users can view their order items" on public.order_items;
create policy "Users can view their order items" on public.order_items
for select using (exists (
  select 1 from public.orders o
  where o.id = order_items.order_id and o.customer_id = auth.uid()
));

revoke execute on function public.create_order() from public, anon;
grant execute on function public.create_order() to authenticated;

revoke execute on function public.reserve_taggo_for_order_id(uuid) from public, anon;
grant execute on function public.reserve_taggo_for_order_id(uuid) to authenticated;

revoke execute on function public.assign_taggo_to_order_customer(uuid, uuid) from public, anon;
grant execute on function public.assign_taggo_to_order_customer(uuid, uuid) to authenticated;
