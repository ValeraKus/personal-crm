#!/usr/bin/env bash
# One-time server setup for deploys, run as root: setup-server.sh "<public SSH key of GitHub Actions>"
# The server is shared with the landing, so it only adds our own things:
# the deploy user, /srv/personal-crm and the nginx site of the app. Safe to run again.
set -euo pipefail
cd "$(dirname "$0")"

deploy_key=${1:?usage: setup-server.sh \"<public SSH key of GitHub Actions>\"}
app_dir=/srv/personal-crm
site=app.context-crm.site.conf

# deploy: the user GitHub Actions logs in as. Runs docker, has no sudo.
id deploy > /dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy

# restrict: the key can run commands, but gets no terminal and no port forwarding
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
keys=/home/deploy/.ssh/authorized_keys
touch "$keys"
grep -qxF "restrict $deploy_key" "$keys" || echo "restrict $deploy_key" >> "$keys"
chown deploy:deploy "$keys"
chmod 600 "$keys"

install -d -o deploy -g deploy -m 750 "$app_dir"

# nginx: the app domain proxies to the app container instead of the placeholder
target=/etc/nginx/sites-available/$site
if ! cmp -s "nginx/$site" "$target"; then
  backup=""
  if [ -f "$target" ]; then
    backup=$target.bak-$(date +%Y%m%d-%H%M%S)
    cp "$target" "$backup"
  fi
  install -m 644 "nginx/$site" "$target"
  ln -sf "../sites-available/$site" "/etc/nginx/sites-enabled/$site"
  if ! nginx -t; then
    [ -n "$backup" ] && cp "$backup" "$target"
    echo "nginx config test failed: the previous config is restored" >&2
    exit 1
  fi
  systemctl reload nginx
  echo "nginx: $site installed${backup:+, the previous version saved to $backup}"
fi

echo "Server is ready for deploys"
