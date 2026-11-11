#!/bin/bash
# Runs the 1000-requests / 50-slots race in three modes and verifies double-bookings in SQL.
# Needs: Postgres on :5432, backend jar built, k6. Paths below assume ClinicQ/.tools (see docs).
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; T="$ROOT/.tools"
export PATH="$T/pg/bin:$PATH"; K6="$T/k6"
PSQL="psql -h localhost -U postgres -v ON_ERROR_STOP=1 -q"
for MODE in naive index-only locked; do
  echo "################ $MODE"
  pkill -f clinicq-api-0.1.0.jar; sleep 2
  $PSQL -c "drop database if exists clinicq_load with (force)" -c "create database clinicq_load owner clinicq" >/dev/null
  BM=locked; [ "$MODE" != locked ] && BM=naive
  (cd "$ROOT/backend" && exec env DB_URL=jdbc:postgresql://localhost:5432/clinicq_load BCRYPT_STRENGTH=4 BOOKING_MODE=$BM \
     java -jar target/clinicq-api-0.1.0.jar > "$ROOT/loadtest/results/app-$MODE.txt" 2>&1) &
  PID=$!
  for i in $(seq 1 60); do curl -s localhost:8080/actuator/health | grep -q UP && break; sleep 1; done
  [ "$MODE" = naive ] && $PSQL -d clinicq_load -c "drop index ux_appointments_one_active_per_slot"
  $PSQL -d clinicq_load -f "$ROOT/loadtest/seed.sql"
  $K6 run --quiet --summary-export "$ROOT/loadtest/results/k6-$MODE.json" "$ROOT/loadtest/booking.js" 2>&1 | grep -E "booked_201|rejected_409|other_status|http_req_duration|iteration_duration" 
  echo "--- verify ($MODE) ---"
  $PSQL -d clinicq_load -At -c "select 'active appointments: ' || count(*) from appointments where status in ('BOOKED','COMPLETED')" \
        -c "select 'double-booked slots:  ' || count(*) from (select slot_id from appointments where status in ('BOOKED','COMPLETED') group by slot_id having count(*)>1) t" \
        -c "select 'extra bookings:       ' || coalesce(sum(n-1),0) from (select count(*) n from appointments where status in ('BOOKED','COMPLETED') group by slot_id having count(*)>1) t"
  pkill -f clinicq-api-0.1.0.jar; wait $PID 2>/dev/null
done
