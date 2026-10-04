#!/usr/bin/env bash
# TAGGO — supabase/schema.sql : instantané du schéma, et vérification de dérive.
#
# POURQUOI CET OUTIL EXISTE
# ------------------------
# `supabase/schema.sql` était un fichier maintenu à la main, arrêté aux étapes
# 5 à 7 : il ne contenait ni le catalogue, ni les paiements, ni les scans, ni les
# abonnements, ni le durcissement de l'étape 13. Il indiquait donc un schéma
# qui n'était pas celui de la base — et il indiquait EN PLUS des politiques qui
# n'existaient plus.
#
# Il est désormais GÉNÉRÉ, plus écrit à la main. Deux commandes :
#
#   scripts/db-schema.sh dump     régénère le fichier depuis une base réelle
#   scripts/db-schema.sh check    échoue si le fichier diffère de ce que
#                                 produisent les migrations
#
# `check` est le garde-fou à passer en CI et avant chaque livraison.
#
# SOURCE DE VÉRITÉ
# ----------------
#   supabase/migrations/*.sql   est la SOURCE DE VÉRITÉ. L'ordre du dépôt est
#                               l'ordre d'application.
#   supabase/schema.sql         est un INSTANTANÉ, destiné au provisionnement
#                               d'un projet Supabase neuf.
#
# Conséquence importante, et c'est le but de l'outil : `schema.sql` ne doit
# JAMAIS être réécrit pour « faire disparaître » une divergence. Si le
# `check` échoue, la seule correction légitime est de rejouer les migrations
# puis de régénérer. Inverser l'ordre — adapter le schéma pour qu'il rentre dans
# le fichier — supprimerait la preuve de la divergence au lieu de la traiter.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STACK_NAME="${TAGGO_STACK_NAME:-taggo}"
PG_CONTAINER="${STACK_NAME}_pg"
TARGET="$ROOT/supabase/schema.sql"

if ! docker ps --format '{{.Names}}' | grep -qx "$PG_CONTAINER"; then
  echo "ERREUR: conteneur $PG_CONTAINER absent. Lancez scripts/supabase-stack.sh up" >&2
  exit 1
fi

# L'instantané est produit par `pg_dump` exécuté DANS le conteneur : la version
# de pg_dump est donc exactement celle du serveur, condition pour un dump
# jouable. Seuls les objets du schéma applicatif `public` sont repris : le
# schéma `auth` appartient à Supabase et n'a pas à être rejoué.
#
# Les lignes `\restrict` / `\unrestrict` sont RETIRÉES : pg_dump y inscrit un
# jeton aléatoire à chaque exécution. Elles sont une protection de psql, pas du
# schéma ; les laisser rendrait `check` instable et donc inutile.
#
# `CREATE SCHEMA public;` est également retiré : le schéma `public` existe
# déjà sur tout Supabase, et sur une base neuve. La conserver ferait échouer
# l'instantané dès sa première ligne — c'est-à-dire le rendre inutilisable
# comme artefact de provisionnement, ce qu'il est censé être.
snapshot() {
  docker exec "$PG_CONTAINER" pg_dump \
    --schema-only \
    --schema=public \
    --no-owner \
    --no-comments \
    --dbname=postgres \
    --username=postgres \
  | grep -v -E '^\\(restrict|unrestrict) |^CREATE SCHEMA public;'
}

platform_auth_triggers() {
  cat <<'AUTH_TRIGGERS'

-- Application triggers on Supabase-owned auth.users are not included by
-- `pg_dump --schema=public`; recreate them after their public functions.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS trg_sync_auth_email_to_profile ON auth.users;
CREATE TRIGGER trg_sync_auth_email_to_profile
  AFTER UPDATE OF email, email_confirmed_at, email_change ON auth.users
  FOR EACH ROW
  WHEN (
    old.email is distinct from new.email
    or old.email_confirmed_at is distinct from new.email_confirmed_at
    or old.email_change is distinct from new.email_change
  )
  EXECUTE FUNCTION public.sync_profile_email_from_auth();
AUTH_TRIGGERS
}

