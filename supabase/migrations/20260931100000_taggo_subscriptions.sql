-- ÉTAPE 12 — Abonnements TAGGO et expiration.
--
-- MODÈLE COMMERCIAL (défini par TAGGO, aucune invention ici) :
--   - l'achat d'un TAGGO ouvre une PREMIÈRE ANNÉE INCLUSE ;
--   - au-delà, un abonnement ANNUEL est nécessaire pour continuer à utiliser le
--     TAGGO ;
--   - le renouvellement peut être automatique (préférence enregistrée) ou
--     manuel (le propriétaire déclenche un paiement) ;
--   - sans renouvellement, le TAGGO expire et sa page publique est suspendue.
--
-- AUCUN MONTANT, AUCUN PRICE ID, AUCUN PRODUCT ID n'est introduit ici. Le
-- prix de renouvellement est À DÉCIDER : tant qu'il n'est pas configuré, le
-- renouvellement manuel répond `renewal_unavailable` et rien n'est facturé.
--
-- SOURCE DE VÉRITÉ
-- ---------------
-- `public.subscriptions` est l'unique source de vérité de la validité d'un
-- TAGGO. La table EXISTE déjà (migration initiale) mais n'a JAMAIS eu de
-- lecteurs ni d'écrivain applicatif : elle est donc ré-utilisée plutôt que
-- dupliquée, ce qui évite d'avoir deux systèmes d'abonnement.
--
-- Ce qui change ici :
--   - la granularité passe de l'UTILISATEUR (`user_id`) au TAGGO (`qr_code_id`),
--     car un propriétaire peut posséder plusieurs TAGGO avec des périodes
--     indépendantes ;
--   - le vocabulaire de statut est réduit à ce qui a réellement un écrivain.
--
-- MODÈLE DE DONNÉES
-- -----------------
-- Une ligne par TAGGO (`qr_code_id` unique). Le propriétaire reste porté par
-- `qr_codes.owner_id` : `subscriptions.user_id` n'est qu'un miroir utilisé par la politique RLS.
--
-- Statuts stockés (2 seulement, parce que 2 seulement ont un écrivain) :
--   - 'active'  : la période courante court (`ends_at > now()`) ;
--   - 'expired' : la période est terminée sans renouvellement.
--
-- Statuts NON créés, volontairement :
--   - 'pending'  : aucun paiement de renouvellement ne peut être amorcé tant que
--     le prix n'est pas configuré. Un statut sans écrivain serait un mensonge.
--   - 'cancelled': « ne pas renouveler » est déjà représenté par
--     `active` + `auto_renew = false`. Un statut supplémentaire serait redondant.
--   - 'expiring' : c'est un état AFFICHÉ, dérivé de la proximité de `ends_at`,
--     jamais un statut stocké — il n'a pas besoin d'un cron pour être vrai.
--
-- DURÉE : UNE ANNÉE CALENDAIRE
-- -----------------------------
-- La première année incluse et le renouvellement annuel ont EXACTEMENT la même
-- durée : `interval '1 year'`, c'est-à-dire la même date un an plus tard.
--
-- Ce n'est PAS « 365 jours » : c'est une année calendaire, c'est-à-dire la même
-- date un an plus tard. La différence est réelle et ne doit jamais être
-- approximée.
--   - 2027-03-01 -> 2028-03-01 : 366 JOURS, car le 29 février 2028 est compris
--     dans l'intervalle. Une période « 365 jours » expirerait ici UN JOUR TROP
--     TÔT.
--   - 2028-03-01 -> 2029-03-01 : 365 jours (le 29 février 2028 est déjà passé).
--     Une période « 366 jours » expirerait ici UN JOUR TROP TARD.
--   - 2028-02-29 -> 2029-02-28 : PostgreSQL RECALE le jour sur le dernier jour
--     valide du mois cible ; il ne déborde pas sur le 1er mars.
-- L'erreur se répète donc tous les quatre ans, dans un sens ou dans l'autre.
--
-- (L'erreur facile est d'inverser les deux premiers cas : c'est la période qui
-- CONTIENT le 29 février qui dure 366 jours, pas celle qui le suit.)
--
-- La durée est une constante SQL : ce n'est pas un paramètre commercial et le
-- navigateur ne peut ni la lire ni la modifier. La contrainte
-- `subscriptions_period_check` la rend INVÉRIFIABLE par la base elle-même : une
-- période écrite autrement qu'à un an exactement est refusée à l'insertion.

-- ---------------------------------------------------------------------------
-- 1. Préparation de `public.subscriptions`
-- ---------------------------------------------------------------------------
-- La colonne `qr_code_id` est ajoutée nullable, les lignes non rattachables sont
-- MIS EN ARCHIVE (§ 1a), puis la colonne est raidie.

alter table public.subscriptions
  add column if not exists qr_code_id uuid references public.qr_codes(id) on delete cascade;
alter table public.subscriptions
  add column if not exists auto_renew boolean not null default false;
alter table public.subscriptions
  add column if not exists source text;
alter table public.subscriptions
  add column if not exists stripe_customer_id text;
alter table public.subscriptions
  add column if not exists stripe_subscription_id text;
alter table public.subscriptions
  add column if not exists stripe_price_id text;
alter table public.subscriptions
  add column if not exists expired_at timestamptz;
alter table public.subscriptions
  add column if not exists cancelled_at timestamptz;
alter table public.subscriptions
  add column if not exists updated_at timestamptz not null default now();

-- Normalisation des statuts hérités avant de remplacer la contrainte :
-- 'trial' -> 'active', 'cancelled' -> 'expired'. Aucune écriture applicative
-- n'ayant jamais existé sur cette table, ces valeurs ne proviennent que d'une
-- saisie manuelle : on les ramène au vocabulaire réellement utilisé.
update public.subscriptions set status = 'active' where status = 'trial';
update public.subscriptions set status = 'expired' where status = 'cancelled';

