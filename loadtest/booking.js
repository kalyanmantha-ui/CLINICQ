// k6: N patients each fire ONE booking at a random one of the open slots, all at the same moment.
import http from 'k6/http';
import { Counter } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://localhost:8080';
const N = parseInt(__ENV.N || '1000');
const JSON_H = { 'Content-Type': 'application/json' };

export const options = {
  scenarios: { race: { executor: 'per-vu-iterations', vus: N, iterations: 1, maxDuration: '120s' } },
  setupTimeout: '300s',
};
const booked = new Counter('booked_201');
const taken = new Counter('rejected_409');
const other = new Counter('other_status');

export function setup() {
  const tokens = [];
  for (let start = 0; start < N; start += 100) {
    const reqs = [];
    for (let i = start; i < Math.min(start + 100, N); i++) {
      reqs.push(['POST', `${BASE}/api/auth/login`,
        JSON.stringify({ email: `p${String(i).padStart(4, '0')}@load.test`, password: 'Load#Test1' }), { headers: JSON_H }]);
    }
    for (const r of http.batch(reqs)) tokens.push(r.status === 200 ? r.json('token') : null);
  }
  const slots = http.get(`${BASE}/api/slots`, { headers: { Authorization: `Bearer ${tokens[0]}` } }).json().map((s) => s.id);
  return { tokens, slots };
}

export default function (data) {
  const token = data.tokens[__VU - 1];
  const slot = data.slots[Math.floor(Math.random() * data.slots.length)];
  const r = http.post(`${BASE}/api/appointments`, JSON.stringify({ slotId: slot }), {
    headers: { ...JSON_H, Authorization: `Bearer ${token}`, 'Idempotency-Key': `${__VU}-${Date.now()}` },
  });
  if (r.status === 201) booked.add(1); else if (r.status === 409) taken.add(1); else other.add(1);
}
