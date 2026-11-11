// Reminder test. Env: S24 (slot ~23h away), S2 (~90min), SFAR (~30h), S2B (~80min). Needs Mailpit on :8025 and TWO API instances sweeping.
const BASE = 'http://localhost:8080', MP = 'http://localhost:8025';
let fails = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, path, { token, body } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const tag = Date.now();
const reg = async (n) => { const e = `${n}${tag}@rem.dev`; const r = await call('POST', '/api/auth/register', { body: { email: e, password: 'Passw0rd!x', fullName: `Rem ${n}` } }); return { email: e, token: r.json.token }; };
const [P1, P2, P3] = await Promise.all(['p1', 'p2', 'p3'].map(reg));
const book = (p, slot) => call('POST', '/api/appointments', { token: p.token, body: { slotId: slot } });
const msgs = async () => (await (await fetch(MP + '/api/v1/messages?limit=200')).json()).messages;
await fetch(MP + '/api/v1/messages', { method: 'DELETE' });

ok('P1 books the slot ~23h away', (await book(P1, process.env.S24)).status === 201);
ok('P2 books the slot ~90min away', (await book(P2, process.env.S2)).status === 201);
ok('P1 books a slot ~30h away (no reminder due yet)', (await book(P1, process.env.SFAR)).status === 201);
const b3 = await book(P3, process.env.S2B);
await call('DELETE', `/api/appointments/${b3.json.id}`, { token: P3.token });   // cancelled straight away

console.log('...two API instances are sweeping every 2s; waiting 9s');
await sleep(9000);
let m = await msgs();
const to = (p) => m.filter((x) => x.To.some((t) => t.Address === p.email));
ok('exactly 2 emails sent in total', m.length === 2, `(got ${m.length})`);
ok('P1 got one email, a 24h reminder', to(P1).length === 1 && /24 hours/.test(to(P1)[0].Subject), JSON.stringify(to(P1).map((x) => x.Subject)));
ok('P2 got one email, a 2h reminder only (no 24h one)', to(P2).length === 1 && /2 hours/.test(to(P2)[0].Subject), JSON.stringify(to(P2).map((x) => x.Subject)));
ok('P3 (cancelled) got nothing', to(P3).length === 0);
const body = (await (await fetch(`${MP}/api/v1/message/${to(P1)[0].ID}`)).json()).Text;
ok('email names the doctor and time, and nothing about other patients', /Dr\. Dana Doctor/.test(body) && !/Rem p[23]/.test(body));

console.log('...waiting 7 more seconds: more sweeps must NOT resend');
await sleep(7000);
m = await msgs();
ok('still exactly 2 emails after more sweeps on both instances', m.length === 2, `(got ${m.length})`);
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
