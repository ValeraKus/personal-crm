#!/usr/bin/env bash
# Removes old app images from GHCR and keeps the newest builds. Runs on GitHub Actions after a
# successful prod deploy (deploy-prod.yml), not on the server:
#   prune-registry.sh <owner> <package> <builds to keep>
# Needs GH_TOKEN that may delete versions of the package (the repository has the Admin role in
# "Manage Actions access" of the package settings) and docker logged in to ghcr.io.
#
# One build is several versions in GHCR: the tagged image index and the untagged manifests it lists
# (the image itself and its build attestation). The newest tagged builds and everything they list are
# kept. Every other version is deleted: older builds with their parts and leftover untagged parts.
# Untagged versions younger than an hour are kept: they may belong to a build being pushed right now.
set -euo pipefail

usage="usage: prune-registry.sh <owner> <package> <builds to keep>"
owner=${1:?$usage}
package=${2:?$usage}
builds_to_keep=${3:?$usage}
api=/users/$owner/packages/container/$package/versions
image=ghcr.io/$(tr '[:upper:]' '[:lower:]' <<< "$owner")/$package
settings=https://github.com/users/$owner/packages/container/$package/settings

# One line per version, newest first: id, digest, creation time, tags separated by commas
versions=$(gh api --paginate "$api?per_page=100" \
  --jq '.[] | [.id, .name, .created_at, (.metadata.container.tags | join(","))] | @tsv' \
  | sort -t $'\t' -k3,3r)

kept_builds=$(awk -F '\t' -v n="$builds_to_keep" '$4 != "" && kept < n { print; kept++ }' <<< "$versions")
if [ -z "$kept_builds" ]; then
  echo "No tagged builds in $image: nothing is deleted"
  exit 0
fi

# Digests to keep: the kept builds and the manifests each of them lists
keep=""
while IFS=$'\t' read -r _ digest _ tags; do
  keep+=$digest$'\n'
  keep+=$(docker buildx imagetools inspect --raw "$image@$digest" | jq -r '.manifests[]?.digest')$'\n'
  echo "Keeping $image:${tags%%,*}"
done <<< "$kept_builds"

young=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)
deleted=0
while IFS=$'\t' read -r id digest created tags; do
  if grep -qxF "$digest" <<< "$keep"; then
    continue
  fi
  if [ -z "$tags" ] && [[ $created > $young ]]; then
    echo "Skipping untagged $digest: created less than an hour ago"
    continue
  fi
  if ! gh api --method DELETE "$api/$id" > /dev/null; then
    echo "::error::Could not delete a version of $image. Give the repository the Admin role: $settings -> Manage Actions access"
    exit 1
  fi
  if [ -n "$tags" ]; then
    echo "Deleted $image:${tags%%,*}"
  else
    echo "Deleted untagged $digest"
  fi
  deleted=$((deleted + 1))
done <<< "$versions"

echo "Kept the newest $(grep -c . <<< "$kept_builds") builds, deleted $deleted versions"
