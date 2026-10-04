-- ===========================================================================
-- Étape 13.1 — Durcissement des écritures (F4 + F3)
--
-- Constat (audit étape 13, tests réels sur PostgreSQL/Supabase) :
--
--   F4  La policy « Owners can update their QR codes » ne porte que sur
--       `owner_id`. Un propriétaire pouvait donc écrire DIRECTEMENT
--       `lifecycle_status`, `status`, `activated_at`, `reserved_at` et
--       `assigned_at`, en contournant `transition_taggo` — donc en
--       contournant son garde-fou d'abonnement, puisque ce garde-fou ne vit
--       que dans la fonction. Le modèle commercial restait fermé (grille
--       `taggo_subscription_allows_public`), mais le graphe de cycle de vie et
--       les horodatages d'audit n'étaient plus garantis par PostgreSQL.
--
--   F3  La policy d'UPDATE sur `orders` impose `paid_at`, `stripe_*` et
--       `subtotal_cents` à NULL, mais pas `currency`. Un client pouvait donc
--       écrire la devise de SA commande. Non exploitable (le montant reste
--       NULL, donc `mark_shop_order_paid` échoue d'abord sur
--       `amount_mismatch`), mais incohérent : une devise était client-écrivable
--       alors que tous les autres champs financiers ne l'étaient pas.
--
-- Correction : la protection est posée côté PostgreSQL, en deux couches
-- indépendantes. Aucune n'est contournable depuis le navigateur.
--   1. un TRIGGER qui refuse toute écriture de champ serveur par un rôle
--      client ;
--   2. des PRIVILÈGES DE COLONNES qui retirent aux rôles clients le droit
--      d'UPDATE sur ces colonnes.
--
-- Les écritures légitimes continuent de passer par les fonctions
-- `security definer` existantes, qui s'exécutent avec le propriétaire de la
-- table. La création d'un TAGGO, l'assignation, l'activation, les transitions,
-- les scans et le webhook Stripe ne sont pas modifiés.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Trigger de protection des champs serveur de `qr_codes`
-- ---------------------------------------------------------------------------
-- IMPORTANT — pourquoi cette fonction n'est PAS `security definer` :
-- une fonction `security definer` s'exécute avec les droits de son
-- propriétaire, donc `current_user` vaudrait TOUJOURS `postgres` ici et le
-- contrôle ne distinguerait plus l'appelant. En `security invoker`
-- (défaut), `current_user` est l'écriture réelle : `postgres` pour les
-- fonctions `security definer`, `authenticated` / `anon` pour une requête
-- PostgREST directe. C'est exactement la distinction à protéger.
create or replace function public.protect_qr_codes_server_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Un TAGGO naît `activated` / `draft` / non public. Les horodatages de
    -- réserve, d'affectation et d'activation sontotonorés par le serveur.
    if new.reserved_at is not null
       or new.assigned_at is not null
       or new.activated_at is not null then
      raise exception 'qr_codes_server_fields_are_read_only'
        using errcode = '42501',
              hint = 'reserved_at, assigned_at and activated_at are written by the server only.';
    end if;
    if new.status <> 'draft' or new.is_public then
      raise exception 'qr_codes_must_be_created_as_draft'
        using errcode = '42501',
              hint = 'A TAGGO is created as status=draft, is_public=false. Use set_taggo_status to publish it.';
    end if;
    return new;
  end if;

  -- `updated_at` est entretenu pour toute écriture, quelle qu'en soit la
  -- source : le navigateur ne l'envoyait pas, il restait donc figé.
  new.updated_at := now();

  -- Un propriétaire change le CONTENU de son TAGGO, jamais sa POSITION dans
  -- le cycle de vie ni son affectation. Ces champs appartiennent aux fonctions
  -- `security definer`, qui s'exécutent avec les droits du propriétaire.
  if new.id               is distinct from old.id
     or new.owner_id      is distinct from old.owner_id
     or new.public_id     is distinct from old.public_id
     or new.created_at    is distinct from old.created_at
     or new.status              is distinct from old.status
     or new.lifecycle_status    is distinct from old.lifecycle_status
     or new.reserved_at         is distinct from old.reserved_at
     or new.assigned_at         is distinct from old.assigned_at
     or new.activated_at        is distinct from old.activated_at
  then
    if current_user <> 'postgres' then
      raise exception 'qr_codes_server_fields_are_read_only'
        using errcode = '42501',
              hint = 'Use transition_taggo / set_taggo_status / activate_taggo instead of writing lifecycle or assignment columns.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_qr_codes_protect_server_fields on public.qr_codes;
