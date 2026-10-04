-- ÉTAPE 11 — Analytics de scans TAGGO.
--
-- OBJECTIF : permettre à un propriétaire de TAGGO de consulter le nombre de
-- scans de SES propres TAGGO (total, aujourd'hui, 7/30/90 jours, évolution,
-- scans récents), sans jamais collecter de donnée personnelle de visiteur.
--
-- PRINCIPES APPLIQUÉS (privacy > quantité de données) :
--   1. MINIMISATION : la table ne contient QUE `qr_code_id` et `scanned_at`.
--      Aucun IP, aucun User-Agent, aucun pays, aucun device, aucun cookie,
--      aucun identifiant de visiteur n'est stocké. Voir docs/analytics.md.
--   2. MINIMISATION DES REQUÊTES : un scan est enregistré au maximum une fois
--      par fenêtre de `taggo_scan_min_interval_seconds` pour un TAGGO donné.
--      Cette fenêtre est purement temporelle et ne dépend d'aucune identité :
--      aucun IP n'est lu, conservé ni haché.
--   3. ÉCRITURE CÔTÉ SERVEUR UNIQUEMENT : la fonction `record_taggo_scan`
--      déduit elle-même le TAGGO depuis le code public, refuse les TAGGO non
--      actifs, et pose `scanned_at = now()` (heure serveur). Le navigateur ne
--      peut fournir ni taggo_id, ni owner_id, ni timestamp, ni compteur.
--   4. AUCUNE DONNÉE INVENTÉE : la table démarre vide ; les TAGGO existants
--      afficheront 0 scan tant qu'aucun scan réel n'a été enregistré.
--
-- Cette migration n'altère AUCUNE migration validée (étapes 5 à 10) : elle
-- crée une nouvelle table, une nouvelle fonction d'écriture et une nouvelle
-- fonction d'agrégation, sans modifier les tables existantes ni leurs
-- politiques RLS.

-- ---------------------------------------------------------------------------
-- 1. Fenêtre anti-abus
-- ---------------------------------------------------------------------------
-- Fenêtre minimale entre deux scans COMPTÉS pour un même TAGGO. Volontairement
-- courte : elle écrase les rafales de rafraîchissement (1000 F5 en une minute
-- ne comptent que ~2 scans) sans écarter un vrai visiteur, et sans aucune
-- donnée d'identité. Une fenêtre par IP n'est PAS appliquée : plusieurs
-- personnes peuvent partager une même adresse IP (famille, bureau, réseau
-- mobile), et TAGGO ne conserve pas d'IP pour distinguer les visiteurs. Une
-- limite quotidienne par IP sous-countrait donc des scans légitimes. Cf.
-- docs/analytics.md § « Anti-abus ».

create table if not exists public.taggo_scan_settings (
  id boolean primary key default true check (id),
  min_interval_seconds integer not null default 30
    check (min_interval_seconds between 1 and 3600)
);

insert into public.taggo_scan_settings (id, min_interval_seconds)
values (true, 30)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Table des scans
-- ---------------------------------------------------------------------------
-- DEUX colonnes de données, plus la clé primaire technique :
--   - `qr_code_id` : TAGGO scanné (clé étrangère, suppression en cascade) ;
--   - `scanned_at`  : horodatage posé par le SERVEUR (jamais par le client).
-- Rien d'autre. Aucune colonne « device », « pays », « referrer », « ip »,
-- « user_agent », « visitor_id » : elles n'ont pas été ajoutées parce qu'aucune
-- statistique affichée dans le dashboard ne les nécessite.

create table if not exists public.taggo_scans (
  id uuid primary key default gen_random_uuid(),
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  scanned_at timestamptz not null default now()
);

-- Agrégations par TAGGO, puis par TAGGO + période : couvre le total, les
-- fenêtres 7/30/90 jours, l'évolution quotidienne/hebdomadaire et les scans
-- récents sans scan séquentiel de la table.
create index if not exists idx_taggo_scans_qr_code_id
  on public.taggo_scans (qr_code_id);
create index if not exists idx_taggo_scans_qr_code_id_scanned_at
  on public.taggo_scans (qr_code_id, scanned_at desc);

alter table public.taggo_scans enable row level security;

-- Aucune politique d'écriture : le navigateur ne peut RIEN insérer.
-- Defence en profondeur, même si le frontend wrote directement en base.
--
-- Politique de lecture : un propriétaire authentifié ne voit que les scans de
-- SES propres TAGGO. Le contrôle passe par `qr_codes.owner_id = auth.uid()`,
-- jamais par un `owner_id` fourni par le client.
drop policy if exists "Owners can view scans of their own taggos" on public.taggo_scans;
create policy "Owners can view scans of their own taggos" on public.taggo_scans
  for select using (exists (
    select 1
    from public.qr_codes q
    where q.id = taggo_scans.qr_code_id
      and q.owner_id = auth.uid()
  ));

-- Aucune politique insert / update / delete : scans immuables et non effaçables
-- par le client. Seules les fonctions ci-dessous (service_role) écrivent.

