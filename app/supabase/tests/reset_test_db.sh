#!/usr/bin/env bash
# Rebuilds the local test database: Supabase shim → migrations → seed.
# Usage: PGHOST=... PGPORT=... PGSUPER=supabase_admin ./reset_test_db.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/.."
H="${PGHOST:-/home/claude/pgtest}"; P="${PGPORT:-54329}"; SU="${PGSUPER:-supabase_admin}"
DB="${PGDATABASE:-ff_test}"
psql_su() { psql -v ON_ERROR_STOP=1 -q -h "$H" -p "$P" -U "$SU" "$@"; }

psql_su -d postgres -c "drop database if exists $DB" -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='postgres') then
    create role postgres login createrole nosuperuser nobypassrls; end if; end \$\$;" \
  -c "create database $DB owner postgres"
psql_su -d "$DB" -f "$here/supabase_shim.sql" \
  -c "alter schema public owner to postgres;
      alter table auth.users owner to postgres;
      alter table storage.objects owner to postgres;
      alter table storage.buckets owner to postgres;
      grant create on schema auth, storage to postgres;"

for f in "$root"/migrations/*.sql "$root"/seed/seed.sql; do
  psql -v ON_ERROR_STOP=1 -q -h "$H" -p "$P" -U postgres -d "$DB" -f "$f" >/dev/null
done
echo "ff_test ready"
