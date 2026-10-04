-- ÉTAPE 10 — Emails transactionnels : journal et déduplication.
--
-- OBJECTIF : garantir qu'un événement métier (commande payée, expédition,
-- livraison, compte créé, demande de reset, panier abandonné, demande d'avis)
-- ne déclenche AU PLUS UN email, même si l'événement est rejoué.
--
-- AUCUNE donnée inventée : aucun template, aucun destinataire, aucun contenu
-- n'est stocké ici. Aucune politique marketing n'est créée : la prospection
-- reste hors périmètre tant qu'aucun consentement n'est recueilli.
--
-- Cette migration n'altère AUCUNE migration validée (étapes 5 à 9) : elle crée
-- une nouvelle table et deux nouvelles fonctions, sans modifier les tables
-- existantes ni leurs politiques RLS.

-- ---------------------------------------------------------------------------
-- 1. Journal d'email
-- ---------------------------------------------------------------------------

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  -- Clé d'idempotence déterministe : `<EMAIL_TYPE>:<référence métier>`.
  dedupe_key text not null unique,
  email_type text not null check (
    email_type in (
      'ORDER_CONFIRMED',
      'ORDER_SHIPPED',
      'ORDER_DELIVERED',
      'REVIEW_REQUEST',
      'CART_ABANDONED',
      'WELCOME',
      'PASSWORD_RESET'
    )
  ),
  order_id uuid references public.orders(id) on delete set null,
  -- Adresse du destinataire HACHÉE (SHA-256) : on ne conserve pas la donnée
  -- personnelle en clair, on reste capable de retrouver un envoi.
  recipient_hash text,
  recipient_length integer,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'skipped', 'failed')),
  detail text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_email_events_order_id on public.email_events(order_id);
create index if not exists idx_email_events_type on public.email_events(email_type);

alter table public.email_events enable row level security;
-- Aucune politique : table accessible uniquement via service_role (serveur).

-- ---------------------------------------------------------------------------
-- 2. Réservation atomique de la clé d'idempotence
-- ---------------------------------------------------------------------------

create or replace function public.begin_email_event(
  p_dedupe_key text,
  p_email_type text,
  p_order_id uuid,
  p_recipient_hash text,
  p_recipient_length integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
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

create or replace function public.finish_email_event(
  p_dedupe_key text,
  p_status text,
  p_detail text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.email_events
  set status = p_status,
      detail = left(coalesce(p_detail, ''), 300),
      processed_at = now()
  where dedupe_key = left(trim(coalesce(p_dedupe_key, '')), 200);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Droits d'exécution : service_role uniquement.
--    Le client (frontend) ne peut donc jamais déclencher un email.
-- ---------------------------------------------------------------------------

revoke execute on function public.begin_email_event(text, text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.begin_email_event(text, text, uuid, text, integer) to service_role;

revoke execute on function public.finish_email_event(text, text, text) from public, anon, authenticated;
grant execute on function public.finish_email_event(text, text, text) to service_role;