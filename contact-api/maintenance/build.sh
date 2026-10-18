#!/bin/sh
# By default validate only the isolated maintenance responder.
set -eu
artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "${GRACZ_BUSINESS_RUNTIME_ENABLED:-0}" = "1" ]; then
  repo_root=$(CDPATH= cd -- "$artifact_dir/../.." && pwd)
  cd "$repo_root"
  npm --prefix contact-api install --omit=dev --ignore-scripts --no-audit --no-fund --package-lock=false
  node --check contact-api/server.mjs
  node --check contact-api/newsletter.mjs
  node --check contact-api/routes/newsletter-route.mjs
  node --check contact-api/persistence/newsletter-opt-in-store.mjs
  exit 0
fi
exec env -u NODE_OPTIONS -u NODE_PATH node --check "$artifact_dir/server.mjs"