-- ---------------------------------------------------------------------------
-- 1a. Lignes historiques non rattachables : ARCHIVÉES, jamais supprimées
-- ---------------------------------------------------------------------------
-- PRINCIPE : cette migration ne détruit AUCUNE donnée.
--
-- `public.subscriptions` existe depuis l'étape 1 et n'a JAMAIS eu d'écrivain
-- applicatif, mais elle a pu être remplie à la main. Une ligne sans
-- `qr_code_id` ne peut pas être rattachée de façon fiable à un TAGGO : la
-- rattacher au hasard créerait une fausse période active sur un TAGGO
-- aléatoire — c'est-à-dire un accès public indu. La deviner est aussi grave que
-- la supprimer.
--
-- STRATÈGIE RETENUE : archivage explicite, réversible et documentée.
--
--   1. copie intégrale dans `public.subscriptions_unattached_archive` ;
--   2. retrait de la ligne de `public.subscriptions` — nécessaire et SEULEMENT
--      parce que `qr_code_id` devient `not null` (contrainte de intégrité du
--      modèle TAGGO-par-ligne) ;
--   3. conservation intégrale en archive, clé `id` conservée, donc restauration
--      possible par simple `update` ;
--   4. `RAISE NOTICE` : le nombre de lignes archivées est visible dans les
--      logs de déploiement, il n'est jamais silencieux.
--
-- RÉVERSIBILITÉ (aucune perte) :
--   update public.subscriptions s
--      set qr_code_id = <id_rattache>
--   from public.subscriptions_unattached_archive a
--   where a.row_id = s.id and s.qr_code_id is null;
--
-- La table d'archive est en RLS, sans aucune politique : elle n'est lisible que
-- par `service_role`. Elle n'est jamais exposée au client.

create table if not exists public.subscriptions_unattached_archive (
  row_id uuid primary key,
  user_id uuid,
  status text,
  plan_name text,
  started_at timestamptz,
  ends_at timestamptz,
  archived_at timestamptz not null default now()
);

alter table public.subscriptions_unattached_archive enable row level security;

revoke all on public.subscriptions_unattached_archive from anon, authenticated;

-- Copie intégrale AVANT tout retrait : l'ordre des deux instructions est la
-- garantie qu'aucune ligne ne peut être perdue.
insert into public.subscriptions_unattached_archive (
  row_id, user_id, status, plan_name, started_at, ends_at
)
select s.id, s.user_id, s.status, s.plan_name, s.started_at, s.ends_at
from public.subscriptions s
where s.qr_code_id is null
on conflict (row_id) do nothing;

do $$
declare
  archived integer;
begin
  select count(*) into archived
  from public.subscriptions s
  where s.qr_code_id is null;

  if archived > 0 then
    raise notice
      'TAGGO etape 12 : % ligne(s) d''abonnement sans TAGGO rattache mise(s) en archive dans public.subscriptions_unattached_archive (restauration documentee dans docs/subscriptions.md).',
      archived;
  end if;
end;
$$;

-- Retrait STRICTEMENT limité aux lignes déjà copiées en archive (donc
-- dédupliquées) et nécessaire uniquement à la contrainte `not null` ci-dessous.
delete from public.subscriptions s
where s.qr_code_id is null
  and exists (
    select 1 from public.subscriptions_unattached_archive a where a.row_id = s.id
  );

alter table public.subscriptions alter column qr_code_id set not null;

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('active', 'expired'));

alter table public.subscriptions drop constraint if exists subscriptions_source_check;
alter table public.subscriptions add constraint subscriptions_source_check
  check (source in ('included', 'renewal'));

-- La durée est vérifiée par la base, DANS LES LIMITES DU POSSIBLE :
--
--   1. `subscriptions_period_check` borne la période entre 364,6 et 366,7 jours
--      (fenêtre élargie de part et d'autre pour absorber le passage d'heure
--      d'été : `timestamptz - timestamptz` autour d'un changement DST peut
--      différer d'une heure). Cette borne REFUSE une durée inventée (30 jours,
--      5 ans) et refuse explicitement « 365 jours pile » quand l'année est
--      bissextile.
--
--   2. La règle « même date un an plus tard » ne peut PAS être exprimée en
--      contrainte : sur une colonne `timestamptz`,
--      `ends_at = started_at + interval '1 year'` est refusé par PostgreSQL avec
--      « functions in check constraint must be marked IMMUTABLE », car
--      `timestamptz_pl_interval` dépend du `TimeZone` de session. C'est
--      volontairement documenté ici pour que personne n'ajoute un jour cette
--      contrainte et ne casse le déploiement.
--
--      La règle exacte est donc appliquée PAR CONSTRUCTION : `ends_at` n'est
--      écrit qu'à partir de `starts + interval '1 year'`, dans les deux seules
--      fonctions qui ouvrent une période (`grant_included_taggo_period` et
--      `renew_taggo_subscription`). Aucun autre écrivain n'existe, et le client ne
--      peut pas écrire du tout (§ 11). La garantie est donc complète : elle est
--      vérifiée par le test d'audit statique `src/lib/subscriptionSqlAudit.test.ts`,
--      qui échoue si un `ends_at` est écrit à partir d'une expression autre que
--      `+ interval '1 year'`.
alter table public.subscriptions drop constraint if exists subscriptions_period_check;
alter table public.subscriptions add constraint subscriptions_period_check
  check (
    ends_at is null
    or started_at is null
    or (
      ends_at > started_at
      and extract(epoch from (ends_at - started_at)) between 31500000 and 31680000
    )
  );

-- Une seule période gérée par TAGGO : c'est ce qui rend le renouvellement
-- idempotent (un webhook rejoué ne peut pas ouvrir une seconde période).
create unique index if not exists idx_subscriptions_qr_code_unique
  on public.subscriptions (qr_code_id);

