#!/bin/bash
# Starts Postgres, Mailpit, the API (with demo data) and the web dev server in the background.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; T="$ROOT/.tools"; OUT="$ROOT/.runner/out"
export PATH="$T/apache-maven-3.9.9/bin:$T/pg/bin:/opt/homebrew/bin:$PATH"
pg_ctl -D "$T/pgdata" status >/dev/null 2>&1 || pg_ctl -D "$T/pgdata" -o "-p 5432 -c max_connections=300" -l "$T/pg.log" -w start
psql -h localhost -U postgres -c "drop database if exists clinicq with (force)" -c "create database clinicq owner clinicq" >/dev/null
nohup "$T/mailpit" > "$OUT/dev-mailpit.txt" 2>&1 &
(cd "$ROOT/backend" && SEED_DEMO=true nohup java -jar target/clinicq-api-0.1.0.jar > "$OUT/dev-api.txt" 2>&1 &)
for i in $(seq 1 60); do curl -s localhost:8080/actuator/health | grep -q UP && break; sleep 1; done
(cd "$ROOT/frontend" && nohup npm run dev -- --host localhost > "$OUT/dev-web.txt" 2>&1 &)
for i in $(seq 1 30); do curl -s localhost:5173 >/dev/null && break; sleep 1; done
echo "api: $(curl -s localhost:8080/actuator/health)  web: $(curl -s -o /dev/null -w '%{http_code}' localhost:5173)  mail: $(curl -s -o /dev/null -w '%{http_code}' localhost:8025)"
