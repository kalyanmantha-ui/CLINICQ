#!/bin/bash
# Runs every test layer against a fresh database. Usage: scripts/test-all.sh [--load]
#   1 unit tests  2 API integration (booking, waitlist, privacy, admin, reminders x2 instances)  3 browser e2e  [4 load test]
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; T="$ROOT/.tools"
export PATH="$T/apache-maven-3.9.9/bin:$T/pg/bin:/opt/homebrew/bin:$PATH"
OUT="$ROOT/.runner/out"; mkdir -p "$OUT"; FAIL=0
step(){ echo; echo "################ $*"; }
newdb(){ psql -h localhost -U postgres -c "drop database if exists clinicq with (force)" -c "create database clinicq owner clinicq" >/dev/null; }

step "1/3 unit tests + build"
(cd "$ROOT/backend" && mvn -B -q test && mvn -B -q -DskipTests package) || { echo "BUILD/UNIT FAILED"; exit 1; }
echo "ok"

step "2/3 API integration tests"
newdb
"$T/mailpit" > "$OUT/mailpit.txt" 2>&1 & MP=$!
cd "$ROOT/backend"
SEED_DEMO=true OFFERS_EXPIRY_SECONDS=4 OFFERS_SWEEP_MS=1000 REMINDERS_SWEEP_MS=2000 java -jar target/clinicq-api-0.1.0.jar > "$OUT/it-app1.txt" 2>&1 & A1=$!
for i in $(seq 1 60); do curl -s localhost:8080/actuator/health | grep -q UP && break; sleep 1; done
SERVER_PORT=8081 OFFERS_SWEEP_MS=1000 REMINDERS_SWEEP_MS=2000 java -jar target/clinicq-api-0.1.0.jar > "$OUT/it-app2.txt" 2>&1 & A2=$!
for i in $(seq 1 60); do curl -s localhost:8081/actuator/health | grep -q UP && break; sleep 1; done
DBC="psql -h localhost -U clinicq -d clinicq -At"
mk(){ $DBC -c "insert into slots(doctor_id,start_at,end_at) select id, now()+interval '$1', now()+interval '$1'+interval '30 minutes' from users where email='doctor@clinicq.demo' returning id" | head -1; }
for t in reminders smoke waitlist privacy admin; do
  # reminder slots are created right before that test: other tests book "the earliest open slot" and would otherwise take them
  [ $t = reminders ] && export S24=$(mk '23 hours') S2=$(mk '90 minutes') SFAR=$(mk '30 hours') S2B=$(mk '80 minutes')
  echo "--- $t"; node smoke/$t.mjs | grep -E "FAIL|PASSED|FAILED" ; [ ${PIPESTATUS[0]} -eq 0 ] || FAIL=1
done
echo "--- log leak scan (expect 0)"; grep -ciE "415-555|1990-04|penicillin|follow up in|@rem\.dev|@priv\.dev|@t\.dev|Passw0rd|Demo#2026" "$OUT"/it-app1.txt "$OUT"/it-app2.txt
kill $A1 $A2 $MP 2>/dev/null; wait 2>/dev/null
cd "$ROOT"

step "3/3 browser end-to-end (Playwright)"
bash scripts/e2e.sh | grep -E "✓|✘|passed|failed" ; [ ${PIPESTATUS[0]} -eq 0 ] || FAIL=1

if [ "$1" = "--load" ]; then step "load test: 1000 simultaneous bookings on 50 slots"; bash loadtest/run-loadtest.sh | grep -E "####|booked_201|double-booked|extra bookings"; fi
echo; [ $FAIL -eq 0 ] && echo "ALL TEST LAYERS PASSED" || echo "SOMETHING FAILED"
exit $FAIL
