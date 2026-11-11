// End-to-end API smoke test. Run: node smoke.mjs  (needs the API on :8080 with SEED_DEMO=true)
const BASE = process.env.BASE || 'http://localhost:8080';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!cond) fails++; };
const call = async (method, path, { token, body, headers = {} } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers }, body: body && JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const login = async (email) => (await call('POST', '/api/auth/login', { body: { email, password: 'Demo#2026!' } })).json?.token;

const admin = await login('admin@clinicq.demo'), recep = await login('reception@clinicq.demo');
const doctor = await login('doctor@clinicq.demo'), pat = await login('patient@clinicq.demo');
ok('all four demo roles can log in', admin && recep && doctor && pat);
ok('wrong password -> 401', (await call('POST', '/api/auth/login', { body: { email: 'patient@clinicq.demo', password: 'nope' } })).status === 401);
ok('no token -> 401', (await call('GET', '/api/slots')).status === 401);

ok('patient cannot list users -> 403', (await call('GET', '/api/admin/users', { token: pat })).status === 403);
ok('receptionist cannot list users -> 403', (await call('GET', '/api/admin/users', { token: recep })).status === 403);
ok('admin can list users -> 200', (await call('GET', '/api/admin/users', { token: admin })).status === 200);
ok('doctor cannot book -> 403', (await call('POST', '/api/appointments', { token: doctor, body: { slotId: '00000000-0000-0000-0000-000000000000' } })).status === 403);

const docs = (await call('GET', '/api/doctors', { token: pat })).json;
const slots = (await call('GET', `/api/slots?doctorId=${docs[0].id}`, { token: pat })).json;
ok('slots are listed', slots.length > 0, `(${slots.length})`);
const slot = slots[0].id;

const key = 'smoke-' + Date.now();
const b1 = await call('POST', '/api/appointments', { token: pat, body: { slotId: slot }, headers: { 'Idempotency-Key': key } });
ok('patient books a slot -> 201', b1.status === 201);
const b1again = await call('POST', '/api/appointments', { token: pat, body: { slotId: slot }, headers: { 'Idempotency-Key': key } });
ok('same Idempotency-Key returns the same appointment', b1again.status === 201 && b1again.json.id === b1.json.id);

const reg = await call('POST', '/api/auth/register', { body: { email: `p${Date.now()}@test.dev`, password: 'Another#Pass1', fullName: 'Second Patient' } });
ok('new patient can register -> 201', reg.status === 201);
const b2 = await call('POST', '/api/appointments', { token: reg.json.token, body: { slotId: slot } });
ok('second patient booking the same slot -> 409', b2.status === 409, JSON.stringify(b2.json));

const left = (await call('GET', `/api/slots?doctorId=${docs[0].id}`, { token: pat })).json;
ok('booked slot is no longer offered', !left.some(s => s.id === slot));

const other = await call('DELETE', `/api/appointments/${b1.json.id}`, { token: reg.json.token });
ok("another patient cannot cancel someone else's appointment -> 403", other.status === 403);
ok('owner cancels -> 204', (await call('DELETE', `/api/appointments/${b1.json.id}`, { token: pat })).status === 204);
const back = (await call('GET', `/api/slots?doctorId=${docs[0].id}`, { token: pat })).json;
ok('cancelled slot is open again', back.some(s => s.id === slot));

const audit = (await call('GET', '/api/admin/audit?limit=10', { token: admin })).json;
ok('audit log recorded book + cancel', audit.some(a => a.action === 'BOOK_APPOINTMENT') && audit.some(a => a.action === 'CANCEL_APPOINTMENT'));
ok('audit rows hold ids/labels only (no email/name)', !JSON.stringify(audit).match(/@|Patient/));
// sliding session: a valid token can be swapped for a fresh one; garbage and missing tokens cannot
const rf = await call('POST', '/api/auth/refresh', { token: pat });
ok('refresh with a valid token -> new token, same user', rf.status === 200 && rf.json?.token && rf.json.role === 'PATIENT');
ok('refreshed token works', (await call('GET', '/api/appointments/mine', { token: rf.json?.token })).status === 200);
ok('refresh without a token -> 401', (await call('POST', '/api/auth/refresh')).status === 401);
ok('refresh with a tampered token -> 401', (await call('POST', '/api/auth/refresh', { token: pat.slice(0, -3) + 'abc' })).status === 401);

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
