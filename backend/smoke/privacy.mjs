// Privacy + doctor/reception views. Needs the API on :8080 with SEED_DEMO=true.
const BASE = 'http://localhost:8080';
let fails = 0;
const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n} ${x}`); if (!c) fails++; };
const call = async (method, path, { token, body } = {}) => {
  const r = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
};
const login = async (e) => (await call('POST', '/api/auth/login', { body: { email: e, password: 'Demo#2026!' } })).json.token;
const tag = Date.now();
const reg = async (n) => (await call('POST', '/api/auth/register', { body: { email: `${n}${tag}@priv.dev`, password: 'Passw0rd!x', fullName: `Priv ${n}` } })).json.token;
const [pat, other] = await Promise.all([reg('x'), reg('y')]);
const doctor = await login('doctor@clinicq.demo'), admin = await login('admin@clinicq.demo'), recep = await login('reception@clinicq.demo');

const PHONE = '415-555-0142', DOB = '1990-04-12', NOTES = 'Allergic to penicillin', VISIT = 'Follow up in 2 weeks';
ok('patient saves profile -> 204', (await call('PUT', '/api/patients/me', { token: pat, body: { phone: PHONE, dob: DOB, notes: NOTES } })).status === 204);
const mine = (await call('GET', '/api/patients/me', { token: pat })).json;
ok('patient reads own profile back in plaintext', mine.phone === PHONE && mine.dob === DOB && mine.notes === NOTES);
ok("other patient sees only their own (empty) profile", (await call('GET', '/api/patients/me', { token: other })).json.phone === null);

const docId = (await call('GET', '/api/doctors', { token: pat })).json[0].id;
const slot = (await call('GET', `/api/slots?doctorId=${docId}`, { token: pat })).json[0];
const appt = (await call('POST', '/api/appointments', { token: pat, body: { slotId: slot.id } })).json;
const date = new Date(slot.startAt).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

const sched = (await call('GET', `/api/doctor/schedule?date=${date}`, { token: doctor })).json;
ok("doctor's schedule shows the booking", sched.some((a) => a.appointmentId === appt.id));
const rec = await call('GET', `/api/doctor/appointments/${appt.id}/record`, { token: doctor });
ok("doctor can read the patient's decrypted record", rec.status === 200 && rec.json.phone === PHONE && rec.json.patientNotes === NOTES);
ok('doctor saves visit notes -> 204', (await call('PUT', `/api/doctor/appointments/${appt.id}/notes`, { token: doctor, body: { visitNotes: VISIT } })).status === 204);
ok('visit notes read back', (await call('GET', `/api/doctor/appointments/${appt.id}/record`, { token: doctor })).json.visitNotes === VISIT);

for (const [who, t] of [['patient', pat], ['admin', admin], ['receptionist', recep]]) {
  ok(`${who} cannot open a patient record -> 403`, (await call('GET', `/api/doctor/appointments/${appt.id}/record`, { token: t })).status === 403);
}
const rs = await call('GET', `/api/reception/schedule?date=${date}`, { token: recep });
ok('receptionist sees the day with patient + doctor names', rs.status === 200 && rs.json.some((a) => a.appointmentId === appt.id && a.patientName === 'Priv x'));
ok('reception view exposes no phone / dob / notes', !/415-555|1990|penicillin|Follow up/.test(JSON.stringify(rs.json)));
ok('patient cannot see the reception schedule -> 403', (await call('GET', '/api/reception/schedule', { token: pat })).status === 403);

ok('doctor completes the visit -> 204', (await call('POST', `/api/doctor/appointments/${appt.id}/complete`, { token: doctor })).status === 204);
ok('completing twice -> 404', (await call('POST', `/api/doctor/appointments/${appt.id}/complete`, { token: doctor })).status === 404);
ok('a completed visit still holds its slot (no rebooking)', (await call('POST', '/api/appointments', { token: other, body: { slotId: slot.id } })).status === 409);

const audit = (await call('GET', '/api/admin/audit?limit=200', { token: admin })).json;
for (const a of ['UPDATE_PROFILE', 'VIEW_PATIENT_RECORD', 'UPDATE_VISIT_NOTES', 'COMPLETE_APPOINTMENT', 'VIEW_SCHEDULE']) ok(`audit has ${a}`, audit.some((x) => x.action === a));
ok('audit never contains profile data', !/415-555|1990|penicillin|Follow up|@priv\.dev/.test(JSON.stringify(audit)));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
