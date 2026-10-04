#!/usr/bin/env bash
# TAGGO — pile Supabase locale minimale pour les tests RLS (étape 13.1).
#
# Pourquoi ce script existe alors que `npx supabase start` existe :
# la pile officielle monte une vingtaine de conteneurs, dont le portail, le
# studio, le stockage, le temps réel et les journaux. Les tests de sécurité de
# cette étape n'ont besoin que de trois choses : PostgreSQL, GoTrue (pour
# obtenir de VRAIS JWT) et PostgREST (le vrai point d'entrée HTTP).
#
# Trois conteneurs suffisent, démarrent en quelques secondes, et le script ne
# dépend d'aucun fichier de configuration supplémentaire. Il fonctionne aussi
# dans les environnements où le réseau entre conteneurs est restreint : GoTrue
# et PostgREST y sont lancés en `host` networking.
#
# Ports :
#   54322  PostgreSQL   (mot de passe : postgres / postgres)
#   8081   GoTrue       (signup + issuance de JWT)
#   3000   PostgREST    (API HTTP, le vrai endpoint PostgREST)
#
# Utilisation :
#   scripts/supabase-stack.sh up      démarre la pile (recréée si absente)
#   scripts/supabase-stack.sh status  état des trois services
#   scripts/supabase-stack.sh down    arrête et supprime la pile
#
# Le secret JWT ci-dessous est un secret DE TEST, local, sans valeur. Il n'a
# rien à voir avec une clé d'API Supabase et ne doit jamais être réutilisé.
set -uo pipefail

STACK_NAME="${TAGGO_STACK_NAME:-taggo}"
JWT_SECRET="${TAGGO_JWT_SECRET:-taggo-local-test-jwt-secret-at-least-32-chars}"
PG_IMAGE="${TAGGO_PG_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.165}"
AUTH_IMAGE="${TAGGO_AUTH_IMAGE:-public.ecr.aws/supabase/gotrue:v2.196.0}"
REST_IMAGE="${TAGGO_REST_IMAGE:-public.ecr.aws/supabase/postgrest:v16.1}"
PG_PORT="${TAGGO_PG_PORT:-54322}"
AUTH_PORT="${TAGGO_AUTH_PORT:-8081}"
REST_PORT="${TAGGO_REST_PORT:-3000}"

log() { printf '[stack] %s\n' "$*"; }

wait_for_http() {
  local url="$1" tries="$2" i
  for i in $(seq 1 "$tries"); do
    if curl -sS --max-time 3 -o /dev/null "$url" 2>/dev/null; then return 0; fi
    sleep 1
  done
  return 1
}

