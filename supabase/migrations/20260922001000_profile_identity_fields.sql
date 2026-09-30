alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists display_name text;

update public.profiles
set display_name = coalesce(nullif(trim(display_name), ''), nullif(trim(full_name), ''))
where display_name is null or trim(display_name) = '';