/**
 * Rate-limit verification. Must be run against an API started with the DEFAULT
 * limits (no THROTTLE_* overrides).
 *
 *   node scripts/rate-limit-check.mjs
 */
const BASE = process.env.API_BASE || 'http://localhost:3001';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

async function attemptLogin() {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ratelimit@example.com', password: 'N0t!ARealPassphrase' }),
  });
  return res;
}

const configured = Number(process.env.THROTTLE_LOGIN_LIMIT ?? 10);
if (configured > 50) {
  console.log(
    `THROTTLE_LOGIN_LIMIT=${configured} is relaxed; restart the API with default limits to run this check.`,
  );
  process.exit(2);
}

let firstLimited = null;
let limitedResponse = null;

for (let i = 1; i <= configured + 10; i++) {
  const res = await attemptLogin();
  if (res.status === 429 && firstLimited === null) {
    firstLimited = i;
    limitedResponse = res;
    break;
  }
}

check('the login endpoint eventually rate-limits', firstLimited !== null, `on attempt ${firstLimited}`);

if (limitedResponse) {
  const body = await limitedResponse.json().catch(() => null);
  check('429 status is returned', limitedResponse.status === 429, `status=${limitedResponse.status}`);
  check(
    'the 429 body explains the limit',
    /throttl|too many|rate/i.test(JSON.stringify(body)),
    JSON.stringify(body).slice(0, 100),
  );
  const retryAfter =
    limitedResponse.headers.get('retry-after') ?? limitedResponse.headers.get('x-ratelimit-reset');
  check('a retry hint is provided', retryAfter !== null, `retry-after=${retryAfter}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} rate-limit checks passed`);
if (failed.length) process.exitCode = 1;
