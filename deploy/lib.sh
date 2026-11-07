# Shared settings and helpers of deploy.sh, rollback.sh, backup.sh and restore.sh

APP_DOMAIN=app.context-crm.site
COMPOSE_PROJECT=prod
BACKUP_DIR=backups
BACKUPS_TO_KEEP=14

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

# Version (image tag) of the running release; "none" if nothing was deployed yet
current_version() {
  local image
  image=$(release_image compose.override.yaml)
  printf '%s' "${image:+${image##*:}}" | grep . || echo none
}

# Runs psql inside the db container as the database owner; extra arguments go to psql
db_psql() {
  compose exec -T db sh -c 'exec psql -U "$POSTGRES_USER" -v ON_ERROR_STOP=1 "$@"' sh "$@"
}

db_name() {
  compose exec -T db sh -c 'printf %s "$POSTGRES_DB"'
}

# Dumps the app database to $BACKUP_DIR/<prefix>-<time>-<version>.sql.gz and prints the path.
# The dump goes to a .tmp file first, so a half-written file never looks like a backup.
make_backup() {
  local prefix=$1 version file
  version=$(current_version)
  file=$BACKUP_DIR/$prefix-$(date +%Y%m%d-%H%M%S)-$version.sql.gz
  install -d -m 700 "$BACKUP_DIR"
  if ! compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$file.tmp" \
    || [ "$(gzip -dc "$file.tmp" | wc -c)" -eq 0 ]; then
    rm -f "$file.tmp"
    return 1
  fi
  chmod 600 "$file.tmp"
  mv "$file.tmp" "$file"
  printf '%s\n' "$file"
}
