create extension if not exists pgcrypto;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update set email = excluded.email, full_name = excluded.full_name;
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.qr_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  public_id text not null unique check (public_id ~ '^TGG-[A-Z0-9]{7}$'),
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'archived')),
  destination_url text check (destination_url is null or destination_url ~* '^https?://[^[:space:]/]+([/:?#].*)?$'),
  title text check (title is null or length(trim(title)) between 1 and 80),
  description text,
  is_public boolean not null default false,
  lifecycle_status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.public_profiles (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null unique references public.qr_codes(id) on delete cascade,
  display_name text not null,
  headline text,
  bio text,
  profile_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'trial' check (status in ('trial', 'active', 'cancelled', 'expired')),
  plan_name text not null default 'starter',
  started_at timestamptz default now(),
  ends_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_qr_codes_owner_id on public.qr_codes(owner_id);
create index if not exists idx_qr_codes_public_id on public.qr_codes(public_id);
create index if not exists idx_public_profiles_qr_code_id on public.public_profiles(qr_code_id);
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);

alter table public.qr_codes alter column owner_id drop not null;
alter table public.qr_codes add column if not exists lifecycle_status text;
update public.qr_codes
set lifecycle_status = case
  when status = 'active' then 'active'
  when status = 'inactive' then 'inactive'
  when status = 'archived' then 'replaced'
  else 'activated'
end
where lifecycle_status is null;
alter table public.qr_codes alter column lifecycle_status set default 'available';
alter table public.qr_codes alter column lifecycle_status set not null;
alter table public.qr_codes drop constraint if exists qr_codes_lifecycle_status_check;
alter table public.qr_codes add constraint qr_codes_lifecycle_status_check
  check (lifecycle_status in ('available', 'reserved', 'assigned', 'activated', 'active', 'inactive', 'replaced', 'cancelled'));

create index if not exists idx_qr_codes_lifecycle_status on public.qr_codes(lifecycle_status);

create table if not exists public.taggo_assignments (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null unique references public.qr_codes(id) on delete restrict,
  external_order_id text not null unique,
  external_product_id text,
  assigned_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'reserved' check (status in ('reserved', 'assigned', 'cancelled')),
  assigned_by text not null default 'store',
  reserved_at timestamptz not null default now(),
  assigned_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_taggo_assignments_assigned_user_id
  on public.taggo_assignments(assigned_user_id);

alter table public.taggo_assignments enable row level security;

create or replace function public.generate_taggo_public_id()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  index integer;
begin
  loop
    candidate := 'TGG-';
    for index in 1..7 loop
      candidate := candidate || substr(alphabet, (get_byte(gen_random_bytes(1), 0) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.qr_codes where public_id = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.provision_taggo_stock(p_quantity integer)
returns setof public.qr_codes
language plpgsql
security definer set search_path = public
as $$
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
  set lifecycle_status = 'reserved', updated_at = now()
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
  set lifecycle_status = 'assigned', updated_at = now()
  where id = selected_qr_id
  returning * into selected_qr;
  return selected_qr;
end;
$$;

create or replace function public.get_public_taggo_state(p_public_id text)
returns text
language sql
security definer set search_path = public
as $$
  select case
    when not exists (select 1 from public.qr_codes where public_id = upper(trim(p_public_id))) then 'not_found'
    when exists (
      select 1 from public.qr_codes
      where public_id = upper(trim(p_public_id))
        and status = 'active'
        and is_public = true
        and destination_url is not null
    ) then 'active'
    when exists (
      select 1 from public.qr_codes
      where public_id = upper(trim(p_public_id))
        and lifecycle_status in ('available', 'reserved', 'assigned', 'activated')
    ) then 'unactivated'
    else 'unavailable'
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
  set owner_id = auth.uid(), lifecycle_status = 'active', status = 'active', updated_at = now()
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

revoke execute on function public.generate_taggo_public_id() from public, anon, authenticated;
revoke execute on function public.provision_taggo_stock(integer) from public, anon, authenticated;
revoke execute on function public.reserve_taggo_for_order(text, text) from public, anon, authenticated;
revoke execute on function public.assign_taggo_to_customer(text, uuid) from public, anon, authenticated;
grant execute on function public.reserve_taggo_for_order(text, text) to service_role;
grant execute on function public.assign_taggo_to_customer(text, uuid) to service_role;
grant execute on function public.provision_taggo_stock(integer) to service_role;
grant execute on function public.get_public_taggo_state(text) to anon, authenticated;
grant execute on function public.activate_taggo(text) to authenticated;

alter table public.qr_codes drop constraint if exists qr_codes_destination_url_check;
alter table public.qr_codes add constraint qr_codes_destination_url_check
  check (destination_url is null or destination_url ~* '^https?://[^[:space:]/]+([/:?#].*)?$');

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.qr_codes enable row level security;
alter table public.public_profiles enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "Owners can view their QR codes" on public.qr_codes;
create policy "Owners can view their QR codes" on public.qr_codes
for select using (auth.uid() = owner_id);

drop policy if exists "Public can view active QR codes" on public.qr_codes;
create policy "Public can view active QR codes" on public.qr_codes
for select using (is_public = true and status = 'active' and destination_url is not null);

drop policy if exists "Owners can insert their QR codes" on public.qr_codes;
create policy "Owners can insert their QR codes" on public.qr_codes
for insert with check (auth.uid() = owner_id and lifecycle_status = 'activated');

drop policy if exists "Owners can update their QR codes" on public.qr_codes;
create policy "Owners can update their QR codes" on public.qr_codes
for update using (auth.uid() = owner_id)
with check (auth.uid() = owner_id and lifecycle_status in ('activated', 'active', 'inactive'));

drop policy if exists "Owners can delete their QR codes" on public.qr_codes;
create policy "Owners can delete their QR codes" on public.qr_codes
for delete using (auth.uid() = owner_id);

drop policy if exists "Public can view public QR profile data" on public.public_profiles;
create policy "Public can view public QR profile data" on public.public_profiles
for select using (exists (
  select 1 from public.qr_codes q
  where q.id = public_profiles.qr_code_id
    and q.is_public = true
    and q.status = 'active'
    and q.destination_url is not null
));

drop policy if exists "Owners can manage their public profile" on public.public_profiles;
create policy "Owners can manage their public profile" on public.public_profiles
for all using (exists (
  select 1 from public.qr_codes q
  where q.id = public_profiles.qr_code_id and q.owner_id = auth.uid()
));

drop policy if exists "Users can manage their own subscriptions" on public.subscriptions;
drop policy if exists "Users can view their own subscriptions" on public.subscriptions;
create policy "Users can view their own subscriptions" on public.subscriptions
for select using (auth.uid() = user_id);
