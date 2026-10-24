#!/usr/bin/env bash
# Deploys a tagged release on the VPS. GitHub Actions pipes this file over SSH, so the
# version that runs is always the one from the tag being deployed:
#
#     ssh user@host 'bash -s' -- v1.2.3 < deploy/deploy.sh
#
# Steps: update the code to the tag -> install packages -> build the frontend -> restart both
# services -> check they answer. If anything fails, the previous version is restored.
#
# NOT automated (do these by hand when a release needs them): database column changes
# (new tables are created automatically), edits to the VPS .env files, and Nginx changes.

# Non-interactive SSH sessions don't load ~/.bashrc, so load Node (installed via nvm) ourselves.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null
fi

set -Eeuo pipefail

TAG="${1:?Usage: deploy.sh <tag>}"
[[ "$TAG" =~ ^v[0-9A-Za-z._-]+$ ]] || { echo "Refusing odd tag name: $TAG"; exit 1; }

REPO=/var/www/kcyatra-live/repo
BACKEND_SERVICE=kcy-live-backend
FRONTEND_SERVICE=kcy-live-frontend

log() { printf '\n==> %s\n' "$*"; }

# One deploy at a time.
exec 9>/var/lock/kcy-deploy.lock
flock -n 9 || { echo "Another deploy is already running."; exit 1; }

wait_for() {
  local url="$1" name="$2"
  for _ in $(seq 1 30); do
    if curl -fsS -o /dev/null "$url"; then
      echo "$name is up"
      return 0
    fi
    sleep 1
  done
  echo "$name did not come up"
  return 1
}

# Every step ends with "|| return 1": set -e is switched off inside an `if`, so failures must be explicit.
build_and_restart() {
  log "Backend: installing packages"
  (cd "$REPO/Backend" && .venv/bin/pip install --quiet -r requirements.txt) || return 1

  log "Frontend: installing packages and building (the old site keeps running meanwhile)"
  (cd "$REPO/Frontend" && bun install --frozen-lockfile && npm run build) || return 1

  log "Restarting the backend"
  systemctl restart "$BACKEND_SERVICE" || return 1
  wait_for http://127.0.0.1:8100/openapi.json "backend" || return 1

  log "Restarting the frontend"
  systemctl restart "$FRONTEND_SERVICE" || return 1
  wait_for http://127.0.0.1:3100/ "frontend" || return 1
}

cd "$REPO"
PREVIOUS="$(git rev-parse HEAD)"

log "Fetching $TAG"
git fetch --tags --force origin
git rev-parse -q --verify "refs/tags/$TAG^{commit}" >/dev/null || { echo "Tag $TAG was not found on GitHub."; exit 1; }

log "Updating the code (fast-forward only, so nothing on the server is overwritten)"
git checkout main
git merge --ff-only "refs/tags/$TAG"

if ! build_and_restart; then
  echo
  echo "!! Deploy of $TAG failed — restoring the previous version ($PREVIOUS)"
  git reset --hard "$PREVIOUS"
  build_and_restart || echo "!! The restore ALSO failed — check the services by hand: journalctl -u $BACKEND_SERVICE -n 50"
  exit 1
fi

log "Deployed $TAG ($(git rev-parse --short HEAD))"
