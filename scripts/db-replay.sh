#!/usr/bin/env bash
# TAGGO — rejeu COMPLET des migrations sur une base Supabase locale propre.
#
# C'est le filet de sécurité de l'étape 13.1 : la preuve ne vaut que si elle
# part d'un schéma VIDE et si CHAQUE migration s'applique seule, dans l'ordre du
# dépôt, sans intervention manuelle. Le schéma `public` est donc supprimé puis
# recréé, et les migrations sont appliquées une par une, dans l'ordre.
#
# Les privilèges par défaut de la plateforme Supabase sont reproduits : sans
# eux, `create table` n'accorderait rien à `anon` / `authenticated` /
# `service_role` et les tests de RLS ne prouveraient rien.
#
# Utilisation :
#   scripts/db-replay.sh            rejoue et affiche un résumé
#   scripts/db-replay.sh --quiet    même chose, sans le détail par migration
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_NAME="${TAGGO_STACK_NAME:-taggo}"
PG_CONTAINER="${STACK_NAME}_pg"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

if [[ "$STACK_NAME" != taggo_test_* ]]; then
  echo "ERREUR: rejeu destructif interdit hors pile isolée taggo_test_* (reçu: $STACK_NAME)." >&2
  echo "Démarrez une pile de test dédiée et définissez TAGGO_STACK_NAME." >&2
  exit 1
fi

psql_run() { docker exec -i "$PG_CONTAINER" psql -X -v ON_ERROR_STOP=1 -U postgres -d postgres "$@"; }
sql() { docker exec "$PG_CONTAINER" psql -X -U postgres -d postgres -Atc "$1"; }

if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  echo "ERREUR: conteneur $PG_CONTAINER absent. Lancez scripts/supabase-stack.sh up" >&2
  exit 1
fi

echo "=== 1. Réinitialisation du schéma public ==="
psql_run -q -c "drop schema if exists public cascade;" >/dev/null 2>&1
psql_run -q -c "create schema public;" >/dev/null
psql_run -q -c "grant all on schema public to postgres, anon, authenticated, service_role;" >/dev/null
psql_run -q -c "alter schema public owner to postgres;" >/dev/null
echo "    tables utilisateur restantes : $(sql "select count(*) from information_schema.tables where table_schema='public';")"

echo "=== 2. Privilèges par défaut de la plateforme ==="
psql_run -q <<'SQL' >/dev/null
alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
SQL
default_acl=$(sql "select count(*) from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public';")
if [ "$default_acl" -lt 3 ]; then
  echo "ERREUR: privilèges par défaut incomplets ($default_acl/3). Les tests de privilège seraient faussés." >&2
  exit 1
fi
echo "    entrées pg_default_acl : $default_acl (attendu : 3)"

echo "=== 3. Application des migrations, dans l'ordre du dépôt ==="
failed=0
applied=0
for file in $(ls -1 "$MIGRATIONS_DIR"/*.sql | sort); do
  name="$(basename "$file")"
  output="$(psql_run -f - < "$file" 2>&1)"
  rc=$?
  if [ $rc -eq 0 ]; then
    applied=$((applied + 1))
    [ "$QUIET" -eq 1 ] || printf '    OK    %s\n' "$name"
  else
    failed=1
    printf '    ECHEC %s\n' "$name"
    printf '%s\n' "$output" | grep -iE 'error|fatal|psql:|detail|hint|context' | sed 's/^/          /'
  fi
done

echo "=== 4. Contrôles de cohérence ==="
tables=$(sql "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r';")
functions=$(sql "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';")
policies=$(sql "select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public';")
triggers=$(sql "select count(*) from pg_trigger t where not t.tgisinternal;")
views=$(sql "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'v';")
echo "    tables=$tables  vues=$views  fonctions=$functions  policies=$policies  triggers=$triggers"

echo "================================================"
if [ "$failed" -eq 0 ]; then
  echo "RESULTAT: $applied migrations appliquées sans erreur"
  exit 0
fi
echo "RESULTAT: au moins une migration a échoué"
exit 1