#!/usr/bin/env bash
# Local synthetic PostgreSQL 18 only. No external Docker context or inherited DB URL.
set -euo pipefail
cd "$(dirname "$0")/../contact-api"
command -v node >/dev/null
[[ -d node_modules/pg ]] || { echo 'Install contact-api dependencies first.' >&2; exit 1; }
fixture_id="gracz-r51-$(date +%s)-$$"
source_container="$fixture_id-source"
restore_container="$fixture_id-restore"
artifacts=$(mktemp -d /tmp/gracz-pg18-dr.XXXXXX)
docker_local() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock "$@"; }
cleanup() { docker_local rm -f "$source_container" "$restore_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
for container in "$source_container" "$restore_container"; do
  docker_local run --pull=never --name "$container" -d -e POSTGRES_PASSWORD=local-fixture-only -e POSTGRES_DB=gracz_test -p 127.0.0.1::5432 postgres:18-alpine >/dev/null
  ready=false
  for ((attempt=0;attempt<60;attempt++)); do
    if docker_local exec "$container" pg_isready -U postgres -d gracz_test >/dev/null; then ready=true;break;fi
    sleep 0.5
  done
  [[ "$ready" == true ]] || { echo 'Fixture startup failed' >&2;exit 1; }
done
source_port=$(docker_local port "$source_container" 5432/tcp);source_port=${source_port##*:}
restore_port=$(docker_local port "$restore_container" 5432/tcp);restore_port=${restore_port##*:}
source_url="postgres://postgres:local-fixture-only@127.0.0.1:$source_port/gracz_test"
restore_url="postgres://postgres:local-fixture-only@127.0.0.1:$restore_port/gracz_test"
node_flags=()
node --help > "$artifacts/node-help.txt"
if grep -q -- '--test-isolation' "$artifacts/node-help.txt"; then node_flags+=(--test-isolation=none);fi
run_node() { env -i PATH="$PATH" NODE_ENV=test DATABASE_URL="$source_url" node "$@"; }
run_node --test "${node_flags[@]}" --test-reporter=tap --test-concurrency=1 integration/*.test.mjs | tee "$artifacts/integration.tap"
run_node integration/newsletter-dr-fixture.mjs seed
# Both dump and restore use container-local sockets, never a production URL.
docker_local exec "$source_container" pg_dump -U postgres -d gracz_test --no-owner --no-privileges > "$artifacts/fixture.sql"
docker_local exec -i "$restore_container" psql -X -U postgres -d gracz_test -v ON_ERROR_STOP=1 < "$artifacts/fixture.sql" > "$artifacts/restore.log"
run_node integration/newsletter-dr-fixture.mjs verify "$restore_url" | tee "$artifacts/dr.log"
echo "Local PostgreSQL18/DR evidence: $artifacts"