-- ---------------------------------------------------------------------------
-- 3. Enregistrement d'un scan (service_role uniquement)
-- ---------------------------------------------------------------------------
-- Détermine ELLE-MÊME le TAGGO, son état et l'horodatage. Les seuls paramètres
-- acceptés sont le code public et la granularité d'agrégation desired
-- (`p_bucket`, 'day' | 'week'), qui ne sert qu'à la lecture et n'écrit rien.
--
-- Valeurs de retour (texte) :
--   'recorded'   : scan inséré ;
--   'duplicate'  : scan ignoré car un scan vient d'être compté pour ce TAGGO ;
--   'not_found'  : aucun TAGGO ne porte ce code ;
--   'not_active' : TAGGO existe mais n'est pas public/actif/destiné.

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
  select * into target
  from public.qr_codes q
  where q.public_id = upper(trim(p_public_id))
    and q.status = 'active'
    and q.is_public = true
    and q.destination_url is not null
  limit 1;

  -- On ne distingue pas « inexistant » et « inactif » du point de vue du
  -- visiteur : dans les deux cas rien n'est enregistré.
  if not found then
    return case
      when exists (
        select 1 from public.qr_codes q
        where q.public_id = upper(trim(p_public_id))
      ) then 'not_active'
      else 'not_found'
    end;
  end if;

  select coalesce(max(s.min_interval_seconds), 30)
  into min_interval
  from public.taggo_scan_settings s
  where s.id = true;

  -- Anti-abus : fenêtre purement temporelle par TAGGO. Aucune IP, aucun cookie,
  -- aucun identifiant de visiteur n'est lu ni stocké.
  select max(sc.scanned_at) into latest
  from public.taggo_scans sc
  where sc.qr_code_id = target.id
    and sc.scanned_at > now() - make_interval(secs => min_interval);

  if latest is not null then
    return 'duplicate';
  end if;

  -- `scanned_at` est posé par la base (now()), jamais transmis par l'appelant.
  insert into public.taggo_scans (qr_code_id, scanned_at)
  values (target.id, now());

  return 'recorded';
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Agrégation des analytics (service_role uniquement)
-- ---------------------------------------------------------------------------
-- Le propriétaire attendu est passé en paramètre explicite (`p_owner_id`) et
-- VÉRIFIÉ ici, dans la base, contre `qr_codes.owner_id`. L'appel serveur le
-- déduit du JWT : il ne vient jamais du corps de la requête. Le contrôle est
-- donc répété à deux niveaux (serveur + base).
--
-- `p_bucket` : 'day' pour 7 et 30 jours, 'week' pour 90 jours, afin de garder
-- un graphique lisible. Le paramètre est contraint : aucune granularité
-- arbitraire n'est acceptée.

create or replace function public.get_taggo_scan_stats(
  p_qr_id uuid,
  p_owner_id uuid,
  p_days integer,
  p_bucket text default 'day'
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  window_days integer;
  bucket_unit text;
  total bigint;
  today bigint;
  last_7 bigint;
  last_30 bigint;
  series jsonb;
  recent jsonb;
begin
  if p_qr_id is null or p_owner_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_request');
  end if;

  window_days := case
    when p_days = 7 then 7
    when p_days = 30 then 30
    when p_days = 90 then 90
    else null
  end;

  if window_days is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_period');
  end if;

  bucket_unit := case
    when p_bucket = 'week' then 'week'
    else 'day'
  end;

  -- Contrôle d'appartenance : c'est ICI que le propriétaire est vérifié.
  if not exists (
    select 1 from public.qr_codes q
    where q.id = p_qr_id and q.owner_id = p_owner_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  select count(*) into total
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id;

  -- « Aujourd'hui » est calculé en UTC : la borne est donc reproductible et
  -- ne dépend pas du fuseau du navigateur ou du serveur d'application.
  select count(*) into today
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= date_trunc('day', now() at time zone 'utc');

  select count(*) into last_7
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= now() - interval '7 days';

  select count(*) into last_30
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= now() - interval '30 days';

  select coalesce(jsonb_agg(row_to_json(series_row) order by series_row.bucket_start), '[]'::jsonb)
  into series
  from (
    select
      date_trunc(bucket_unit, scanned_at at time zone 'utc') as bucket_start,
      count(*)::bigint as scans
    from public.taggo_scans
    where qr_code_id = p_qr_id
      and scanned_at >= now() - make_interval(days => window_days)
    group by 1
  ) as series_row;

  -- Scans récents : horodatage uniquement, aucune donnée de visiteur n'existe
  -- dans la table, donc rien d'autre ne peut être exposé.
  select coalesce(jsonb_agg(to_jsonb(recent_row) order by recent_row.scanned_at desc), '[]'::jsonb)
  into recent
  from (
    select scanned_at
    from public.taggo_scans
    where qr_code_id = p_qr_id
    order by scanned_at desc
    limit 10
  ) as recent_row;

  return jsonb_build_object(
    'ok', true,
    'total', total,
    'today', today,
    'last_7', last_7,
    'last_30', last_30,
    'days', window_days,
    'bucket', bucket_unit,
    'series', series,
    'recent', recent
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Droits d'exécution
-- ---------------------------------------------------------------------------
-- Les deux fonctions sont réservées à `service_role` : ni le visiteur public,
-- ni le client authentifié ne peuvent enregistrer un scan ni lire une
-- agrégation. Le visiteur déclenche un scan via la fonction serveur
-- `/api/analytics/scan`, qui appelle `record_taggo_scan` avec la clé de
-- service. Un propriétaire ne lit ses statistiques que via
-- `/api/analytics/taggo`, qui vérifie le JWT puis l'appartenance en base.

revoke execute on function public.record_taggo_scan(text) from public, anon, authenticated;
grant execute on function public.record_taggo_scan(text) to service_role;

revoke execute on function public.get_taggo_scan_stats(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.get_taggo_scan_stats(uuid, uuid, integer, text) to service_role;

-- La table de réglage est interne : ni lecture ni écriture côté client.
revoke all on public.taggo_scan_settings from public, anon, authenticated;
alter table public.taggo_scan_settings enable row level security;
