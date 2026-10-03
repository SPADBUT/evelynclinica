#!/usr/bin/env bash
# Run canonical A1 migrations + RLS security tests against local PostgreSQL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_NAME="${A1_TEST_DB:-evelyn_a1_test}"

echo "Preparing database: ${DB_NAME}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null 2>&1 || true
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME};"

echo "Running validation..."
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${ROOT}/supabase/scripts/run_a1_validation.sql"

echo "OK — A1 schema + RLS security tests passed."
