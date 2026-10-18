#!/bin/sh
# Restart the real contact/newsletter API, not the maintenance-only 503 responder.
# New newsletter intake stays fail-closed until the F03 database and provider
# have been verified and an operator explicitly configures otherwise.
set -eu
unset NODE_OPTIONS NODE_PATH
: "${NEWSLETTER_INTAKE_PAUSED:=true}"
export NEWSLETTER_INTAKE_PAUSED
exec node contact-api/server.mjs
