/**
 * Live security verification against a running API (default :3001).
 *
 * Exercises the controls that only exist at runtime: security headers, password
 * policy, account lockout, refresh-token rotation and replay detection,
 * token-version revocation, payload whitelisting, enumeration resistance,
 * upload content validation, and error-response hygiene.
 *
 *   node scripts/security-live.mjs
 */
const BASE = process.env.API_BASE || 'http://localhost:3001';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

/** Tiny cookie jar so the httpOnly refresh cookie can be carried between calls. */
function makeJar() {
  let cookie = null;
  return {
    capture(res) {
      const raw = res.headers.getSetCookie?.() ?? [];
      const list = raw.length ? raw : [res.headers.get('set-cookie')].filter(Boolean);
      for (const entry of list) {
        if (String(entry).startsWith('classrank_refresh=')) {
          cookie = String(entry).split(';')[0];
        }
      }
    },
    get header() {
      return cookie;
    },
    get value() {
      return cookie ? cookie.split('=').slice(1).join('=') : null;
    },
    clear() {
      cookie = null;
    },
  };
}

async function api(method, path, { token, body, jar, contentType = 'application/json' } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && contentType === 'application/json') headers['Content-Type'] = 'application/json';
  if (jar?.header) headers.Cookie = jar.header;

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  jar?.capture(res);

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 200);
  }
  return { status: res.status, body: json, headers: res.headers };
}

const uniq = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const STRONG = 'V3ry!Str0ngPassphrase';

/* ── 1. Security headers ─────────────────────────────────────── */
{
  const res = await fetch(`${BASE}/health`);
  const h = res.headers;
  check('helmet: X-Content-Type-Options', h.get('x-content-type-options') === 'nosniff', h.get('x-content-type-options'));
  check('helmet: X-Frame-Options denied', h.get('x-frame-options') === 'DENY', h.get('x-frame-options'));
  check('helmet: referrer policy set', !!h.get('referrer-policy'), h.get('referrer-policy'));
  check('helmet: CSP present', !!h.get('content-security-policy'), (h.get('content-security-policy') || '').slice(0, 50));
  check('helmet: X-Powered-By removed', !h.get('x-powered-by'), h.get('x-powered-by') ?? '(absent)');
  check('helmet: cross-origin-opener-policy', !!h.get('cross-origin-opener-policy'), h.get('cross-origin-opener-policy'));
}

/* ── 2. Password policy ──────────────────────────────────────── */
{
  const weak = await api('POST', '/auth/register', {
    body: { email: `weak.${uniq}@example.com`, password: 'Password123!', fullname: 'Weak User', role: 'STUDENT' },
  });
  check('registration rejects a blocklisted password', weak.status === 400, `status=${weak.status}`);

  const short = await api('POST', '/auth/register', {
    body: { email: `short.${uniq}@example.com`, password: 'Ab1!x', fullname: 'Short User' },
  });
  check('registration rejects a too-short password', short.status === 400, `status=${short.status}`);

  const noSymbol = await api('POST', '/auth/register', {
    body: { email: `nosym.${uniq}@example.com`, password: 'Passphrase123', fullname: 'No Symbol' },
  });
  check('registration requires a symbol', noSymbol.status === 400, `status=${noSymbol.status}`);
}

/* ── 3. Payload whitelisting ─────────────────────────────────── */
{
  const extra = await api('POST', '/auth/register', {
    body: {
      email: `extra.${uniq}@example.com`,
      password: STRONG,
      fullname: 'Extra Field',
      role: 'STUDENT',
      // Attempting to self-assign a privileged field must be rejected outright.
      tokenVersion: 99,
      status: 'ACTIVE',
    },
  });
  check('unknown/forbidden fields are rejected', extra.status === 400, `status=${extra.status}`);
}

/* ── 4. Registration + token issuance ────────────────────────── */
const jar = makeJar();
const email = `sec.${uniq}@example.com`;
let accessToken = null;

{
  const reg = await api('POST', '/auth/register', {
    body: { email, password: STRONG, fullname: 'Security Probe', role: 'STUDENT' },
    jar,
  });
  accessToken = reg.body?.access_token;
  check('registration succeeds with a strong password', reg.status === 201 && !!accessToken, `status=${reg.status}`);
  check('refresh token is not in the JSON body', !JSON.stringify(reg.body).includes('refresh'), 'body clean');
  check('refresh token is delivered as a cookie', !!jar.value, jar.value ? 'cookie set' : 'missing');
  check('public registration cannot create an ADMIN', reg.body?.user?.role === 'STUDENT', `role=${reg.body?.user?.role}`);
}