-- Index du balayage d'expiration : seules les lignes à échéance sont visitées.
create index if not exists idx_subscriptions_status_ends_at
  on public.subscriptions (status, ends_at);

-- ---------------------------------------------------------------------------
-- 2. Période incluse ouverte au paiement confirmé
-- ---------------------------------------------------------------------------
-- Appelée depuis `reserve_taggos_for_paid_order`, donc TOUJOURS après
-- `mark_shop_order_paid` : une commande non payée n'atteint jamais cette
-- fonction, et n'ouvre donc aucune période.
--
-- `p_starts_at` reçoit `orders.paid_at` : la période est rattachée au paiement
-- confirmé, pas au checkout ni à l'attribution d'un TAGGO disponible.
--
-- Idempotence : `on conflict (qr_code_id) do nothing`. Un rejeu du webhook ne
-- peut donc pas allonger la période d'un TAGGO déjà couvert.

create or replace function public.grant_included_taggo_period(
  p_qr_id uuid,
  p_starts_at timestamptz default null
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
  starts timestamptz;
begin
  if p_qr_id is null then
    return false;
  end if;

  select q.owner_id into owner
  from public.qr_codes q
  where q.id = p_qr_id;

  -- Un TAGGO sans propriétaire n'a pas de période : on n'invente pas.
  if owner is null then
    return false;
  end if;

  starts := coalesce(p_starts_at, now());

  insert into public.subscriptions (
    qr_code_id, user_id, status, plan_name, source,
    auto_renew, started_at, ends_at
  )
  values (
    p_qr_id, owner, 'active', 'taggo_annual', 'included', false,
    -- ANNÉE CALENDAIRE, pas 365 jours : `interval '1 year'` conserve le jour et le
    -- mois, donc 01/03/2027 -> 01/03/2028 (366 j) comme 01/03/2028 ->
    -- 01/03/2029 (365 j). Seul site de calcul de `ends_at` pour la période
    -- incluse.
    starts, starts + interval '1 year'
  )
  on conflict (qr_code_id) do nothing;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Expiration
-- ---------------------------------------------------------------------------
-- APPROCHE RETENUE : balayage « à la lecture » + prédicat de validité.
--
-- Pourquoi PAS un cron : aucun cron n'existe dans ce projet (pas de section
-- `crons` dans vercel.json), et le nombre d'expirations ne doit dépendre d'aucune
-- infrastructure absente. Une TAGGO doit être expirée même si personne ne
-- visite le tableau de bord pendant des mois.
--
-- Deux barrières complémentaires, dans cet ordre de responsabilité :
--
--   (1) PRÉDICAT — `taggo_subscription_allows_public()` est utilisé par les
--       politiques RLS de lecture publique, par `get_public_taggo_state` et par
--       le comptage des scans. Même si le balayage n'a jamais tourné, un TAGGO
--       dont la période est terminée reste invisible publiquement. C'est la
--       barrière qui garantit le comportement.
--
--   (2) BALAYAGE — `expire_due_taggo_subscriptions()` écrit le statut réel
--       (`subscriptions.status = 'expired'`, `qr_codes.lifecycle_status =
--       'expired'`). Il est idempotent et borné : il ne touche que les lignes
--       déjà échues. Il est appelé par les lectures publiques et par la lecture
--       propriétaire, donc il finit par tourner même sans planificateur, et il
--       reste appelable par un cron le jour où TAGGO en ajoutera un.
--
-- `expiring` n'est PAS écrit : c'est un état affiché, dérivé de `ends_at`.

