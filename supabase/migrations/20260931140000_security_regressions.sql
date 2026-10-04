-- ---------------------------------------------------------------------------
-- Étape 14 — corrections de sécurité restantes
-- ---------------------------------------------------------------------------
-- 1) `profiles.email` reste la propriété du flux Supabase Auth.
-- 2) Un TAGGO attribué, expiré ou historisé ne peut pas être supprimé physiquement.
-- 3) `get_public_taggo_state` ne déclenche plus de balayage d'expiration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 1. verrou des emails de profil : autoriser uniquement le flux Auth officiel
-- ---------------------------------------------------------------------------
create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles
       set email = new.email,
           updated_at = now()
     where id = new.id;
  end if;

  return new;
end;
$$;

-- La confirmation de changement d'email est traitée côté Auth ; le profil suit la
-- source de vérité de Supabase, sans jamais accepter un `email` fourni client.
drop trigger if exists trg_sync_auth_email_to_profile on auth.users;
create trigger trg_sync_auth_email_to_profile
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_profile_email_from_auth();

create or replace function public.protect_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    if current_user = 'postgres'
       and current_setting('role', true) in ('none', 'postgres') then
      return new;
    end if;

    if current_setting('role', true) = 'service_role' then
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
  before update on public.profiles
  for each row
  execute function public.protect_profile_email();

-- La colonne est verrouillée explicitement pour le client ; les colonnes de
-- profil réellement modifiables restent disponibles par RLS.
revoke update (email) on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

update public.profiles p
   set email = u.email,
       updated_at = now()
  from auth.users u
 where p.id = u.id
   and p.email is distinct from u.email;

-- ---------------------------------------------------------------------------
-- 2. protection des TAGGO déjà affectés / historisés
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
            detail = 'A TAGGO with assignment or purchase history cannot be physically deleted.';
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

drop trigger if exists trg_taggo_delete_guard on public.qr_codes;
create trigger trg_taggo_delete_guard
  before delete on public.qr_codes
  for each row
  execute function public.prevent_taggo_delete_if_in_use();

-- ---------------------------------------------------------------------------
-- 3. lecture publique sans écriture : le traitement d'expiration reste dans la
--    logique de souscription déjà validée (et non réécrit ici).
--    Aucune redéfinition de `get_public_taggo_state` n'est faite dans cette
--    migration, car la fonction de lecture publique est déjà la source de vérité
--    de l'étape 12 et toute redéfinition ultérieure serait un risque de
--    divergence entre migration et instantané du schéma.
-- ---------------------------------------------------------------------------

revoke execute on function public.sync_profile_email_from_auth() from public, anon, authenticated;
grant execute on function public.sync_profile_email_from_auth() to service_role;
revoke execute on function public.protect_profile_email() from public, anon, authenticated;
revoke execute on function public.prevent_taggo_delete_if_in_use() from public, anon, authenticated;
