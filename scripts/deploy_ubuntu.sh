#!/usr/bin/env bash
set -euo pipefail
: "${DEPLOY_ENV_FILE:?DEPLOY_ENV_FILE is required}"
bootstrap=false
if [[ "${1:-}" == --bootstrap ]]; then bootstrap=true;
elif [[ $# -gt 0 ]]; then printf 'Usage: deploy_ubuntu.sh [--bootstrap]\n' >&2; exit 1; fi
root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
[[ -r "$DEPLOY_ENV_FILE" ]] || { printf 'Deployment settings are missing.\n' >&2; exit 1; }
exec 9>"$HOME/.digitalsquare-deploy.lock"
flock --exclusive --timeout 1800 9
if [[ "${GITHUB_ACTIONS:-}" == true ]]; then
  for file in "$DEPLOY_ENV_FILE" /home/dsadmin/platform/supabase/.env; do
    [[ -r "$file" ]] || continue
    while IFS='=' read -r key value; do
      case "$key" in
        *PASSWORD*|*SECRET*|*TOKEN*|*SERVICE_ROLE*|ERP_DATABASE_URL)
          value="${value#\'}"; value="${value%\'}"
          [[ -z "$value" ]] || printf '::add-mask::%s\n' "$value"
          ;;
      esac
    done < "$file"
  done
fi
compose=(docker compose --project-name dtappsquare-erp --env-file "$DEPLOY_ENV_FILE" --file "$root/compose.yml")
"${compose[@]}" --profile tools config --quiet
COMPOSE_PARALLEL_LIMIT=1 "${compose[@]}" --profile tools build
"${compose[@]}" --profile tools run --rm -T --no-deps tools sh -ec './node_modules/.bin/supabase db push --db-url "$ERP_DATABASE_URL" --skip-vault --yes'
if "$bootstrap"; then
  "${compose[@]}" --profile tools run --rm -T --no-deps tools node scripts/bootstrap-server.mjs
fi
"${compose[@]}" up -d --no-build --wait --wait-timeout 180
"${compose[@]}" up -d --no-build --no-deps --force-recreate --wait frontend
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 3 http://127.0.0.1:3200/api/health >/dev/null
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 3 http://127.0.0.1:3200/login >/dev/null
printf '%s\n' "${GITHUB_SHA:-manual}" > "$DEPLOY_ENV_FILE.deployed-sha"
printf 'ERP deployment verified.\n'
