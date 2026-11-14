#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Activates an already-uploaded frontend release on THIS server (EC2 primary or
# Hostinger standby). Same script on both, so they cannot drift.
#
#   activate-release.sh <release_ts> <git_commit>
#
# Expects the built SPA in /opt/cred2tech/webapp/releases/<release_ts>/ (index.html,
# assets/, version.json). Steps: validate, remember the previous release, atomically
# swap the `current` symlink, smoke-test through the local nginx (and check it serves
# THIS commit), roll the symlink back on any failure, prune old releases.
#
# Safe by design: if the nginx vhost for the app host does not exist yet, the smoke
# test fails and the previous release (or none) stays live. Nothing goes live blind.
#
# Env: SMOKE_HOST (default app.cred2tech.com), KEEP_RELEASES (default 5).
# Output ends with `ACTIVE_COMMIT=<sha>` so the pipeline can prove both servers match.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

RELEASE_TS="${1:?release_ts required}"
GIT_COMMIT="${2:?git_commit required}"

BASE="${WEBAPP_BASE:-/opt/cred2tech/webapp}"   # override only for tests
RELEASE_DIR="${BASE}/releases/${RELEASE_TS}"
SMOKE_HOST="${SMOKE_HOST:-app.cred2tech.com}"
KEEP="${KEEP_RELEASES:-5}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

[ -d "$RELEASE_DIR" ] || { log "FATAL: $RELEASE_DIR missing, did the upload step run?"; exit 1; }
[ -f "$RELEASE_DIR/index.html" ] || { log "FATAL: index.html missing in release"; exit 1; }
[ -d "$RELEASE_DIR/assets" ] || { log "FATAL: assets/ missing in release"; exit 1; }
[ -f "$RELEASE_DIR/version.json" ] || { log "FATAL: version.json missing in release"; exit 1; }
grep -q "\"commit\":\"${GIT_COMMIT}\"" "$RELEASE_DIR/version.json" \
  || { log "FATAL: version.json does not carry commit ${GIT_COMMIT}"; exit 1; }

PREV=""
if [ -L "${BASE}/current" ] && [ -e "${BASE}/current" ]; then
  PREV="$(readlink -f "${BASE}/current")"
fi

# Atomic swap: build the new link next to the old one, then rename over it.
ln -sfn "$RELEASE_DIR" "${BASE}/current.new"
mv -Tf "${BASE}/current.new" "${BASE}/current"
log "Switched current -> ${RELEASE_DIR} (previous: ${PREV:-none})"

rollback() {
  log "Smoke test FAILED, rolling back"
  if [ -n "$PREV" ]; then
    ln -sfn "$PREV" "${BASE}/current.new"
    mv -Tf "${BASE}/current.new" "${BASE}/current"
    log "Rolled back to ${PREV}"
  else
    rm -f "${BASE}/current"
    log "No previous release; current removed"
  fi
}

# Smoke test through the real nginx on this box. --resolve pins the host for both TCP
# and TLS SNI (nginx picks the vhost and cert from SNI, not from the Host header).
SERVED=""
for i in 1 2 3 4 5; do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve "${SMOKE_HOST}:443:127.0.0.1" "https://${SMOKE_HOST}/" || true)"
  SERVED="$(curl -s --max-time 10 --resolve "${SMOKE_HOST}:443:127.0.0.1" "https://${SMOKE_HOST}/version.json" || true)"
  if [ "$CODE" = "200" ] && echo "$SERVED" | grep -q "\"commit\":\"${GIT_COMMIT}\""; then
    break
  fi
  log "Smoke attempt ${i}: HTTP ${CODE}, version.json='${SERVED}'"
  sleep 3
  CODE="fail"
done
if [ "$CODE" != "200" ]; then
  rollback
  exit 1
fi
log "Smoke test OK: HTTP 200 and serving commit ${GIT_COMMIT}"

# Prune old releases, never the active one or the one we could roll back to.
cd "${BASE}/releases"
ACTIVE="$(basename "$RELEASE_DIR")"
PREV_NAME="$( [ -n "$PREV" ] && basename "$PREV" || true )"
ls -1t | tail -n +$((KEEP + 1)) | while read -r old; do
  [ "$old" = "$ACTIVE" ] && continue
  [ "$old" = "$PREV_NAME" ] && continue
  rm -rf -- "$old" || log "WARN: could not remove old release $old"
done
log "Retained the newest ${KEEP} releases."

echo "ACTIVE_COMMIT=${GIT_COMMIT}"
