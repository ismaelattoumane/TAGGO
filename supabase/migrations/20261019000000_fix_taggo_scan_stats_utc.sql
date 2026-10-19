-- Fix: calcul de "today" indépendant du fuseau de la session PostgreSQL.
-- Les autres règles, contrôles et droits de get_taggo_scan_stats sont conservés.

create or replace function public.get_taggo_scan_stats(
  p_qr_id uuid,
  p_owner_id uuid,
  p_days integer,
  p_bucket text default 'day'
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

  if not exists (
    select 1
    from public.qr_codes q
    where q.id = p_qr_id
      and q.owner_id = p_owner_id
  ) then
    return jsonb_build_object('ok', false, 'reason', 'not_owner');
  end if;

  select count(*) into total
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id;

  -- Minuit UTC converti explicitement en timestamptz.
  select count(*) into today
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= (
      date_trunc('day', now() at time zone 'utc')
      at time zone 'utc'
    );

  select count(*) into last_7
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= now() - interval '7 days';

  select count(*) into last_30
  from public.taggo_scans sc
  where sc.qr_code_id = p_qr_id
    and sc.scanned_at >= now() - interval '30 days';

  select coalesce(
    jsonb_agg(
      row_to_json(series_row)
      order by series_row.bucket_start
    ),
    '[]'::jsonb
  )
  into series
  from (
    select
      date_trunc(
        bucket_unit,
        scanned_at at time zone 'utc'
      ) as bucket_start,
      count(*)::bigint as scans
    from public.taggo_scans
    where qr_code_id = p_qr_id
      and scanned_at >= now() - make_interval(days => window_days)
    group by 1
  ) as series_row;

  select coalesce(
    jsonb_agg(
      to_jsonb(recent_row)
      order by recent_row.scanned_at desc
    ),
    '[]'::jsonb
  )
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

-- Maintient les droits attendus : RPC réservée au serveur.
revoke execute on function
  public.get_taggo_scan_stats(uuid, uuid, integer, text)
  from public, anon, authenticated;

grant execute on function
  public.get_taggo_scan_stats(uuid, uuid, integer, text)
  to service_role;
