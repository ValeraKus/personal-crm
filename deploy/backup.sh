#!/usr/bin/env bash
# Backs up the production database: backups/db-<time>-<version before the deploy>.sql.gz.
# deploy.sh runs it before migrations; it can also be run by hand on the server.
# Keeps the newest 14 backups, older ones are deleted. before-restore-* copies are never deleted.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

log "Backing up the database (running version: $(current_version))"
file=$(make_backup db) || fail "could not back up the database"
log "Backup saved: $file ($(du -h "$file" | cut -f1))"

# Names start with a timestamp, so reverse alphabetical order is newest first
old=$(ls -1 "$BACKUP_DIR"/db-*.sql.gz | sort -r | tail -n +"$((BACKUPS_TO_KEEP + 1))")
if [ -n "$old" ]; then
  printf '%s\n' "$old" | while read -r f; do
    rm -f "$f" && log "Removed old backup $f"
  done
fi