wait_for_pg() {
  local i
  for i in $(seq 1 90); do
    docker exec "${STACK_NAME}_pg" pg_isready -U postgres -q 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

start_pg() {
  docker rm -f "${STACK_NAME}_pg" >/dev/null 2>&1
  docker run -d --restart unless-stopped --name "${STACK_NAME}_pg" \
    -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=postgres \
    -e JWT_SECRET="$JWT_SECRET" -e JWT_EXP=3600 \
    -e SUPABASE_INTERNAL_JWT_SECRET=taggo-local-test-internal-jwt-secret-32 \
    -p "${PG_PORT}:5432" "$PG_IMAGE" >/dev/null
  wait_for_pg || { log "PostgreSQL n'a pas démarré"; return 1; }

# `postgres` n'est pas superuser dans l'image Supabase : le mot de passe TCP
  # des rôles de connexion est fixé via `supabase_admin`.
  #
  # L'image crée ses rôles pendant l'initialisation PUIS redémarre : `pg_isready`
  # peut répondre avant que le serveur définitif ne tourne, et un `ALTER ROLE`
  # appliqué trop tôt serait perdu au redémarrage. La paire (ALTER, vérification
  # TCP) est donc rejouée tant que la connexion par mot de passe échoue.
  local i ready=1
  for i in $(seq 1 40); do
    docker exec "${STACK_NAME}_pg" psql -U supabase_admin -d postgres -q -v ON_ERROR_STOP=1 \
      -c "alter role authenticator password 'postgres';" \
      -c "alter role supabase_admin password 'postgres';" >/dev/null 2>&1
    if docker exec "${STACK_NAME}_pg" psql "postgres://authenticator:postgres@127.0.0.1:5432/postgres" -Atc 'select 1' >/dev/null 2>&1; then
      ready=0
      break
    fi
    sleep 1
  done

  # Authentification TCP par mot de passe : c'est ce qu'exige PostgREST. Le
  # `psql` du conteneur est utilisé, l'hôte n'a pas forcément de client psql.
  if [ "$ready" -ne 0 ]; then
    log "le rôle 'authenticator' ne peut pas s'authentifier en TCP"
    return 1
  fi
  log "PostgreSQL prêt sur ${PG_PORT}"
}

# GoTrue : sans `GOTRUE_JWT_DEFAULT_GROUP_NAME`, les versions récentes émettent
# un access_token dont le claim `role` est VIDE ; PostgREST n'y aurait alors
# aucun rôle à appliquer et rejetterait la requête. La variable est donc fixée
# explicitement, comme le fait la plateforme Supabase hébergée.
start_auth() {
  docker rm -f "${STACK_NAME}_auth" >/dev/null 2>&1
  docker run -d --restart unless-stopped --name "${STACK_NAME}_auth" --network host \
    -e GOTRUE_DB_DRIVER=postgres \
    -e GOTRUE_DB_DATABASE_URL="postgres://supabase_admin:postgres@127.0.0.1:${PG_PORT}/postgres" \
    -e GOTRUE_SITE_URL=http://127.0.0.1:5173 \
    -e API_EXTERNAL_URL="http://127.0.0.1:${AUTH_PORT}" \
    -e GOTRUE_API_PORT="${AUTH_PORT}" \
    -e GOTRUE_JWT_SECRET="$JWT_SECRET" -e GOTRUE_JWT_EXP=3600 \
    -e GOTRUE_JWT_AUD=authenticated \
    -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
    -e GOTRUE_JWT_ADMIN_ROLES=service_role \
    -e GOTRUE_MAILER_AUTOCONFIRM=true \
    "$AUTH_IMAGE" >/dev/null
  wait_for_http "http://127.0.0.1:${AUTH_PORT}/health" 90 \
    && log "GoTrue prêt sur ${AUTH_PORT}" \
    || { log "GoTrue n'a pas démarré"; docker logs "${STACK_NAME}_auth" 2>&1 | tail -5; return 1; }
}

start_rest() {
  docker rm -f "${STACK_NAME}_rest" >/dev/null 2>&1
  docker run -d --restart unless-stopped --name "${STACK_NAME}_rest" --network host \
    -e PGRST_DB_URI="postgres://authenticator:postgres@127.0.0.1:${PG_PORT}/postgres" \
    -e PGRST_DB_SCHEMA=public \
    -e PGRST_DB_ANON_ROLE=anon \
    -e PGRST_JWT_SECRET="$JWT_SECRET" \
    -e PGRST_SERVER_PORT="${REST_PORT}" \
    "$REST_IMAGE" >/dev/null
  wait_for_http "http://127.0.0.1:${REST_PORT}/" 90 \
    && log "PostgREST prêt sur ${REST_PORT}" \
    || { log "PostgREST n'a pas démarré"; docker logs "${STACK_NAME}_rest" 2>&1 | tail -5; return 1; }
}

case "${1:-up}" in
  up)
    start_pg && start_auth && start_rest \
      && log "pile prête — PostgREST: http://127.0.0.1:${REST_PORT}" \
      || { log "ÉCHEC"; exit 1; }
    ;;
  down)
    docker rm -f "${STACK_NAME}_pg" "${STACK_NAME}_auth" "${STACK_NAME}_rest" >/dev/null 2>&1
    log "pile supprimée"
    ;;
  status)
    docker ps --filter "name=${STACK_NAME}_" --format '{{.Names}}\t{{.Status}}'
    ;;
  *)
    echo "usage: $0 {up|down|status}" >&2
    exit 2
    ;;
esac