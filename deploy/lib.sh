# Shared settings and helpers of deploy.sh and rollback.sh

APP_DOMAIN=app.context-crm.site
COMPOSE_PROJECT=prod

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  log "FAILED: $*" >&2
  exit 1
}

compose() {
  docker compose -p "$COMPOSE_PROJECT" "$@"
}

# Image of a release file written by write_release; empty if there is no such file
release_image() {
  if [ -f "$1" ]; then
    sed -n 's/^ *image: *//p' "$1" | head -n 1
  fi
}

# A release file is a compose override that pins the app image
write_release() {
  local file=$1 image=$2
  cat > "$file" <<EOF
# Written by deploy.sh and rollback.sh: the app image of this release
services:
  app:
    image: $image
  migrate:
    image: $image
EOF
}

# Smoke check through nginx and HTTPS: /health must answer 200 with the expected version
smoke_check() {
  local expected_version=$1 body=""
  for _ in $(seq 1 30); do
    if body=$(curl -fsS --max-time 5 --resolve "$APP_DOMAIN:443:127.0.0.1" "https://$APP_DOMAIN/health" 2>&1) \
      && [[ $body == *"\"version\":\"$expected_version\""* ]]; then
      log "Smoke check passed: https://$APP_DOMAIN/health -> $body"
      return 0
    fi
    sleep 2
  done
  log "Smoke check failed: https://$APP_DOMAIN/health -> ${body:-no answer}"
  return 1
}
