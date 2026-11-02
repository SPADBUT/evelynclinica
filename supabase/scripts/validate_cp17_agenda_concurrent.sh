#!/bin/bash
# Two local sessions. The second insert must wait, then fail with 23P01.
# Does not connect to hosted Supabase.
set -euo pipefail

DB="${CP17_DB:-cp17_agenda}"
LOG_DIR="${CP17_LOG_DIR:-/tmp/cp17-concurrent}"
mkdir -p "$LOG_DIR"

run_sql() {
  sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -q -c "$1"
}

sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL' >"$LOG_DIR/session-a.log" 2>&1 &
begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;
select public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Sessao concorrente A',
  null,
  timestamptz '2026-10-20 10:00:00-03',
  timestamptz '2026-10-20 11:00:00-03',
  null
);
select pg_sleep(4);
commit;
SQL
pid_a=$!

sleep 1

set +e
sudo -u postgres psql -d "$DB" -v ON_ERROR_STOP=1 -q <<'SQL' >"$LOG_DIR/session-b.log" 2>&1
begin;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', false);
set role authenticated;
select public.create_appointment(
  '11111111-1111-4111-8111-111111111111',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  null,
  'Sessao concorrente B',
  null,
  timestamptz '2026-10-20 10:30:00-03',
  timestamptz '2026-10-20 11:30:00-03',
  null
);
commit;
SQL
status_b=$?
set -e

wait "$pid_a"

if [[ "$status_b" -eq 0 ]]; then
  echo "concurrent overlap unexpectedly committed" >&2
  exit 1
fi

if ! grep -E -q 'appointments_professional_overlap|23P01|exclusion constraint' "$LOG_DIR/session-b.log"; then
  echo "session B failed without an exclusion conflict" >&2
  cat "$LOG_DIR/session-b.log" >&2
  exit 1
fi

if grep -E -q 'Paciente|OPERATIONAL-NOTE|nota remarcada' "$LOG_DIR/session-b.log"; then
  echo "conflict error exposed patient or note text" >&2
  exit 1
fi

kept="$(sudo -u postgres psql -d "$DB" -At -c "select count(*) from public.appointments where title = 'Sessao concorrente A'")"
if [[ "$kept" != "1" ]]; then
  echo "expected one committed concurrent appointment, got ${kept}" >&2
  exit 1
fi

echo "cp17 concurrent overlap passed"
