#!/usr/bin/env bash
# Restores the production database from a backup file. Run by hand on the server:
#   sudo -iu deploy; cd /srv/personal-crm; ./restore.sh backups/<file>.sql.gz
# Replaces the whole database: drops it, creates it empty, loads the backup.
# The app version does not change. It never rolls back by itself: on failure it stops and reports.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

usage="usage: restore.sh <backup file>"
file=${1:?$usage}
[ -f "$file" ] || fail "file $file not found"
gzip -t "$file" || fail "$file is not a valid .gz file"

version=$(release_image compose.override.yaml)
[ -n "$version" ] || fail "no release is deployed yet: nothing to restore into"
compose up -d --wait --quiet-pull db
db=$(db_name)

printf '\nThis will REPLACE the database "%s" on this server with the backup:\n  %s\n' "$db" "$file"
printf 'The app stays on version %s. A copy of the current database is made first.\n' "${version##*:}"
printf 'Type "yes" to continue: '
read -r answer
[ "$answer" = yes ] || fail "cancelled: nothing was changed"

copy=$(make_backup before-restore) || fail "could not copy the current database: nothing was changed"
log "Copy of the current database: $copy"

log "Stopping the app"
compose stop app

log "Recreating the database $db"
if ! { db_psql -d postgres -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE)" \
  && db_psql -d postgres -c "CREATE DATABASE \"$db\"" \
  && gzip -dc "$file" | db_psql -d "$db" --single-transaction -q > /dev/null; }; then
  fail "restore failed, the app stays stopped. The copy of the previous database: $copy"
fi

log "Starting the app"
if ! compose up -d --wait --wait-timeout 120 app; then
  fail "the app is not healthy; logs: docker compose -p $COMPOSE_PROJECT logs app"
fi
if ! smoke_check "${version##*:}"; then
  fail "smoke check failed; logs: docker compose -p $COMPOSE_PROJECT logs app"
fi

log "Restored $db from $file; the app runs version ${version##*:}"
