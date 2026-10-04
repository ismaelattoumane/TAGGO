-- Étape 14.1 — corrections après audit de validation

-- ---------------------------------------------------------------------------
-- 1. La lecture publique calcule l'expiration sans la traiter en écriture.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_taggo_state(p_public_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
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

-- ---------------------------------------------------------------------------
-- 2. Les profils sont liés à l'adresse courante de auth.users.
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists trg_profile_email_lock on public.profiles;
create trigger trg_profile_email_lock
  before insert or update on public.profiles
  for each row
  execute function public.protect_profile_email();

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

drop trigger if exists trg_sync_auth_email_to_profile on auth.users;
create trigger trg_sync_auth_email_to_profile
  after update of email, email_confirmed_at, email_change on auth.users
  for each row
  when (
    old.email is distinct from new.email
    or old.email_confirmed_at is distinct from new.email_confirmed_at
    or old.email_change is distinct from new.email_change
  )
  execute function public.sync_profile_email_from_auth();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- A confirmed address is resolved server-side from the paid order's Auth user.
-- The browser and profile metadata are not inputs to this decision.
create or replace function public.get_confirmed_order_recipient(p_order_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from public.orders o
  join auth.users u on u.id = o.customer_id
  where o.id = p_order_id
    and o.status = 'paid'
    and u.email_confirmed_at is not null
    and nullif(trim(u.email_change), '') is null
  limit 1;
$$;

revoke execute on function public.sync_profile_email_from_auth() from public, anon, authenticated;
grant execute on function public.sync_profile_email_from_auth() to service_role;
revoke execute on function public.protect_profile_email() from public, anon, authenticated;
revoke execute on function public.get_confirmed_order_recipient(uuid) from public, anon, authenticated;
grant execute on function public.get_confirmed_order_recipient(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 3. Preserve deletion protections and make their function immune to caller
--    RLS filtering. The earlier guard already checks every history relation.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_taggo_delete_if_in_use()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

revoke execute on function public.prevent_taggo_delete_if_in_use() from public, anon, authenticated;
