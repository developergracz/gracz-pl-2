#!/bin/sh
# Production business runtime build. No migrations, hooks, data writes or real email.
set -eu
unset NODE_OPTIONS NODE_PATH
npm --prefix contact-api install --omit=dev --ignore-scripts --no-audit --no-fund --package-lock=false
node --check contact-api/server.mjs
node --check contact-api/newsletter.mjs
node --check contact-api/routes/newsletter-route.mjs
node --check contact-api/persistence/newsletter-opt-in-store.mjs
