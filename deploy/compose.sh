#!/usr/bin/env bash
# docker compose of one environment, for commands by hand on the server:
#   ./compose.sh <staging|prod> <docker compose arguments>
# For example: ./compose.sh prod ps, ./compose.sh staging logs --tail 100 app
# Plain docker compose does not work here: compose.yaml needs the settings of the environment.
set -euo pipefail
cd "$(dirname "$0")"
source ./lib.sh

use_environment "${1:?usage: compose.sh <staging|prod> <docker compose arguments>}"
shift
compose "$@"
