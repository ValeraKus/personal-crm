#!/usr/bin/env bash
# Recreates the staging database from the latest prod backup: drops it, creates it empty, loads the
# backup and applies the migrations of the staging version (it may be newer than prod).
# Run by hand on the server when staging needs fresh data or its data went wrong:
#   sudo -iu deploy; cd /srv/personal-crm-staging; ./refresh-staging.sh
# For the freshest data make a prod backup first: cd /srv/personal-crm; ./backup.sh
# It never rolls back by itself: on failure it stops and reports.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh
use_environment staging

lock_environment
version=$(release_image compose.override.yaml)
[ -n "$version" ] || fail "staging has no release yet: deploy it first (merge to main)"

# Names start with a timestamp, so reverse alphabetical order is newest first
file=$(ls -1 "$PROD_DIR/$BACKUP_DIR"/db-*.sql.gz 2> /dev/null | sort -r | head -n 1) || true
[ -n "$file" ] || fail "no prod backups in $PROD_DIR/$BACKUP_DIR: make one there with ./backup.sh"
gzip -t "$file" || fail "$file is not a valid .gz file"

compose up -d --wait --quiet-pull db
db=$(db_name)

printf '\nThis will REPLACE the staging database "%s" with the latest prod backup:\n  %s\n' "$db" "$file"
printf 'Everything in the staging database now is lost. Prod is not touched.\n'
printf 'Type "yes" to continue: '
read -r answer
[ "$answer" = yes ] || fail "cancelled: nothing was changed"

log "Stopping the staging app"
compose stop app

log "Recreating the database $db"
recreate_database "$db" "$file" || fail "could not load the backup, the staging app stays stopped"

log "Applying migrations of version ${version##*:}"
compose run --rm -T migrate || fail "migrations failed on the prod data, the staging app stays stopped"

log "Starting the app"
if ! compose up -d --wait --wait-timeout 120 app; then
  fail "the app is not healthy; logs: ./compose.sh staging logs app"
fi
if ! smoke_check "${version##*:}"; then
  fail "smoke check failed; logs: ./compose.sh staging logs app"
fi

log "Staging database $db recreated from $file; the app runs version ${version##*:}"
