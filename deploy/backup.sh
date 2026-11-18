#!/usr/bin/env bash
# Backs up the production database by hand or on schedule:
#   backup.sh           manual backup: backups/manual-<time>-<running version>.sql.gz
#   backup.sh daily     daily backup, run by the personal-crm-backup systemd timer at 03:00 Moscow time
# deploy.sh makes the backups before deploys itself (deploy-<time>-<version before the deploy>.sql.gz).
# The newest 7 backups of each kind are kept, older ones of that kind are deleted. before-restore-*
# copies are never deleted. Waits while a deploy, a rollback or a restore of prod is running.
# Prod only: staging is not backed up, it is a copy of prod.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh
use_environment prod

kind=${1:-manual}
case $kind in
  daily | manual) ;;
  *) fail "usage: backup.sh [daily]; without a parameter the backup is manual" ;;
esac

lock_environment
backup_database "$kind" || fail "could not back up the database"
