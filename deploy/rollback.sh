#!/usr/bin/env bash
# Manual rollback to the previous release; its image is kept on the server.
# Run on the server: sudo -u deploy /srv/personal-crm/rollback.sh
# Migrations are not reverted: the previous version runs on the current database.
# Running it once more returns to the release that was rolled back.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

current=$(release_image compose.override.yaml)
previous=$(release_image previous-release.yaml)
[ -n "$previous" ] || fail "there is no previous release to roll back to"
docker image inspect "$previous" > /dev/null 2>&1 || fail "image $previous is not on the server"

log "Rolling back: $current -> $previous"
mv compose.override.yaml rollback-swap.yaml
mv previous-release.yaml compose.override.yaml
mv rollback-swap.yaml previous-release.yaml

if ! compose up -d --wait --wait-timeout 120 app; then
  fail "the app is not healthy; logs: docker compose -p $COMPOSE_PROJECT logs app"
fi

if ! smoke_check "${previous##*:}"; then
  fail "smoke check failed; logs: docker compose -p $COMPOSE_PROJECT logs app"
fi

log "Rolled back to $previous"
