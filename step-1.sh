cd /workspaces/TAGGO
export TAGGO_STACK_NAME=taggo_test_step13

printf '\n=== 1. PRIVILEGES EFFECTIFS SUR LES SCANS ===\n'
docker exec "${TAGGO_STACK_NAME}_pg" \
  psql -X -U postgres -d postgres -P pager=off -c "
    SELECT
      r.rolname,
      has_table_privilege(r.rolname, 'public.taggo_scans', 'SELECT') AS can_select,
      has_table_privilege(r.rolname, 'public.taggo_scans', 'INSERT') AS can_insert,
      has_table_privilege(r.rolname, 'public.taggo_scans', 'UPDATE') AS can_update,
      has_table_privilege(r.rolname, 'public.taggo_scans', 'DELETE') AS can_delete,
      has_table_privilege(r.rolname, 'public.taggo_scans', 'TRUNCATE') AS can_truncate,
      has_table_privilege(r.rolname, 'public.taggo_scans', 'TRIGGER') AS can_create_trigger
    FROM pg_roles r
    WHERE r.rolname IN ('anon','authenticated','service_role','postgres')
    ORDER BY r.rolname;
  "

printf '\n=== 2. DEFINITIONS ET GRANTS DES FONCTIONS SENSIBLES ===\n'
docker exec "${TAGGO_STACK_NAME}_pg" \
  psql -X -U postgres -d postgres -P pager=off -c "
    SELECT
      p.oid::regprocedure AS fonction,
      pg_get_functiondef(p.oid) AS definition,
      (
        SELECT string_agg(
          CASE WHEN x.grantee = 0 THEN 'PUBLIC'
               ELSE pg_get_userbyid(x.grantee)
          END || ':' || x.privilege_type,
          ', ' ORDER BY x.grantee, x.privilege_type
        )
        FROM aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
      ) AS privileges
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'record_taggo_scan',
        'get_taggo_scan_stats',
        'transition_taggo',
        'get_public_taggo_state',
        'taggo_subscription_allows_public',
        'expire_due_taggo_subscriptions',
        'reactivate_taggo_subscription',
        'renew_taggo_subscription',
        'set_taggo_auto_renew',
        'get_taggo_subscription_status',
        'mark_shop_order_paid',
        'reserve_taggos_for_paid_order',
        'grant_included_taggo_period'
      )
    ORDER BY p.proname, p.oid::regprocedure::text;
  "