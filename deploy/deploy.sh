#!/usr/bin/env bash
# Deploys one app image: pull -> migrations -> new app container -> smoke check of /health.
# GitHub Actions runs it over SSH: deploy.sh <image> <registry user>, with a registry token on stdin.
# It never rolls back by itself: on failure it stops and reports. Rollback is manual: rollback.sh.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

usage="usage: deploy.sh <image> <registry user>, registry token on stdin"
image=${1:?$usage}
registry_user=${2:?$usage}

[ -f .env ] || fail ".env is missing in $PWD: create it first, see README"
if [ "$(stat -c %a .env)" != 600 ]; then
  chmod 600 .env
  log "Set .env permissions to 600: only the owner can read it"
fi

log "Pulling $image"
docker_config=$(mktemp -d)
trap 'rm -rf "$docker_config"' EXIT
# Throwaway registry login: the token is valid only while the GitHub Actions job runs,
# and the config with it is deleted on exit, so docker's warning about storing it is noise
if ! login_output=$(DOCKER_CONFIG=$docker_config docker login ghcr.io --username "$registry_user" --password-stdin 2>&1); then
  printf '%s\n' "$login_output" >&2
  fail "could not log in to ghcr.io"
fi
DOCKER_CONFIG=$docker_config docker pull --quiet "$image"

# The new release becomes current only after its migrations succeed
write_release next-release.yaml "$image"

log "Starting the database"
compose -f compose.yaml -f next-release.yaml up -d --wait --quiet-pull db

log "Applying migrations"
if ! compose -f compose.yaml -f next-release.yaml run --rm -T migrate; then
  rm -f next-release.yaml
  fail "migrations failed: the app keeps running the previous version"
fi

current=$(release_image compose.override.yaml)
if [ -n "$current" ] && [ "$current" != "$image" ]; then
  cp compose.override.yaml previous-release.yaml
fi
mv next-release.yaml compose.override.yaml

log "Starting the app"
if ! compose up -d --wait --wait-timeout 120 app; then
  fail "the new app is not healthy; logs: docker compose -p $COMPOSE_PROJECT logs app"
fi

if ! smoke_check "${image##*:}"; then
  fail "smoke check failed; logs: docker compose -p $COMPOSE_PROJECT logs app"
fi

log "Removing old app images: keeping the current and the previous release"
previous=$(release_image previous-release.yaml)
docker image ls "${image%:*}" --format '{{.Repository}}:{{.Tag}}' | while read -r old; do
  if [ "$old" != "$image" ] && [ "$old" != "$previous" ]; then
    docker image rm "$old" > /dev/null && log "Removed $old" || log "Could not remove $old"
  fi
done

log "Deployed $image"
