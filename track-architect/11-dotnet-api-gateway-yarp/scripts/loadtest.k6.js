// k6 load/abuse sketch (NOT run in CI). Usage:
//   TOKEN=$(curl -s -XPOST http://127.0.0.1:8080/dev/token -H 'content-type: application/json' -d '{"user":"alice"}' | jq -r .access_token)
//   k6 run -e BASE=http://127.0.0.1:8080 -e TOKEN=$TOKEN scripts/loadtest.k6.js
// Expect a mix of 200 (within the token bucket) and 429 (over it) and, for the "attacker" scenario, 401 then 403 (ban).
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE || 'http://127.0.0.1:8080';
const TOKEN = __ENV.TOKEN || '';

export const options = {
  scenarios: {
    steady_client: { executor: 'constant-arrival-rate', rate: 40, timeUnit: '1s', duration: '30s', preAllocatedVUs: 20, exec: 'client' },
    attacker: { executor: 'per-vu-iterations', vus: 1, iterations: 30, exec: 'attacker', startTime: '5s' },
  },
};

export function client() {
  const res = http.get(`${BASE}/api/v1/campaigns`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  check(res, { 'ok or limited': (r) => r.status === 200 || r.status === 429 });
}

export function attacker() {
  const res = http.get(`${BASE}/api/v1/campaigns`, { headers: { Authorization: 'Bearer forged.token.value' } });
  check(res, { 'rejected': (r) => r.status === 401 || r.status === 403 });
}