-- (1a) Prédicat de validité, utilisable depuis une politique RLS.
-- `security definer` est INDISPENSABLE : une politique RLS est évaluée avec les
-- droits de `anon`/`authenticated`, qui n'ont aucun droit de lecture sur
-- `public.subscriptions` (RLS activée, politique limitée au propriétaire). Sans
-- `security definer`, la sous-requête ne verrait jamais la période et aucune
-- TAGGO ne serait jamais bloquée.
--
-- SENS EXACT (aucun des deux cas ne se déduit de l'autre) :
--
--   `true`  -> il existe UNE période `active` ET NON ÉCHUE pour ce TAGGO.
--
--   `false` -> dans les DEUX autres cas :
--     (i)  une période existe mais est échue (`ends_at <= now()`), ou porte un
--          statut autre que `active` ;
-- (ii) AUCUNE période n'existe pour ce TAGGO.
--
-- Le cas (ii) est la CORRECTION capitale de cette étape. La version précédente
-- traitait « pas de période gérée » comme « accès public autorisé »
-- (`not exists (période échue)`), ce qui rendait le modèle commercial
-- contournable : un TAGGO obtenu hors du circuit de vente — ou simplement une
-- période supprimée par erreur — restait publiquement accessible sans
-- abonnement. « Pas de période » et « période échue » sont deux situations
-- différentes pour le propriétaire, mais pour le visiteur la réponse est
-- identique : ce TAGGO n'est pas utilisable.
--
-- Conséquence assumée : un TAGGO créé hors boutique (dashboard, import, ancien
-- jeu de données) n'est PAS public tant qu'aucune période n'a été ouverte.
-- C'est le comportement demandé, et `get_taggo_subscription_status` expose
-- `subscription_required` au propriétaire pour qu'il puisse l'expliquer.
--
-- `ends_at is null` est traité comme NON VALIDE (`false`) : une période sans
-- échéance n'est pas une preuve d'abonnement.
create or replace function public.taggo_subscription_allows_public(p_qr_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.qr_code_id = p_qr_id
      and s.status = 'active'
      and s.ends_at is not null
      and s.ends_at > now()
  );
$$;

-- (1b) Balayage : écrit l'état réel. Idempotent et borné.
create or replace function public.expire_due_taggo_subscriptions()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  expired_taggo_ids uuid[];
  expired_subscriptions integer := 0;
  expired_taggos integer := 0;
begin
  with due as (
    update public.subscriptions s
    set status = 'expired',
        expired_at = coalesce(s.expired_at, now()),
        updated_at = now()
    where s.status = 'active'
      and s.ends_at is not null
      and s.ends_at <= now()
    returning s.qr_code_id
  )
  select coalesce(array_agg(qr_code_id), '{}'), count(*)
  into expired_taggo_ids, expired_subscriptions
  from due;

  -- Transition TAGGO `active -> expired` : autorisée par le graphe existant
  -- (`transition_taggo`). Seul `active` est traité : un TAGGO `assigned` ou
  -- `activated` n'a pas de page publique, et le graphe interdit de le passer
  -- directement à `expired`.
  if array_length(expired_taggo_ids, 1) > 0 then
    update public.qr_codes q
    set lifecycle_status = 'expired',
        status = 'inactive',
        updated_at = now()
    where q.id = any(expired_taggo_ids)
      and q.lifecycle_status = 'active';

    get diagnostics expired_taggos = row_count;
  end if;

  return jsonb_build_object(
    'expired_subscriptions', expired_subscriptions,
    'expired_taggos', expired_taggos
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Réactivation après renouvellement confirmé
-- ---------------------------------------------------------------------------
-- `reactivate_taggo_subscription` est `service_role` uniquement. Elle NE FAIT
-- PAS confiance à l'appelant pour le propriétaire ni pour la validité : les deux
-- sont revérifiés en base.
--
-- Conditions cumulatives, toutes vérifiées ici :
--   1. le TAGGO existe ;
--   2. `p_owner_id` possède réellement ce TAGGO ;
--   3. une période `active` existe et `ends_at > now()`.
--
-- Sans la condition 3, un appelant malveillant (ou un bug) pourrait réactiver un
-- TAGGO dont le renouvellement n'a jamais été confirmé. C'est le test central de
-- l'étape : « renouvellement non confirmé -> pas de réactivation ».
--
-- La transition passe par le MÊME graphe que `transition_taggo`
-- (`expired -> active`), et non par une écriture directe : le cycle de vie reste
-- l'unique source de vérité du statut d'un TAGGO.
create or replace function public.reactivate_taggo_subscription(
  p_qr_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  selected_qr public.qr_codes;
begin
  if p_qr_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  select q.* into selected_qr
  from public.qr_codes q
  where q.id = p_qr_id and q.owner_id = p_owner_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  -- Le renouvellement doit être CONFIRMÉ : c'est la condition bloquante.
  if not exists (
    select 1 from public.subscriptions s
    where s.qr_code_id = p_qr_id
      and s.status = 'active'
      and s.ends_at is not null
      and s.ends_at > now()
  ) then
    return jsonb_build_object('ok', false, 'reason', 'no_valid_subscription');
  end if;

  -- Graphe de transitions existant : `expired -> active`.
  if selected_qr.lifecycle_status not in ('expired', 'suspended', 'inactive') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition');
  end if;

  update public.qr_codes q
  set lifecycle_status = 'active',
      status = 'active',
      updated_at = now()
  where q.id = p_qr_id
    and q.owner_id = p_owner_id
    and q.lifecycle_status in ('expired', 'suspended', 'inactive')
  returning q.* into selected_qr;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_transition');
  end if;

  return jsonb_build_object(
    'ok', true,
    'qr_code_id', selected_qr.id,
    'lifecycle_status', selected_qr.lifecycle_status,
    'status', selected_qr.status
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Fermeture d'une période par renouvellement confirmé (service_role)
-- ---------------------------------------------------------------------------
-- Utilisée par le futur flux de renouvellement AUTOMATIQUE (Stripe Billing).
-- Elle n'est appelée par aucun code à ce jour : le prix de renouvellement n'est
-- pas configuré. Elle existe pour que le système soit prêt et pour que
-- l'idempotence soit déjà garantie quand le branchement Stripe se fera.
--
-- Idempotence et anti-double-prolongement :
--   - la ligne existante est REPLACÉE (pas de seconde ligne) : un TAGGO n'a
--     qu'une période courante ;
--   - `p_starts_at` est fourni par le serveur, jamais par le navigateur ;
--   - un appel répété avec le MÊME `p_starts_at` recalcule la même fin de
--     période : la durée n'est jamais allongée deux fois.
create or replace function public.renew_taggo_subscription(
  p_qr_id uuid,
  p_owner_id uuid,
  p_starts_at timestamptz default null,
  p_stripe_subscription_id text default null,
  p_stripe_price_id text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  owner uuid;
  starts timestamptz;
begin
  if p_qr_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  select q.owner_id into owner
  from public.qr_codes q
  where q.id = p_qr_id and q.owner_id = p_owner_id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  starts := coalesce(p_starts_at, now());

  insert into public.subscriptions (
    qr_code_id, user_id, status, plan_name, source,
    auto_renew, started_at, ends_at,
    stripe_subscription_id, stripe_price_id,
    expired_at, updated_at
  )
  values (
    p_qr_id, owner, 'active', 'taggo_annual', 'renewal', false,
    -- ANNÉE CALENDAIRE, pas 365 jours (cf. § « DURÉE » et
    -- `subscriptions_period_check`).
    starts, starts + interval '1 year',
    nullif(trim(coalesce(p_stripe_subscription_id, '')), ''),
    nullif(trim(coalesce(p_stripe_price_id, '')), ''),
    null, now()
  )
  on conflict (qr_code_id) do update
  set status = 'active',
      source = 'renewal',
      started_at = starts,
      ends_at = starts + interval '1 year',
      stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.subscriptions.stripe_subscription_id),
      stripe_price_id = coalesce(excluded.stripe_price_id, public.subscriptions.stripe_price_id),
      expired_at = null,
      updated_at = now();

  return jsonb_build_object(
    'ok', true,
    'qr_code_id', p_qr_id,
    'started_at', starts,
    'ends_at', starts + interval '1 year'
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Préférence de renouvellement automatique (service_role)
-- ---------------------------------------------------------------------------
-- Le navigateur ne fournit QUE l'intention (« je veux / je ne veux pas de
-- renouvellement automatique »). Cette fonction est la seule voie d'écriture,
-- et elle ne touche QUE ce booléen : elle ne peut ni changer un statut, ni
-- prolonger une date, ni modifier un identifiant Stripe.
create or replace function public.set_taggo_auto_renew(
  p_qr_id uuid,
  p_owner_id uuid,
  p_auto_renew boolean
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if p_qr_id is null or p_owner_id is null or p_auto_renew is null then
    return false;
  end if;

  update public.subscriptions s
  set auto_renew = p_auto_renew, updated_at = now()
  where s.qr_code_id = p_qr_id
    and exists (
      select 1 from public.qr_codes q
      where q.id = p_qr_id and q.owner_id = p_owner_id
    );

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Lecture propriétaire de l'état d'abonnement (service_role)
-- ---------------------------------------------------------------------------
-- Appelée par `GET /api/subscriptions/taggo` après résolution du JWT. Le
-- propriétaire est déduit du JWT par l'API, puis RE-VÉRIFIÉ ici : un TAGGO
-- appartenant à quelqu'un d'autre renvoie `not_owner` sans révéler son état.
--
-- Le balayage est déclenché avant la lecture : le propriétaire voit l'état réel,
-- même si sa dernière visite remonte à avant l'échéance.
--
-- Deux résultats distincts, parce que le propriétaire doit pouvoir les
-- distinguer :
--   - `managed: true`  -> une période existe (éventuellement expirée) ;
--   - `managed: false` -> AUCUNE période : `subscription_required: true`. Ce TAGGO
--     est publiquement indisponible, et ce n'est PAS une expiration.
create or replace function public.get_taggo_subscription_status(
  p_qr_id uuid,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  row public.subscriptions;
  owned boolean;
  lifecycle text;
  sweep jsonb;
begin
  if p_qr_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  -- Effet de bord assumé et borné : écrit l'expiration réellement échue.
  sweep := public.expire_due_taggo_subscriptions();

  select exists (
    select 1 from public.qr_codes q
    where q.id = p_qr_id and q.owner_id = p_owner_id
  ) into owned;

  if not owned then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  select q.lifecycle_status into lifecycle
  from public.qr_codes q
  where q.id = p_qr_id;

  select s.* into row
  from public.subscriptions s
  where s.qr_code_id = p_qr_id;

  if not found then
    --(TAGGO SANS PÉRIODE : créé hors boutique, antérieur à l'étape 12, ou
    -- période supprimée par erreur. Aucune période n'est inventée : ce n'est pas
    -- un « actif », c'est un « non géré ».
    --
    -- `subscription_required` est explicite car cet état BLOQUE l'accès public
    -- (voir `taggo_subscription_allows_public`). Sans ce signal, le panneau
    -- propriétaire afficherait « aucune information » alors que son TAGGO est
    -- publiquement inaccessible — un diagnostic faux.
    return jsonb_build_object(
      'ok', true,
      'managed', false,
      'subscription_required', true,
      'reason', 'subscription_required',
      'renewal_available', false,
      'qr_id', p_qr_id,
      'lifecycle_status', lifecycle,
      'sweep', sweep
    );
  end if;

  -- Période présente mais échue : `renewal_unavailable` est renvoyé parce que
  -- le prix de renouvellement n'est pas configuré. Le propriétaire reçoit un
  -- refus explicite, jamais un échec silencieux.
  return jsonb_build_object(
    'ok', true,
    'managed', true,
    'subscription_required', false,
    'qr_id', p_qr_id,
    'lifecycle_status', lifecycle,
    'subscription_status', row.status,
    'source', row.source,
    'auto_renew', row.auto_renew,
    'started_at', row.started_at,
    'ends_at', row.ends_at,
    'expired_at', row.expired_at,
    'renewal_available', false,
    'sweep', sweep
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Cycle de vie : barrier anti-contournement
-- ---------------------------------------------------------------------------
-- `transition_taggo` est accordée à `authenticated` (migration étape 5). Sans
-- garde-fou, un propriétaire pourrait appeler `transition_taggo(qr_id, 'active')`
-- sur son propre TAGGO expiré et le réactiver sans aucun paiement : le modèle
-- commercial serait alors contournable par une seule requête PostgREST.
--
-- La fonction est donc redéfinie à l'identique, PLUS une règle : on ne peut pas
-- entrer dans `active` sans une période `active` ET non échue. Le graphe de
-- transitions reste inchangé par ailleurs.
--
-- COUVERTURE : le garde-fou porte sur TOUTE entrée en `active`, donc aussi bien
-- `activated -> active` que `expired -> active`, `inactive -> active` et
-- `suspended -> active`. Comme `taggo_subscription_allows_public` renvoie
-- `false` quand AUCUNE période n'existe (§ 1a), un TAGGO sans abonnement ne
-- peut pas non plus être activé depuis le dashboard : le modèle commercial est
-- fermé des deux côtés (page publique ET cycle de vie).
--
-- Le garde-fou ne s'applique qu'aux transitions VERS `active`. Sortir de
-- `active` (`inactive`, `suspended`, `replaced`) reste toujours possible : un
-- propriétaire doit pouvoir désactiver son TAGGO même sans abonnement valide.
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
  -- Règle specificite a l'abonnement : une periode echue interdit l'entree en
  -- `active`. Sans cette condition, le cycle de vie public serait utilisable
  -- pour contourner l'expiration.
  if p_target_status = 'active' and not public.taggo_subscription_allows_public(p_qr_id) then
    return null;
  end if;

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

-- ---------------------------------------------------------------------------
-- 9. Page publique : états « expiré » et « abonnement requis »
-- ---------------------------------------------------------------------------
-- Deux états sont distingués, et c'est volontaire :
--
--   'expired'                -> une période EXISTE et elle est terminée. Le
--                               propriétaire voit « votre abonnement a expiré » ;
--                               la situation est temporaire et réversible par un
--                               renouvellement.
--   'subscription_required'  -> AUCUNE période n'existe pour ce TAGGO. Ce n'est
--                               pas une expiration : le propriétaire n'a jamais
--                               eu (ou n'a plus) de période gérée. Confondre les
--                               deux afficherait « expiré » à quelqu'un qui n'a
--                               jamais été abonné.
--
-- `unavailable` reste réservé au TAGGO suspendu / remplacé / non actif.
--
-- ORDRE DE PRIORITÉ (il est signifiant, il est testé) :
--
--   1. code absent                      -> not_found
--   2. période échue                    -> expired        (le plus urgent)
--   3. cycle de vie antérieur à `active` -> unactivated    (« pas encore activé »
--                                               est plus exact que « pas
--                                               d'abonnement » : le visiteur a
--                                               une action à faire)
--   4. publiquement actif SANS période   -> subscription_required
--   5. publiquement actif AVEC période   -> active
--   6. sinon                             -> unavailable
--
-- Le balayage est déclenché AVANT le calcul de l'état : même si aucun cron n'a
-- tourné depuis des mois, la page publique ne peut pas exposer un TAGGO expiré.
create or replace function public.get_public_taggo_state(p_public_id text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  normalized text := upper(trim(coalesce(p_public_id, '')));
  found_qr public.qr_codes;
  allows_public boolean;
begin
  if normalized = '' then
    return 'not_found';
  end if;

  -- Effet de side assume : ne touche que les periodes deja echues.
  perform public.expire_due_taggo_subscriptions();

  select q.* into found_qr
  from public.qr_codes q
  where q.public_id = normalized;

  if not found then
    return 'not_found';
  end if;

  allows_public := public.taggo_subscription_allows_public(found_qr.id);

  -- Periode echue : prioritaire sur tout le reste.
  if not allows_public and exists (
    select 1 from public.subscriptions s where s.qr_code_id = found_qr.id
  ) then
    return 'expired';
  end if;

  -- Pas encore actif : le visiteur doit d'abord activer/configurer son TAGGO.
  -- Cette réponse prime sur « pas d'abonnement » parce qu'elle est actionnable.
  if found_qr.lifecycle_status in ('available', 'reserved', 'assigned', 'activated') then
    return 'unactivated';
  end if;

  -- Le TAGGO est prêt à être public mais aucune période ne le couvre : l'accès
  -- est refusé, et le propriétaire reçoit un diagnostic explicite.
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
-- 10. Lecture publique : RLS et comptage des scans
-- ---------------------------------------------------------------------------
-- Les politiques RLS sont la barrière (1) de l'expiration. Elles sont
-- modifiées pour exclure tout TAGGO dont la période est échue OU qui n'a aucune
-- période — y compris si le balayage n'a pas encore tourné.
--
-- `taggo_subscription_allows_public` renvoie `false` dès qu'aucune période
-- `active` ET non échue n'existe : ces deux politiques couvrent donc le cas «
-- TAGGO sans abonnement », et un TAGGO créé hors boutique n'est pas public tant
-- qu'aucune période n'a été ouverte.

drop policy if exists "Public can view active QR codes" on public.qr_codes;
create policy "Public can view active QR codes" on public.qr_codes
  for select using (
    is_public = true
    and status = 'active'
    and destination_url is not null
    and public.taggo_subscription_allows_public(id)
  );

drop policy if exists "Public can view public QR profile data" on public.public_profiles;
create policy "Public can view public QR profile data" on public.public_profiles
  for select using (exists (
  select 1 from public.qr_codes q
  where q.id = public_profiles.qr_code_id
    and q.is_public = true
    and q.status = 'active'
    and q.destination_url is not null
    and public.taggo_subscription_allows_public(q.id)
));

-- Un TAGGO dont la période est échue OU qui n'a AUCUNE période n'est pas
-- comptabilisé comme scan réussi : le visiteur a vu une page d'état, pas la
-- destination. Aucun scan n'est inséré, exactement comme pour un TAGGO non
-- actif.
--
-- Les garanties de l'étape 11 sont CONSERVÉES À L'IDENTIQUE et dans le même
-- ordre. Seul le prédicat d'abonnement s'intercale, entre la résolution du
-- TAGGO et la fenêtre anti-abus :
--
--   1. entrée vide                       -> not_found   [étape 11]
--   2. résolution serveur du code public -> {ci-dessous}[étape 11]
--   3. prédicat d'abonnement              -> not_active  [étape 12, AJOUT]
--   4. inexistant / non actif             -> not_found / not_active [étape 11]
--   5. fenêtre anti-abus temporelle      -> duplicate   [étape 11]
--   6. insertion                          -> recorded    [étape 11]
--
-- L'ajout est placé APRÈS la résolution du TAGGO et AVANT la fenêtre anti-abus
-- pour deux raisons : il ne peut ni transformer un `not_found` en `not_active`
-- pour un code absent, ni consommer le quota anti-abus d'un TAGGO bloqué (un
-- scan refusé ne doit pas empêcher un scan légitime ultérieur). La résolution du
-- `public_id` n'est pas modifiée : aucune information d'abonnement n'est
-- consultée à ce stade.
--
-- CONFIDENTIALITÉ : inchangée. Anti-abus purement temporel et par TAGGO —
-- aucune IP, aucun User-Agent, aucun cookie, aucun identifiant de visiteur, et
-- rien de l'abonnement n'est lu ni stocké.
create or replace function public.record_taggo_scan(
  p_public_id text
)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  target public.qr_codes;
  min_interval integer;
  latest timestamptz;
begin
  if nullif(trim(coalesce(p_public_id, '')), '') is null then
    return 'not_found';
  end if;

  -- Résolution côté serveur : normalise et recherche le code public.
  -- [GARANTIE ÉTAPE 11 — INCHANGÉE] Seul un TAGGO public, actif et destiné est
  -- retenu. La consultation n'est faite que par la base.
  select * into target
  from public.qr_codes q
  where q.public_id = upper(trim(p_public_id))
    and q.status = 'active'
    and q.is_public = true
    and q.destination_url is not null
  limit 1;

  -- [ÉTAPE 12] Période échue OU absente : la page affiche un état, pas la
  -- destination. La fenêtre anti-abus n'est volontairement PAS consommée ici.
  if found and not public.taggo_subscription_allows_public(target.id) then
    return 'not_active';
  end if;

  -- [GARANTIE ÉTAPE 11 — INCHANGÉE] On ne distingue pas « inexistant » et
  -- « inactif » du point de vue du visiteur : dans les deux cas rien n'est
  -- enregistré.
  if not found then
    return case
      when exists (
        select 1 from public.qr_codes q
        where q.public_id = upper(trim(p_public_id))
      ) then 'not_active'
      else 'not_found'
    end;
  end if;

  -- [GARANTIE ÉTAPE 11 — INCHANGÉE]
  select coalesce(max(s.min_interval_seconds), 30)
  into min_interval
  from public.taggo_scan_settings s
  where s.id = true;

  -- [GARANTIE ÉTAPE 11 — INCHANGÉE] Anti-abus : fenêtre purement temporelle par
  -- TAGGO. Aucune IP, aucun cookie, aucun identifiant de visiteur n'est lu ni
  -- stocké.
  select max(sc.scanned_at) into latest
  from public.taggo_scans sc
  where sc.qr_code_id = target.id
    and sc.scanned_at > now() - make_interval(secs => min_interval);

  if latest is not null then
    return 'duplicate';
  end if;

  -- [GARANTIE ÉTAPE 11 — INCHANGÉE] `scanned_at` est posé par la base (now()),
  -- jamais transmis par l'appelant.
  insert into public.taggo_scans (qr_code_id, scanned_at)
  values (target.id, now());

  return 'recorded';
end;
$$;

-- ---------------------------------------------------------------------------
-- 11. RLS et droits sur `public.subscriptions`
-- ---------------------------------------------------------------------------
-- Le propriétaire peut LIRE. Il ne peut RIEN ecrire : ni `status`, ni
-- `started_at`, ni `ends_at`, ni `stripe_*`, ni `auto_renew` directement.
-- Toutes les ecritures passent par des fonctions `service_role`.
--
-- `taggo_subscription_allows_public` doit rester appelable : elle est utilisee
-- par les politiques RLS en lecture. Elle ne retourne qu'un boologene et ne
-- revele aucune valeur.

alter table public.subscriptions enable row level security;

drop policy if exists "Users can view their own subscriptions" on public.subscriptions;
create policy "Users can view their own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

-- Aucune politique insert / update / delete : le client ne peut pas ecrire.

revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;
grant select on public.subscriptions to authenticated;

-- ---------------------------------------------------------------------------
-- 12. Droits d'execution
-- ---------------------------------------------------------------------------

revoke execute on function public.grant_included_taggo_period(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grant_included_taggo_period(uuid, timestamptz) to service_role;

revoke execute on function public.expire_due_taggo_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_due_taggo_subscriptions() to service_role;

revoke execute on function public.reactivate_taggo_subscription(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reactivate_taggo_subscription(uuid, uuid) to service_role;

revoke execute on function public.renew_taggo_subscription(uuid, uuid, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.renew_taggo_subscription(uuid, uuid, timestamptz, text, text) to service_role;

revoke execute on function public.set_taggo_auto_renew(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_taggo_auto_renew(uuid, uuid, boolean) to service_role;

revoke execute on function public.get_taggo_subscription_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_taggo_subscription_status(uuid, uuid) to service_role;

-- Le predicat DOIT rester executable par `anon` et `authenticated` : il est
-- evalue dans les politiques RLS de lecture publique. Il ne retourne qu'un
-- booleen et ne lit aucune donnee personnelle.
revoke execute on function public.taggo_subscription_allows_public(uuid) from public;
grant execute on function public.taggo_subscription_allows_public(uuid) to anon, authenticated, service_role;

-- `get_public_taggo_state` est redefini ici (ajout de l'etat
-- `subscription_required`) : `create or replace` conserve les droits, ils sont
-- donc reappliques explicitement pour que l'intention soit lisible dans la
-- migration.
--
-- POINT DE VIGILANCE AUDITE : cette fonction est appelable par `anon` ET par
-- `authenticated`, et elle déclenche `expire_due_taggo_subscriptions()`. C'est
-- donc une ECRITURE declenchee par une lecture anonyme. Elle est acceptable
-- pour trois raisons, et les trois doivent rester vraies :
--   1. elle est `security definer` : elle s'exécute avec les droits du
--      propriétaire de la fonction, pas ceux de l'appelant ;
--   2. l'écriture est strictement bornée — seules les lignes DÉJÀ échues sont
--      touchées, et l'opération est idempotente (rejouer dix fois donne le même
--      état) ;
--   3. elle ne peut ni créer, ni prolonger, ni supprimer une période : elle ne
--      fait que porter `active` -> `expired` sur des lignes dont `ends_at` est
--      déjà dans le passé. Aucune donnée ne peut être fabriquée par l'appelant.
-- Si un jour le balayage devenait capable d'écrire autre chose qu'un statut
--      d'expiration, il devrait être retiré de ce chemin.
revoke execute on function public.get_public_taggo_state(text) from public;
grant execute on function public.get_public_taggo_state(text) to anon, authenticated, service_role;

-- `record_taggo_scan` : service_role uniquement (le client appelle
-- `/api/analytics/scan`, jamais la fonction directement). Redéfini ici pour le
-- contrôle d'abonnement — droits reappliqués explicitement.
revoke execute on function public.record_taggo_scan(text) from public, anon, authenticated;
grant execute on function public.record_taggo_scan(text) to service_role;

-- `transition_taggo` : redéfini avec le garde-fou abonnement (§ 8). Le droits
-- d'exécution sont IDENTIQUES à l'étape 5 (`authenticated` uniquement) : cette
-- migration n'élargit pas la surface d'appel. `service_role` n'en a pas besoin,
-- `expire_due_taggo_subscriptions` et `reactivate_taggo_subscription` écrivent
-- directement et ne passent pas par ce graphe.
revoke execute on function public.transition_taggo(uuid, text) from public, anon;
grant execute on function public.transition_taggo(uuid, text) to authenticated;

-- La table d'archive des abonnements non rattachables (§ 1a) n'est lisible que
-- par `service_role` : elle ne doit jamais etre exposee au client, ni en lecture
-- directe ni par une politique RLS.
revoke all on public.subscriptions_unattached_archive from anon, authenticated;
grant all on public.subscriptions_unattached_archive to service_role;

-- ---------------------------------------------------------------------------
-- 13. Attribution des TAGGO payes : ouverture de la periode incluse
-- ---------------------------------------------------------------------------
-- Point d'HORODATAGE DE L'ATTRIBUTION : `reserve_taggos_for_paid_order` est
-- appelee par le webhook apres `mark_shop_order_paid`, et refuse toute commande
-- dont le statut n'est pas `paid`. La periode incluse ne peut donc pas demarrer
-- sur une commande non payee.
--
-- La fonction est recreatee integralement pour appeler
-- `grant_included_taggo_period` sur les deux chemins :
--   - premiere attribution (boucle) ;
--   - rejeu / `already_reserved` (parcours de rattrapage).
--
-- `p_starts_at` = `orders.paid_at`, donc la periode est rattachee au PAIEMENT
-- confirme et non au checkout ni au TAGGO physiquement reserve.

create or replace function public.reserve_taggos_for_paid_order(p_order_id uuid, p_quantity integer)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  target public.orders;
  selected_qr public.qr_codes;
  assigned_ids uuid[] := '{}';
  index integer;
  taggo_count integer;
  included_starts timestamptz;
begin
  select * into target from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  if target.status <> 'paid' then
    raise exception 'order_not_paid';
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 10 then
    raise exception 'invalid_quantity';
  end if;

  -- La periode incluse demarre au PAIEMENT confirme.
  included_starts := coalesce(target.paid_at, now());

  select count(*) into taggo_count
  from public.taggo_assignments a
  where a.order_id = p_order_id and a.status <> 'cancelled';

  if taggo_count > 0 then
    select coalesce(array_agg(a.qr_code_id order by a.qr_code_id), '{}')
    into assigned_ids
    from public.taggo_assignments a
    where a.order_id = p_order_id and a.status <> 'cancelled';

    -- Rejeu du webhook : les periodes incluses sont (re)verifiees sans jamais
    -- etre prolongees.
    foreach index in array assigned_ids loop
      perform public.grant_included_taggo_period(index, included_starts);
    end loop;

    return jsonb_build_object(
      'order_id', p_order_id,
      'assigned_taggo_ids', assigned_ids,
      'already_reserved', true
    );
  end if;

  for index in 1..p_quantity loop
    select * into selected_qr
    from public.qr_codes
    where lifecycle_status = 'available' and owner_id is null
    order by created_at, id
    for update skip locked
    limit 1;

    if not found then
      raise exception 'no_taggo_available';
    end if;

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

    -- Premiere annee incluse : une periode d'un an, par TAGGO attribue.
    perform public.grant_included_taggo_period(selected_qr.id, included_starts);

    assigned_ids := array_append(assigned_ids, selected_qr.id);
  end loop;

  return jsonb_build_object(
    'order_id', p_order_id,
    'assigned_taggo_ids', assigned_ids,
    'already_reserved', false
  );
end;
$$;

revoke execute on function public.reserve_taggos_for_paid_order(uuid, integer) from public, anon, authenticated;
grant execute on function public.reserve_taggos_for_paid_order(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 14. Vocabulaire d'emails d'abonnement
-- ---------------------------------------------------------------------------
-- Les trois evenements prevus (expiration prochaine, expiration, renouvellement
-- confirme) sont declares pour que la chaine email existante puisse les porter.
--
-- AUCUN declenchement automatique n'est mis en place : le projet n'a aucun
-- planificateur, et envoyer un email sans declencheur serveur fiable produirait
-- des messages fantomes. Point laisse explicitement ouvert (voir
-- docs/subscriptions.md).

alter table public.email_events drop constraint if exists email_events_email_type_check;
alter table public.email_events add constraint email_events_email_type_check
  check (
    email_type in (
      'ORDER_CONFIRMED',
      'ORDER_SHIPPED',
      'ORDER_DELIVERED',
      'REVIEW_REQUEST',
      'CART_ABANDONED',
      'WELCOME',
      'PASSWORD_RESET',
      'SUBSCRIPTION_EXPIRING',
      'SUBSCRIPTION_EXPIRED',
      'SUBSCRIPTION_RENEWED'
    )
  );