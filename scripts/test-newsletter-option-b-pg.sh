#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../contact-api"
version=${1:?Use 16 or 18}
case "$version" in 16|18) ;; *) exit 2;; esac
container="gracz-280-pg${version}-$$"
docker_local(){ env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
trap 'docker_local rm -f "$container" >/dev/null' EXIT
docker_local run --pull=never --name "$container" -d -e POSTGRES_PASSWORD=synthetic-only -e POSTGRES_DB=gracz_test -p 127.0.0.1::5432 "postgres:$version-alpine" >/dev/null
ready=false
for ((i=0;i<60;i++)); do if docker_local exec "$container" pg_isready -h 127.0.0.1 -U postgres -d gracz_test >/dev/null; then ready=true; break; fi; sleep .5; done
[[ "$ready" == true ]] || { echo "Disposable PostgreSQL startup failed" >&2; exit 1; }
port=$(docker_local port "$container" 5432/tcp);port=${port##*:}
env -i PATH="$PATH" NODE_ENV=test DATABASE_URL="postgres://postgres:synthetic-only@127.0.0.1:$port/gracz_test" node --test --test-timeout=180000 --test-concurrency=1 integration/*.test.mjs > "/tmp/280-pg$version.log" 2>&1
tail -12 "/tmp/280-pg$version.log"
