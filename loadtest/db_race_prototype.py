"""
DB-level prototype of the booking race (NOT the Spring service, and NOT the final README number).
Fires N concurrent booking attempts at S slots and counts double-bookings, in three modes:
  naive   - check-then-insert, no row lock, unique index dropped
  index   - check-then-insert, no row lock, partial unique index in place
  locked  - SELECT ... FOR UPDATE on the slot row + partial unique index
Usage: python db_race_prototype.py [N=1000] [SLOTS=50] [WORKERS=100]
Env: PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
"""
import os, sys, uuid, random, time
from concurrent.futures import ThreadPoolExecutor
import psycopg2

N = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
SLOTS = int(sys.argv[2]) if len(sys.argv) > 2 else 50
WORKERS = int(sys.argv[3]) if len(sys.argv) > 3 else 100
DSN = dict(host=os.getenv("PGHOST", "localhost"), port=int(os.getenv("PGPORT", 5432)),
           user=os.getenv("PGUSER", "clinicq"), password=os.getenv("PGPASSWORD", "clinicq"),
           dbname=os.getenv("PGDATABASE", "clinicq"))
IDX = "ux_appointments_one_active_per_slot"
IDX_SQL = f"CREATE UNIQUE INDEX {IDX} ON appointments (slot_id) WHERE status IN ('BOOKED','COMPLETED')"

def conn():
    c = psycopg2.connect(**DSN); c.autocommit = False; return c

def seed():
    c = conn(); cur = c.cursor()
    cur.execute("TRUNCATE appointments, slots, doctors, patients, users CASCADE")
    doc = str(uuid.uuid4())
    cur.execute("INSERT INTO users(id,email,password_hash,full_name,role) VALUES (%s,'doc@x','x','Doc','DOCTOR')", (doc,))
    cur.execute("INSERT INTO doctors(user_id,specialty) VALUES (%s,'GP')", (doc,))
    slots = []
    for i in range(SLOTS):
        sid = str(uuid.uuid4()); slots.append(sid)
        cur.execute("INSERT INTO slots(id,doctor_id,start_at,end_at) VALUES (%s,%s, now()+%s*interval '30 minutes', now()+%s*interval '30 minutes'+interval '30 minutes')", (sid, doc, i+1, i+1))
    pats = []
    for i in range(N):
        pid = str(uuid.uuid4()); pats.append(pid)
        cur.execute("INSERT INTO users(id,email,password_hash,full_name,role) VALUES (%s,%s,'x','P','PATIENT')", (pid, f"p{i}@x"))
        cur.execute("INSERT INTO patients(user_id) VALUES (%s)", (pid,))
    c.commit(); c.close(); return slots, pats

def attempt(mode, slot, pat):
    c = conn(); cur = c.cursor()
    try:
        if mode == "locked":
            cur.execute("SELECT status FROM slots WHERE id=%s FOR UPDATE", (slot,))
        cur.execute("SELECT count(*) FROM appointments WHERE slot_id=%s AND status IN ('BOOKED','COMPLETED')", (slot,))
        if cur.fetchone()[0] > 0:
            c.rollback(); return "taken"
        time.sleep(0.005)  # widen the race window like real app logic between check and insert
        cur.execute("INSERT INTO appointments(slot_id,patient_id,status) VALUES (%s,%s,'BOOKED')", (slot, pat))
        c.commit(); return "booked"
    except psycopg2.errors.UniqueViolation:
        c.rollback(); return "rejected_by_index"
    except Exception as e:
        c.rollback(); return "error:" + type(e).__name__
    finally:
        c.close()

def run(mode):
    c = conn(); cur = c.cursor()
    cur.execute(f"DROP INDEX IF EXISTS {IDX}")
    cur.execute("TRUNCATE appointments CASCADE")
    if mode != "naive": cur.execute(IDX_SQL)
    c.commit(); c.close()
    slots, pats = seed()
    jobs = [(mode, random.choice(slots), p) for p in pats]
    t0 = time.time()
    with ThreadPoolExecutor(WORKERS) as ex:
        results = list(ex.map(lambda j: attempt(*j), jobs))
    dt = time.time() - t0
    c = conn(); cur = c.cursor()
    cur.execute("SELECT count(*) FROM (SELECT slot_id FROM appointments WHERE status IN ('BOOKED','COMPLETED') GROUP BY slot_id HAVING count(*)>1) t")
    dbl_slots = cur.fetchone()[0]
    cur.execute("SELECT coalesce(sum(n-1),0) FROM (SELECT count(*) n FROM appointments WHERE status IN ('BOOKED','COMPLETED') GROUP BY slot_id HAVING count(*)>1) t")
    extra = int(cur.fetchone()[0]); c.close()
    tally = {}
    for r in results: tally[r] = tally.get(r, 0) + 1
    print(f"{mode:7s} | requests={N} slots={SLOTS} | double-booked slots={dbl_slots} extra bookings={extra} | {dt:.1f}s | {tally}")

if __name__ == "__main__":
    for m in ("naive", "index", "locked"): run(m)
    c = conn(); cur = c.cursor(); cur.execute(f"DROP INDEX IF EXISTS {IDX}"); cur.execute(IDX_SQL); c.commit(); c.close()
