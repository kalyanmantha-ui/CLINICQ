#!/bin/bash
# Full-stack browser test: fresh DB -> API (demo data) -> Vite dev server -> Playwright.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; T="$ROOT/.tools"
export PATH="$T/apache-maven-3.9.9/bin:$T/pg/bin:/opt/homebrew/bin:$PATH"
(cd "$ROOT/backend" && mvn -q -B -DskipTests package) || exit 1   # never test a stale jar
psql -h localhost -U postgres -c "drop database if exists clinicq with (force)" -c "create database clinicq owner clinicq" >/dev/null
(cd "$ROOT/backend" && SEED_DEMO=true exec java -jar target/clinicq-api-0.1.0.jar > "$ROOT/.runner/out/e2e-api.txt" 2>&1) & API=$!
for i in $(seq 1 60); do curl -s localhost:8080/actuator/health | grep -q UP && break; sleep 1; done
(cd "$ROOT/frontend" && exec npm run dev -- --host localhost > "$ROOT/.runner/out/e2e-web.txt" 2>&1) & WEB=$!
for i in $(seq 1 30); do curl -s localhost:5173 >/dev/null && break; sleep 1; done
(cd "$ROOT/frontend" && npx playwright test)
RC=$?
kill $API $WEB 2>/dev/null; wait 2>/dev/null
exit $RC
