# Booking race: 1,000 simultaneous requests on 50 slots

Run on a MacBook Pro (Apple Silicon): Spring Boot API, Postgres 16 and k6 all on one machine.
Each of 1,000 patients sends one `POST /api/appointments` at the same moment, each at a random one of 50 open slots.
Double-bookings are counted by SQL afterwards (`appointments` grouped by slot), not from API responses.

| Version | Lock | Unique index | 201 Created | Double-booked slots | Extra bookings |
|---|---|---|---|---|---|
| v1 naive (check, then insert) | no | no | 54 to 58 | **4 to 6** | **4 to 8** |
| Index only | no | yes | 50 | 0 | 0 |
| Row lock + index (shipped) | `SELECT ... FOR UPDATE` | yes | 50 | **0** | **0** |

The naive version is not deterministic, so the range is over three separate runs
(56/5/6, 58/6/8 and 54/4/4 for bookings / double-booked slots / extra bookings).
The index-only and locked versions were 0 double-bookings in every run.

- With the index alone, losers get a database error mapped to 409; with the lock they get a clean "slot taken" 409 without hitting the constraint.
- p95 latency in the earlier run: naive 386 ms, index only 378 ms, locked 558 ms (the lock serialises bookers of the same slot).
- Caveats: client and server share one machine; Hikari pool is the default 10 connections.

Reproduce: `loadtest/run-loadtest.sh`
