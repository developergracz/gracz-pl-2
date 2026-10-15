#!/bin/sh
# Syntax validation only. No install, package hooks, migration or business import.
set -eu
artifact_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec env -u NODE_OPTIONS -u NODE_PATH node --check "$artifact_dir/server.mjs"