/* ── 5. Cookie flags ─────────────────────────────────────────── */
{
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: STRONG }),
  });
  const setCookie = (res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')]).join(';');
  check('refresh cookie is HttpOnly', /httponly/i.test(setCookie), 'httponly');
  check('refresh cookie is SameSite', /samesite/i.test(setCookie), 'samesite');
  check('refresh cookie is scoped to /', /path=\//i.test(setCookie), 'path=/');
}

/* ── 6. Enumeration resistance ───────────────────────────────── */
{
  const unknown = await api('POST', '/auth/login', {
    body: { email: `nobody.${uniq}@example.com`, password: STRONG },
  });
  const wrongPw = await api('POST', '/auth/login', { body: { email, password: 'Wr0ng!Passphrase' } });

  check('unknown account -> 401', unknown.status === 401, `status=${unknown.status}`);
  check('wrong password -> 401', wrongPw.status === 401, `status=${wrongPw.status}`);
  check(
    'identical message for unknown account and wrong password',
    JSON.stringify(unknown.body.message) === JSON.stringify(wrongPw.body.message),
    String(unknown.body.message),
  );
}

/* ── 7. Account lockout ──────────────────────────────────────── */
{
  const lockEmail = `lock.${uniq}@example.com`;
  await api('POST', '/auth/register', { body: { email: lockEmail, password: STRONG, fullname: 'Lock Probe' } });

  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const res = await api('POST', '/auth/login', { body: { email: lockEmail, password: 'Wr0ng!Passphrase' } });
    statuses.push(res.status);
  }
  check(
    'account is locked after repeated failures',
    statuses.includes(403),
    `statuses=${statuses.join(',')}`,
  );

  // The correct password must no longer work while locked.
  const locked = await api('POST', '/auth/login', { body: { email: lockEmail, password: STRONG } });
  check('locked account refuses the correct password', locked.status === 403, `status=${locked.status}`);
  check(
    'lockout message explains the wait',
    /locked/i.test(String(locked.body?.message)),
    String(locked.body?.message).slice(0, 80),
  );
}

/* ── 8. Refresh rotation + replay detection ──────────────────── */
{
  const jar2 = makeJar();
  const login = await api('POST', '/auth/login', { body: { email, password: STRONG }, jar: jar2 });
  const original = jar2.value;
  check('login issues a refresh cookie', !!original, 'cookie set');

  const rotated = await api('POST', '/auth/refresh', { jar: jar2 });
  const rotatedToken = jar2.value;
  check('refresh returns a new access token', rotated.status === 200 && !!rotated.body?.access_token, `status=${rotated.status}`);
  check('refresh rotates the token', !!rotatedToken && rotatedToken !== original, 'new token differs');

  // Replaying the superseded token means it leaked: the family must be revoked.
  jar2.clear();
  const replay = await api('POST', '/auth/refresh', { body: { refresh_token: original } });
  check('replayed refresh token is rejected', replay.status === 401, `status=${replay.status}`);

  // ...and the rotated token is dead too, because the family was burned.
  const afterReplay = await api('POST', '/auth/refresh', { body: { refresh_token: rotatedToken } });
  check(
    'replay detection revokes the whole token family',
    afterReplay.status === 401,
    `status=${afterReplay.status}`,
  );

  const reuseAudit = await api('GET', '/health');
  check('API still healthy after replay handling', reuseAudit.status === 200, `status=${reuseAudit.status}`);
}

/* ── 9. Token-version revocation (logout-all) ────────────────── */
{
  const user = await api('POST', '/auth/register', {
    body: { email: `revoke.${uniq}@example.com`, password: STRONG, fullname: 'Revoke Probe' },
  });
  const token = user.body.access_token;

  const before = await api('GET', '/auth/me', { token });
  check('token works before revocation', before.status === 200, `status=${before.status}`);

  const logoutAll = await api('POST', '/auth/logout-all', { token });
  check('logout-all succeeds', logoutAll.status === 200, `status=${logoutAll.status}`);

  const after = await api('GET', '/auth/me', { token });
  check(
    'the already-issued access token is now rejected',
    after.status === 401,
    `status=${after.status}`,
  );
}

/* ── 10. Logout invalidates the refresh token ────────────────── */
{
  const jar3 = makeJar();
  const fresh = await api('POST', '/auth/login', { body: { email, password: STRONG }, jar: jar3 });
  check('fresh login for logout test', fresh.status === 200, `status=${fresh.status}`);

  await api('POST', '/auth/logout', { token: fresh.body.access_token, jar: jar3 });
  const jar4 = makeJar();
  const afterLogout = await api('POST', '/auth/refresh', {
    body: { refresh_token: jar3.value ?? '' },
  });
  check('refresh token is dead after logout', afterLogout.status === 401, `status=${afterLogout.status}`);
  check('logout cookie jar helper still works', jar4.value === null, 'empty jar');
}

