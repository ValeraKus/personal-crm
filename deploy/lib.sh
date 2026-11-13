# Shared settings and helpers of the deploy scripts.
# Every script first calls use_environment with staging or prod: the two environments run the same
# scripts and the same compose.yaml and differ only in the settings below and in their own .env.

PROD_DIR=/srv/personal-crm
STAGING_DIR=/srv/personal-crm-staging
# Backups are made on prod only, in $PROD_DIR/backups; staging is recreated from the latest of them
BACKUP_DIR=backups
BACKUPS_TO_KEEP=14
# How long a deploy, a rollback or a restore waits for another one of the same environment
LOCK_WAIT_SECONDS=900

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*"
}

fail() {
  log "FAILED: $*" >&2
  exit 1
}

# Picks the environment: its directory, domain, port of the app and sender of the emails.
# The directory of the scripts must be the directory of that environment, so a copy of the scripts
# never works on the other environment. The variables exported here are used by compose.yaml.
use_environment() {
  ENVIRONMENT=$1
  case $ENVIRONMENT in
    prod)
      APP_DIR=$PROD_DIR
      APP_DOMAIN=app.context-crm.site
      APP_PORT=3000
      MAIL_FROM="Личная CRM <noreply@mail.crm.context-crm.site>"
      ;;
    staging)
      APP_DIR=$STAGING_DIR
      APP_DOMAIN=test-app.context-crm.site
      APP_PORT=3001
      MAIL_FROM="Личная CRM (тест) <noreply@mail.crm.context-crm.site>"
      ;;
    *)
      fail "unknown environment \"$ENVIRONMENT\": use staging or prod"
      ;;
  esac
  [ "$PWD" = "$APP_DIR" ] \
    || fail "these scripts are in $PWD, but the $ENVIRONMENT environment lives in $APP_DIR"
  COMPOSE_PROJECT=$ENVIRONMENT
  export APP_DOMAIN APP_PORT MAIL_FROM
}

# One change of an environment at a time: a deploy, a rollback, a restore or a refresh of the staging
# database waits until the running one finishes. The lock is released when the script exits.
lock_environment() {
  exec 9> .lock
  if ! flock --nonblock 9; then
    log "Another deploy, rollback or restore of $ENVIRONMENT is running: waiting for it to finish"
    flock --wait "$LOCK_WAIT_SECONDS" 9 \
      || fail "$ENVIRONMENT is still busy after $LOCK_WAIT_SECONDS seconds: nothing was changed"
  fi
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

# Images that one of the environments runs, can roll back to or is deploying right now
images_in_use() {
  local dir file
  for dir in "$PROD_DIR" "$STAGING_DIR"; do
    for file in compose.override.yaml previous-release.yaml next-release.yaml; do
      release_image "$dir/$file"
    done
  done
}

# Smoke check through nginx and HTTPS: /health must answer 200 with the expected version.
# The request comes from the server itself, so the password of the staging site does not apply.
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

# Replaces the whole database with a backup: drops it, creates it empty and loads the file.
# The app must be stopped first. Returns non-zero if any step fails.
recreate_database() {
  local db=$1 file=$2
  db_psql -d postgres -c "DROP DATABASE IF EXISTS \"$db\" WITH (FORCE)" \
    && db_psql -d postgres -c "CREATE DATABASE \"$db\"" \
    && gzip -dc "$file" | db_psql -d "$db" --single-transaction -q > /dev/null
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
