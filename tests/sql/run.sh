#!/usr/bin/env bash
# Tests the SQL migrations against a LOCAL throwaway PostgreSQL (never Supabase).
# Usage: tests/sql/run.sh "host=/path/to/socket port=54329 user=postgres"
set -euo pipefail
CONN="${1:?connection string of a local test server, e.g. \"host=/tmp port=54329 user=postgres\"}"
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$DIR/../.."
DB="dalis_migration_test_$$"
export PGOPTIONS="-c client_min_messages=warning"

psql "$CONN dbname=postgres" -qc "create database $DB" >/dev/null
trap 'psql "$CONN dbname=postgres" -qc "drop database if exists $DB" >/dev/null' EXIT
run() { psql "$CONN dbname=$DB" -q -v ON_ERROR_STOP=1 "$@"; }

run -f "$DIR/supabase-shim.sql" >/dev/null
# The repository's existing multi-user migration (adds user_id + policies)
run -f "$ROOT/supabase_migration.sql" >/dev/null
run -f "$ROOT/migrations/add_priority_columns.sql" >/dev/null
# New migration, twice: it must be idempotent
run -f "$ROOT/migrations/2026-10-16_step_entries.sql" >/dev/null
run -f "$ROOT/migrations/2026-10-16_step_entries.sql" >/dev/null
run -f "$DIR/step_entries.test.sql"
# Read-only health check must run without errors
run -f "$ROOT/migrations/2026-10-16_health_check.sql" >/dev/null && echo "health_check.sql: runs without errors"
