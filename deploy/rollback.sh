#!/usr/bin/env bash
# Manual rollback of prod to the previous release; its image is kept on the server.
# Run with "Deploy prod" and the rollback box ticked, or on the server:
#   sudo -u deploy /srv/personal-crm/rollback.sh
# Migrations are not reverted: the previous version runs on the current database. No backup is made:
# a rollback does not change data. Running it once more returns to the release that was rolled back.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh
use_environment prod
lock_environment

current=$(release_image compose.override.yaml)
previous=$(release_image previous-release.yaml)
[ -n "$previous" ] || fail "there is no previous release to roll back to"
# Old images are removed only after prod deploys and never the previous release of prod, so the image
# is on the server. If it is gone anyway, it is pulled again: the package is public, no login needed.
if ! docker image inspect "$previous" > /dev/null 2>&1; then
  log "Image $previous is not on the server: pulling it"
  docker pull --quiet "$previous" > /dev/null || fail "could not pull $previous: nothing was changed"
fi

log "Rolling back: $current -> $previous"
mv compose.override.yaml rollback-swap.yaml
mv previous-release.yaml compose.override.yaml
mv rollback-swap.yaml previous-release.yaml

if ! compose up -d --wait --wait-timeout 120 app; then
  fail "the app is not healthy; logs: ./compose.sh prod logs app"
fi

if ! smoke_check "${previous##*:}"; then
  fail "smoke check failed; logs: ./compose.sh prod logs app"
fi

log "Rolled back to $previous"
