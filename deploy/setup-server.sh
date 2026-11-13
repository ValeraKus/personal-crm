#!/usr/bin/env bash
# One-time server setup for deploys, run as root from a copy of deploy/:
#   setup-server.sh ["<public SSH key of GitHub Actions>"]
# The server is shared with the landing, so it only adds our own things: the deploy user, the
# directories of prod and staging, the nginx sites of the app and of staging, and the certificate
# of staging. Safe to run again: what is already in place stays as it is.
set -euo pipefail
cd "$(dirname "$0")"

deploy_key=${1:-}
prod_dir=/srv/personal-crm
staging_dir=/srv/personal-crm-staging
staging_domain=test-app.context-crm.site
staging_htpasswd=/etc/nginx/$staging_domain.htpasswd

fail() {
  echo "FAILED: $*" >&2
  exit 1
}

# deploy: the user GitHub Actions logs in as. Runs docker, has no sudo.
id deploy > /dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy

# restrict: the key can run commands, but gets no terminal and no port forwarding
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
keys=/home/deploy/.ssh/authorized_keys
touch "$keys"
if [ -n "$deploy_key" ]; then
  grep -qxF "restrict $deploy_key" "$keys" || echo "restrict $deploy_key" >> "$keys"
fi
chown deploy:deploy "$keys"
chmod 600 "$keys"
[ -s "$keys" ] || fail "deploy has no SSH key yet: run again with the public key of GitHub Actions"

install -d -o deploy -g deploy -m 750 "$prod_dir" "$staging_dir"
echo "Directories ready: $prod_dir (prod), $staging_dir (staging)"

# Installs an nginx site from a file and reloads nginx. If the config test fails, the previous
# version of the site comes back and nothing is reloaded.
install_site() {
  local source=$1 site=$2 target backup=""
  target=/etc/nginx/sites-available/$site
  if cmp -s "$source" "$target"; then
    return 0
  fi
  if [ -f "$target" ]; then
    backup=$target.bak-$(date +%Y%m%d-%H%M%S)
    cp "$target" "$backup"
  fi
  install -m 644 "$source" "$target"
  ln -sf "../sites-available/$site" "/etc/nginx/sites-enabled/$site"
  if ! nginx -t; then
    if [ -n "$backup" ]; then
      cp "$backup" "$target"
    else
      rm -f "$target" "/etc/nginx/sites-enabled/$site"
    fi
    fail "nginx config test failed for $site: the previous config is restored"
  fi
  systemctl reload nginx
  echo "nginx: $site installed${backup:+, the previous version saved to $backup}"
}

# Prod: the app domain proxies to the prod app container
install_site nginx/app.context-crm.site.conf app.context-crm.site.conf

# Staging is closed with a password. The owner makes the file with it by hand (README): the agent
# never sees the password.
[ -s "$staging_htpasswd" ] \
  || fail "$staging_htpasswd is missing: create it first (README, \"Тест-стенд\"), then run again"
# nginx workers read it, nobody else
chown root:www-data "$staging_htpasswd"
chmod 640 "$staging_htpasswd"

# Staging has its own certificate. Let's Encrypt checks the domain over HTTP first, so until the
# certificate exists the site answers only on port 80 for that check.
if [ ! -d "/etc/letsencrypt/live/$staging_domain" ]; then
  bootstrap=$(mktemp)
  cat > "$bootstrap" <<EOF
# Temporary, written by setup-server.sh: only the Let's Encrypt check, until the certificate exists
server {
    listen 80;
    listen [::]:80;
    server_name $staging_domain;
    include snippets/context-crm-acme.conf;
    location / {
        return 404;
    }
}
EOF
  install_site "$bootstrap" "$staging_domain.conf"
  rm -f "$bootstrap"
  certbot certonly --webroot --webroot-path /var/www/letsencrypt \
    --domain "$staging_domain" --cert-name "$staging_domain" --key-type ecdsa \
    --deploy-hook "systemctl reload nginx" --non-interactive --agree-tos
fi

install_site "nginx/$staging_domain.conf" "$staging_domain.conf"

echo "Server is ready for deploys"
