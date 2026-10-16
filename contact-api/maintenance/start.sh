#!/bin/sh
# Direct process replacement: no npm prestart/start or inherited Node preload.
set -eu
artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec env -u NODE_OPTIONS -u NODE_PATH node "$artifact_dir/server.mjs"