header() {
  cat <<'HEADER'
-- ===========================================================================
-- TAGGO — INSTANTANÉ DU SCHÉMA (FICHIER GÉNÉRÉ, NE PAS ÉDITER À LA MAIN)
-- ===========================================================================
--
-- Source de vérité : supabase/migrations/*.sql, dans l'ordre du dépôt.
-- Ce fichier en est un instantané, produit par `scripts/db-schema.sh dump`
-- après application de TOUTES les migrations sur une base propre.
--
-- Il sert à provisionner un projet Supabase NEUF (Dashboard > SQL Editor, ou
-- `supabase db push` sur un projet vide). Il ne sert PAS à mettre à jour un
-- projet déjà en place : pour cela, on applique les migrations.
--
-- Régénérer :  scripts/db-schema.sh dump
-- Vérifier   :  scripts/db-schema.sh check   (échoue si le fichier a dérivé)
--
-- Les privilèges (`GRANT` / `REVOKE`) sont conservés : ils font partie du
-- modèle de sécurité autant que les policies, et c'est précisément leur
-- absence qui avait permis à `anon` d'écrire dans `qr_codes`.
-- ===========================================================================

-- pgcrypto est requis par `generate_taggo_public_id`, qui appelle
-- `extensions.gen_random_bytes`. Sur Supabase, pgcrypto est déjà présent dans
-- le schéma `extensions` : ces deux lignes ne font donc rien sur un projet
-- existant, et elles rendent l'instantané jouable aussi sur une base vierge.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

HEADER
}

command_dump() {
  if ! bash "$ROOT/scripts/db-replay.sh" --quiet >/dev/null 2>&1; then
    echo "ERREUR: les migrations ne s'appliquent pas, aucun instantané n'est produit." >&2
    exit 1
  fi
  { header; snapshot; platform_auth_triggers; } > "$TARGET"
  echo "supabase/schema.sql régénéré ($(grep -c '' "$TARGET") lignes)"
}

command_check() {
  if [ ! -f "$TARGET" ]; then
    echo "ERREUR: $TARGET absent. Lancez scripts/db-schema.sh dump" >&2
    exit 1
  fi
  if ! bash "$ROOT/scripts/db-replay.sh" --quiet >/dev/null 2>&1; then
    echo "ERREUR: les migrations ne s'appliquent pas, la dérive est inexploitable." >&2
    exit 1
  fi
  tmp="$(mktemp)"
  { header; snapshot; platform_auth_triggers; } > "$tmp"
  if diff -u "$TARGET" "$tmp" > /dev/null; then
    echo "OK: supabase/schema.sql correspond au résultat des migrations."
    rm -f "$tmp"
    exit 0
  fi
  echo "DIVERGENCE: supabase/schema.sql ne correspond plus au résultat des migrations."
  echo "Corrections à examiner (schema.sql -> attendu) :"
  diff -u "$TARGET" "$tmp" | head -60 | sed 's/^/  /'
  echo
  echo "Cause la plus fréquente : une migration a été ajoutée ou modifiée sans"
  echo "régénérer l'instantané. La seule correction légitime est de lancer :"
  echo "  scripts/db-schema.sh dump"
  echo "Ne modifiez pas les migrations pour faire disparaître la divergence."
  rm -f "$tmp"
  exit 1
}

# Inventaire du schéma applicatif, trié. Deux instantanés produits par des
# chemins différents doivent donner exactement la même sortie.
inventory() {
  # `-i` obligatoire : sans lui le heredoc n'atteint pas psql et l'inventaire
  # sortirait vide — donc « identique » à n'importe quoi, y compris à rien.
  docker exec -i "$PG_CONTAINER" psql -X -U postgres -d postgres -At -F'|' <<'SQL'
select 'table',      table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'
union all
select 'view',       table_name from information_schema.views  where table_schema = 'public'
union all
select 'function',   p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
union all
select 'policy',     c.relname || '.' || p.polname
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
union all
select 'trigger',    c.relname || '.' || t.tgname
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
union all
select 'constraint', c.relname || '.' || con.conname
  from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public'
order by 1, 2;
SQL
}

reset_public() {
  # `-i` est indispensable : sans lui `docker exec` ne transmet pas le
  # heredoc, psql ne reçoit rien, et le schéma n'est jamais vidé.
  # La sortie et les NOTICE de `drop ... cascade` sont supprimés : ils ne
  # signalent pas une erreur ici, ils seraient bruyants.
  docker exec -i "$PG_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres <<'SQL' >/dev/null 2>&1
drop schema if exists public cascade;
create schema public;
grant all on schema public to postgres, anon, authenticated, service_role;
alter schema public owner to postgres;
alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
SQL
}

command_replay() {
  # Un projet Supabase possède déjà les schémas de la plateforme (`auth`,
  # `extensions`) : l'instantané s'y applique sans eux. Le rejeu se fait donc
  # dans la MÊME base, dont le seul écart est un `public` vide et vierge de
  # privilèges — c'est exactement la situation d'un projet neuf.
  bash "$ROOT/scripts/db-replay.sh" --quiet >/dev/null 2>&1 || {
    echo "ERREUR: les migrations ne s'appliquent pas." >&2; exit 1;
  }
  inventory > /tmp/taggo_schema_from_migrations.txt
  reset_public
  if ! docker exec -i "$PG_CONTAINER" psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres -f - < "$TARGET" >/tmp/taggo_schema_replay.log 2>&1; then
    echo "ECHEC: supabase/schema.sql n'est pas rejouable."
    grep -i 'error' /tmp/taggo_schema_replay.log | head -5 | sed 's/^/  /'
    exit 1
  fi
  inventory > /tmp/taggo_schema_from_file.txt
  if diff -u /tmp/taggo_schema_from_migrations.txt /tmp/taggo_schema_from_file.txt >/dev/null; then
    echo "OK: schema.sql rejoué produit exactement le même schéma que les migrations ($(grep -c '' /tmp/taggo_schema_from_file.txt) objets)."
    # La base est laissée dans l'état des migrations, pour que la suite de tests
    # puisse s'enchaîner sans rien reconstruire.
    bash "$ROOT/scripts/db-replay.sh" --quiet >/dev/null 2>&1
    exit 0
  fi
  echo "ECHEC: le schéma rejoué depuis schema.sql diffère des migrations."
  diff -u /tmp/taggo_schema_from_migrations.txt /tmp/taggo_schema_from_file.txt | head -40 | sed 's/^/  /'
  exit 1
}

case "${1:-check}" in
  dump) command_dump ;;
  check) command_check ;;
  replay) command_replay ;;
  *)
    echo "usage: $0 {dump|check|replay}" >&2
    exit 2
    ;;
esac