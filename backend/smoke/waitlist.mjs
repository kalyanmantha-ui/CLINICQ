// Waitlist / offer scenario test. Needs the API on :8080 started with SEED_DEMO=true OFFERS_EXPIRY_SECONDS=4 OFFERS_SWEEP_MS=1000
const BASE = process.env.BASE || 'http://localhost:8080';
let fails = 0;
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!cond) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, path, { token, body } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const tag = Date.now();
const patient = async (n) => (await call('POST', '/api/auth/register', { body: { email: `${n}${tag}@t.dev`, password: 'Passw0rd!x', fullName: `Test ${n}` } })).json.token;
const login = async (e) => (await call('POST', '/api/auth/login', { body: { email: e, password: 'Demo#2026!' } })).json.token;

const [A, B, C, D, E] = await Promise.all(['a', 'b', 'c', 'd', 'e'].map(patient));
const admin = await login('admin@clinicq.demo'), recep = await login('reception@clinicq.demo');
const doc = (await call('GET', '/api/doctors', { token: A })).json[0].id;
const openIds = async () => (await call('GET', `/api/slots?doctorId=${doc}`, { token: A })).json.map((s) => s.id);
const slots = await openIds();
const S = slots[0], S2 = slots[1];

console.log('--- scenario 1: cancel -> offered in queue order; decline passes it on; unanswered offer expires ---');
ok('A books S', (await call('POST', '/api/appointments', { token: A, body: { slotId: S } })).status === 201);
const bw = await call('POST', '/api/waitlist', { token: B, body: { doctorId: doc, preferredWindow: 'ANY' } });
await sleep(50);
const cw = await call('POST', '/api/waitlist', { token: C, body: { doctorId: doc } });
ok('B and C join the waitlist (B first)', bw.status === 201 && cw.status === 201);
ok('B cannot join the same doctor twice -> 409', (await call('POST', '/api/waitlist', { token: B, body: { doctorId: doc } })).status === 409);
ok('doctor cannot join waitlist -> 403', (await call('POST', '/api/waitlist', { token: await login('doctor@clinicq.demo'), body: { doctorId: doc } })).status === 403);

const apptA = (await call('GET', '/api/appointments/mine', { token: A })).json.find((a) => a.status === 'BOOKED');
ok('A cancels -> 204', (await call('DELETE', `/api/appointments/${apptA.id}`, { token: A })).status === 204);
const offB = (await call('GET', '/api/offers/mine', { token: B })).json;
ok('B (first in queue) is offered S', offB.length === 1 && offB[0].slotId === S);
ok('C is not offered yet', (await call('GET', '/api/offers/mine', { token: C })).json.length === 0);
ok('S is hidden from open slots while offered', !(await openIds()).includes(S));
ok('C cannot grab the offered slot directly -> 409', (await call('POST', '/api/appointments', { token: C, body: { slotId: S } })).status === 409);
ok("C cannot accept B's offer -> 404", (await call('POST', `/api/offers/${offB[0].id}/accept`, { token: C })).status === 404);

ok('B declines -> 204', (await call('POST', `/api/offers/${offB[0].id}/decline`, { token: B })).status === 204);
const offC = (await call('GET', '/api/offers/mine', { token: C })).json;
ok('C is now offered S', offC.length === 1 && offC[0].slotId === S);
ok('B is not re-offered the slot they declined', (await call('GET', '/api/offers/mine', { token: B })).json.length === 0);

console.log('...waiting for C\'s offer to expire (4s + sweep)');
await sleep(6500);
ok("C's unanswered offer expired", (await call('GET', '/api/offers/mine', { token: C })).json.length === 0);
ok('nobody eligible left -> S is open again', (await openIds()).includes(S));
const lateAccept = await call('POST', `/api/offers/${offC[0].id}/accept`, { token: C });
ok('accepting after expiry -> 409', lateAccept.status === 409, JSON.stringify(lateAccept.json));
ok('C stays on the waitlist as WAITING', (await call('GET', '/api/waitlist/mine', { token: C })).json[0].status === 'WAITING');

console.log('--- scenario 2: 10 simultaneous accepts of one offer ---');
// B and C are still WAITING from scenario 1 (and joined before E), so they must leave or the queue would correctly serve them first
for (const tok of [B, C]) {
  const entry = (await call('GET', '/api/waitlist/mine', { token: tok })).json[0];
  ok('a waiting patient can leave the waitlist -> 204', (await call('DELETE', `/api/waitlist/${entry.id}`, { token: tok })).status === 204);
}
ok('D books S2', (await call('POST', '/api/appointments', { token: D, body: { slotId: S2 } })).status === 201);
ok('E joins the waitlist', (await call('POST', '/api/waitlist', { token: E, body: { doctorId: doc } })).status === 201);
const apptD = (await call('GET', '/api/appointments/mine', { token: D })).json.find((a) => a.status === 'BOOKED');
await call('DELETE', `/api/appointments/${apptD.id}`, { token: D });
const offE = (await call('GET', '/api/offers/mine', { token: E })).json;
ok('E is offered S2', offE.length === 1 && offE[0].slotId === S2);
const results = await Promise.all(Array.from({ length: 10 }, () => call('POST', `/api/offers/${offE[0].id}/accept`, { token: E })));
const created = results.filter((r) => r.status === 201).length, conflicts = results.filter((r) => r.status === 409).length;
ok('exactly one accept wins; the rest get 409', created === 1 && conflicts === 9, `(201: ${created}, 409: ${conflicts})`);
const mineE = (await call('GET', '/api/appointments/mine', { token: E })).json.filter((a) => a.status === 'BOOKED');
ok('E has exactly one booked appointment', mineE.length === 1 && mineE[0].slotId === S2);
ok('S2 is not open', !(await openIds()).includes(S2));

console.log('--- staff + audit ---');
ok('patient cannot see the reception queue -> 403', (await call('GET', '/api/reception/waitlist', { token: A })).status === 403);
ok('receptionist sees the queue -> 200', (await call('GET', '/api/reception/waitlist', { token: recep })).status === 200);
const audit = (await call('GET', '/api/admin/audit?limit=200', { token: admin })).json.map((a) => a.action);
for (const act of ['OFFER_SLOT', 'DECLINE_OFFER', 'EXPIRE_OFFER', 'ACCEPT_OFFER', 'VIEW_WAITLIST']) ok(`audit has ${act}`, audit.includes(act));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
