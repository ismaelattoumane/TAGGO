create extension if not exists pgcrypto;

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
  owner_id uuid not null references public.profiles(id) on delete cascade,
  public_id text not null unique,
  status text not null default 'draft' check (status in ('draft', 'active', 'inactive', 'archived')),
  destination_url text,
  title text,
  description text,
  is_public boolean not null default false,
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

alter table public.profiles enable row level security;
alter table public.qr_codes enable row level security;
alter table public.public_profiles enable row level security;
alter table public.subscriptions enable row level security;

create policy "Users can view their own profile" on public.profiles
for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can insert their own profile" on public.profiles
for insert with check (auth.uid() = id);

create policy "Owners can view their QR codes" on public.qr_codes
for select using (auth.uid() = owner_id);

create policy "Owners can insert their QR codes" on public.qr_codes
for insert with check (auth.uid() = owner_id);

create policy "Owners can update their QR codes" on public.qr_codes
for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "Public can view public QR profile data" on public.public_profiles
for select using (true);

create policy "Owners can manage their public profile" on public.public_profiles
for all using (exists (
  select 1 from public.qr_codes q
  where q.id = public_profiles.qr_code_id and q.owner_id = auth.uid()
));

create policy "Users can view their own subscriptions" on public.subscriptions
for select using (auth.uid() = user_id);

create policy "Users can manage their own subscriptions" on public.subscriptions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