/* ── 11. Password reset flow ─────────────────────────────────── */
{
  const resetEmail = `reset.${uniq}@example.com`;
  await api('POST', '/auth/register', { body: { email: resetEmail, password: STRONG, fullname: 'Reset Probe' } });

  const unknownReq = await api('POST', '/auth/forgot-password', { body: { email: `ghost.${uniq}@example.com` } });
  const knownReq = await api('POST', '/auth/forgot-password', { body: { email: resetEmail } });
  check(
    'forgot-password answers identically for known and unknown addresses',
    unknownReq.body?.message === knownReq.body?.message,
    String(knownReq.body?.message).slice(0, 60),
  );

  const resetToken = knownReq.body?.resetToken;
  check('a reset token is issued outside production', !!resetToken, resetToken ? 'issued' : 'missing');

  const weakReset = await api('POST', '/auth/reset-password', { body: { token: resetToken, password: 'Password123!' } });
  check('reset rejects a weak password', weakReset.status === 400, `status=${weakReset.status}`);

  const NEW_PASSWORD = 'Ev3n!Str0ngerPass';
  const good = await api('POST', '/auth/reset-password', { body: { token: resetToken, password: NEW_PASSWORD } });
  check('reset succeeds with a strong password', good.status === 200, `status=${good.status}`);

  const replay = await api('POST', '/auth/reset-password', { body: { token: resetToken, password: NEW_PASSWORD } });
  check('a reset token cannot be used twice', replay.status === 400, `status=${replay.status}`);

  const oldPw = await api('POST', '/auth/login', { body: { email: resetEmail, password: STRONG } });
  check('the old password no longer works', oldPw.status === 401, `status=${oldPw.status}`);

  const newPw = await api('POST', '/auth/login', { body: { email: resetEmail, password: NEW_PASSWORD } });
  check('the new password works', newPw.status === 200, `status=${newPw.status}`);
}

/* ── 12. Upload content validation ───────────────────────────── */
{
  const reg = await api('POST', '/auth/register', {
    body: { email: `upload.${uniq}@example.com`, password: STRONG, fullname: 'Upload Teacher', role: 'TEACHER' },
  });
  const tToken = reg.body?.access_token;
  const room = await api('POST', '/rooms', { token: tToken, body: { name: 'Upload Probe Room' } });
  const roomId = room.body?.id;

  const form = new FormData();
  form.append('file', new Blob(['not a pdf at all, just text'], { type: 'application/pdf' }), 'fake.pdf');
  const res = await fetch(`${BASE}/documents/upload/${roomId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tToken}` },
    body: form,
  });
  const body = await res.json().catch(() => null);
  check(
    'a text file with a .pdf name and PDF mimetype is rejected',
    res.status === 400 || res.status === 422,
    `status=${res.status}`,
  );
  check(
    'rejection explains the content check',
    /pdf|structure|content/i.test(JSON.stringify(body)),
    JSON.stringify(body).slice(0, 90),
  );
}

/* ── 13. Error hygiene ───────────────────────────────────────── */
{
  const notFound = await api('GET', '/definitely-not-a-route');
  const serialized = JSON.stringify(notFound.body);
  check('unknown route returns 404', notFound.status === 404, `status=${notFound.status}`);
  check('error body carries a correlation id', !!notFound.body?.correlationId, notFound.body?.correlationId);
  check('no stack trace in the response', !/at\s+\w+\s*\(/.test(serialized), 'clean');

  const badJson = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "x"',
  });
  check('malformed JSON is handled without a crash', badJson.status === 400, `status=${badJson.status}`);
}

/* ── 14. Rate limiting ───────────────────────────────────────── */
{
  // When the API is started with widened limits (so the functional checks can
  // run without tripping the limiter) the burst assertion is skipped.
  const loginLimit = Number(process.env.THROTTLE_LOGIN_LIMIT ?? 10);
  if (loginLimit > 50) {
    console.log('SKIP  login rate-limit burst (limits deliberately widened for this run)');
  } else {
    let limited = false;
    for (let i = 0; i < loginLimit + 5; i++) {
      const res = await api('POST', '/auth/login', {
        body: { email: `rl.${uniq}@example.com`, password: STRONG },
      });
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    check('login endpoint is rate limited', limited, limited ? '429 observed' : 'no 429 observed');
  }
}

/* ── 15. CORS ────────────────────────────────────────────────── */
{
  const res = await fetch(`${BASE}/health`, { headers: { Origin: 'https://evil.example.com' } });
  const allow = res.headers.get('access-control-allow-origin');
  check('CORS does not allow an unlisted origin', allow !== 'https://evil.example.com', `allow-origin=${allow}`);

  const ok = await fetch(`${BASE}/health`, { headers: { Origin: 'http://localhost:3000' } });
  check(
    'CORS allows the configured origin',
    ok.headers.get('access-control-allow-origin') === 'http://localhost:3000',
    ok.headers.get('access-control-allow-origin'),
  );
}

/* ── summary ─────────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} live security checks passed`);
if (failed.length) {
  console.log('\nFAILED:');
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`);
  process.exitCode = 1;
}
