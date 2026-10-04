#!/usr/bin/env bash
# TAGGO — suite de tests PostgreSQL/RLS de l'étape 13.1.
#
# Enchaîne, dans cet ordre :
#   1. le rejeu COMPLET des migrations sur une base propre (scripts/db-replay.sh)
#   2. les tests pgTAP de supabase/tests/*.sql
#   3. les tests HTTP de scripts/rls-http.test.mjs, avec de VRAIS JWT délivrés
#      par GoTrue, contre le vrai point d'entrée PostgREST
#
# Le code de sortie est non nul si une seule étape échoue.
#
# Les tests SQL utilisent `set local role anon|authenticated` et
# `request.jwt.claims` : c'est exactement ce que PostgRESTmet en place après
# avoir validé un Bearer token, donc la RLS est évaluée dans les conditions
# réelles. `service_role` n'est jamais utilisé pour prouver qu'un utilisateur
# normal est autorisé ou refusé.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_NAME="${TAGGO_STACK_NAME:-taggo}"
PG_CONTAINER="${STACK_NAME}_pg"
REST_PORT="${TAGGO_REST_PORT:-3000}"
AUTH_PORT="${TAGGO_AUTH_PORT:-8081}"

failures=0

section() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

section "1/3 — rejeu des migrations sur une base propre"
bash "$ROOT/scripts/db-replay.sh" --quiet || { echo "ECHEC: les migrations ne s'appliquent pas"; exit 1; }

section "2/3 — tests PostgreSQL / RLS (pgTAP)"
for file in "$ROOT"/supabase/tests/*.sql; do
  [ -e "$file" ] || continue
  name="$(basename "$file")"
  rc=0
  output="$(docker exec -i "$PG_CONTAINER" psql -X -q -A -t -v ON_ERROR_STOP=1 -U postgres -d postgres -f - < "$file" 2>&1)" || rc=$?
  plan="$(printf '%s\n' "$output" | awk '/^1\.\.[0-9]+$/ { value = substr($0, 4) } END { print value }')"
  passed="$(printf '%s\n' "$output" | awk '$1 == "ok" && $2 ~ /^[0-9]+$/ { count++ } END { print count + 0 }')"
  broken="$(printf '%s\n' "$output" | awk '$1 == "not" && $2 == "ok" { count++ } END { print count + 0 }')"
  if [ "$rc" -ne 0 ] || [ -z "$plan" ] || [ "$passed" -ne "${plan:-0}" ] || [ "$broken" -ne 0 ] \
    || printf '%s\n' "$output" | grep -qE 'Looks like you failed|Looks like you planned|(^|[[:space:]])ERROR:|psql:.*(ERROR|FATAL)'; then
    failures=$((failures + 1))
    printf '  \033[31mECHEC\033[0m %s (%s/%s assertions, %s en échec, psql=%s)\n' "$name" "$passed" "${plan:-absent}" "$broken" "$rc"
    printf '%s\n' "$output" | sed 's/^/         /'
  else
    printf '  \033[32mOK\033[0m    %s (%s/%s assertions)\n' "$name" "$passed" "$plan"
  fi
done

section "3/3 — tests HTTP PostgREST avec de vrais JWT GoTrue"
if node "$ROOT/scripts/rls-http.test.mjs"; then
  :
else
  failures=$((failures + 1))
fi

printf '\n================================================\n'
if [ "$failures" -eq 0 ]; then
  printf '\033[32mSUITE COMPLETE: tous les tests PostgreSQL/RLS passent\033[0m\n'
  exit 0
fi
printf '\033[31mSUITE EN ECHEC: %s fichier(s) de tests en échec\033[0m\n' "$failures"
exit 1