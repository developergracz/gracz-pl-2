#!/bin/sh
# Default standalone maintenance responder is fully isolated from business code.
set -eu
artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "${GRACZ_BUSINESS_RUNTIME_ENABLED:-0}" = "1" ]; then
  : "${NEWSLETTER_INTAKE_PAUSED:=true}"
  export NEWSLETTER_INTAKE_PAUSED
  exec env -u NODE_OPTIONS -u NODE_PATH node "$artifact_dir/../server.mjs"
fi
exec env -u NODE_OPTIONS -u NODE_PATH node "$artifact_dir/server.mjs"
