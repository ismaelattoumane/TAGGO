create or replace function public.assign_taggo_to_user(p_qr_id uuid)
returns public.qr_codes
language plpgsql
security definer set search_path = public
as $$
declare
  selected_qr public.qr_codes;
begin
  update public.qr_codes q
  set owner_id = auth.uid(),
      lifecycle_status = 'assigned',
      assigned_at = coalesce(assigned_at, now()),
      updated_at = now()
  where q.id = p_qr_id
    and q.owner_id is null
    and q.lifecycle_status in ('available', 'reserved')
  returning q.* into selected_qr;
  return selected_qr;
end;
$$;

revoke execute on function public.assign_taggo_to_user(uuid) from public, anon;
grant execute on function public.assign_taggo_to_user(uuid) to authenticated;