create trigger trg_qr_codes_protect_server_fields
  before insert or update on public.qr_codes
  for each row execute function public.protect_qr_codes_server_fields();

revoke execute on function public.protect_qr_codes_server_fields() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Privilèges de colonnes : le client ne peut plus écrire ces champs
-- ---------------------------------------------------------------------------
-- `revoke update on <table>` retire le droit sur TOUTES les colonnes, puis on
-- réaccorde explicitement les seules colonnes de contenu que l'interface
-- édite. `updated_at` n'est pas réaccordé : le trigger l'entretient.
revoke update on public.qr_codes from anon, authenticated;
grant  update (title, description, destination_url) on public.qr_codes to authenticated;

-- La policy d'UPDATE ne doit plus laisser croire qu'une transition de cycle de
-- vie est possible depuis le navigateur : elle ne porte plus que sur
-- l'ownership. La contrainte effective est désormais le trigger + les
-- privilèges de colonnes ci-dessus.
drop policy if exists "Owners can update their QR codes" on public.qr_codes;
create policy "Owners can update their QR codes"
  on public.qr_codes
  for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- 3. `set_taggo_status` — le chemin autorisé pour l'état de publication
-- ---------------------------------------------------------------------------
-- Remplace l'écriture directe de `status` / `lifecycle_status` / `is_public`
-- par l'interface. Sémantique identique à ce que le navigateur faisait déjà
-- (mêmes valeurs, même correspondance), avec deux garde-fous que l'écriture
-- directe rendait contournables :
--   * entrer dans `active` exige une période non échue, exactement comme
--     `transition_taggo` ;
--   * un TAGGO `replaced` ou `cancelled` ne redevient jamais `active`.
-- `draft` et `archived` ne modifient que l'état de publication : le cycle de
-- vie est inchangé, comme auparavant.
create or replace function public.set_taggo_status(
  p_qr_id uuid,
  p_status text
)
returns public.qr_codes
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.qr_codes;
  next_lifecycle text;
begin
  if p_qr_id is null or p_status is null then
    raise exception 'qr_id and status are required';
  end if;

  if p_status not in ('draft', 'active', 'inactive', 'archived') then
    raise exception 'invalid_status';
  end if;

  select q.* into target
  from public.qr_codes q
  where q.id = p_qr_id
  for update;

  -- Absence ou TAGGO d'autrui : pas d'erreur, pas d'écriture. La fonction est
  --Muette, comme `transition_taggo`.
  if not found or target.owner_id is distinct from auth.uid() then
    return null;
  end if;

  if p_status = 'active' then
    if target.lifecycle_status in ('replaced', 'cancelled') then
      raise exception 'invalid_lifecycle_transition';
    end if;
    if not public.taggo_subscription_allows_public(p_qr_id) then
      raise exception 'subscription_required';
    end if;
    next_lifecycle := 'active';
  elsif p_status = 'inactive' then
    next_lifecycle := 'inactive';
  else
    next_lifecycle := target.lifecycle_status;
  end if;

  update public.qr_codes q
  set status           = p_status,
      lifecycle_status = next_lifecycle,
      is_public        = (p_status = 'active'),
      updated_at       = now()
  where q.id = p_qr_id
    and q.owner_id = auth.uid()
  returning q.* into target;

  return target;
end;
$$;

revoke execute on function public.set_taggo_status(uuid, text) from public, anon;
grant  execute on function public.set_taggo_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. F3 — `orders.currency` n'est plus écritable par un client
-- ---------------------------------------------------------------------------
-- La policy exige désormais `currency IS NULL`, comme les autres champs
-- financiers. Et le privilège de colonnes est aligné sur l'usage réel : le
-- navigateur n'écrit que `status` sur une commande.
drop policy if exists "Customers can update their own orders" on public.orders;
create policy "Customers can update their own orders"
  on public.orders
  for update to authenticated
  using (auth.uid() = customer_id)
  with check (
    auth.uid() = customer_id
    and status in ('draft', 'pending')
    and paid_at is null
    and stripe_checkout_session_id is null
    and stripe_payment_intent_id is null
    and subtotal_cents is null
    and currency is null
  );

revoke update on public.orders from anon, authenticated;
grant  update (status) on public.orders to authenticated;
