# ClassRank

Turn study material into smarter class tests. Teachers upload a PDF, AI drafts
multiple-choice questions grounded in that document, the teacher reviews and
publishes, students take a timed assessment, and the server grades it and
updates the room and weekly leaderboards.

Next.js (frontend) · NestJS (backend) · Prisma · Neon Postgres · Qdrant ·
OpenRouter (LLM). The data layer and API are hardened for production; see
[Security](#security) below.

---

## Quick start

### 1. Database

Paste **`backend/prisma/classrank-neon-schema.sql`** into the Neon SQL console
and run it. That creates the complete hardened schema — tables, constraints,
row-level security, audit triggers, least-privilege roles — with **no data**.

It is the only file you need for a fresh database. (Use
`backend/prisma/security-hardening.sql` instead if you already have data and
only want to add the protections.)

### 2. Environment

```bash
cd backend
cp .env.example .env      # then fill in the values
```

Required: `DATABASE_URL` and `JWT_SECRET` (≥ 32 characters). The API refuses to
boot with a missing, short, low-entropy, or placeholder secret. Generate one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Run

```bash
# terminal 1 — API on :3001
cd backend
npm install
npm run start:dev

# terminal 2 — web app on :3000
npm install
npm run dev
```

Open <http://localhost:3000> and sign up. There is no seeded data — every
account is created through the app.

---

## Project layout

```
app/                     Next.js App Router pages
components/              auth provider, toasts, nav, shared states
lib/api.ts               typed API client + password policy mirror
middleware.ts            edge guard for protected routes
backend/
  prisma/
    schema.prisma                data model
    classrank-neon-schema.sql    complete secure schema (Neon console)
    security-hardening.sql       add protections to an existing database
    wipe-data.sql                empty every table, keep the schema
  src/
    common/config/             env validation, rate-limit config
    common/security/           audit trail, encryption, password policy, upload checks
    common/filters/            sanitising exception filter
    auth/                      register/login/refresh/reset, sessions, JWT strategy
    rooms/ documents/ ai/ tests/ submissions/ leaderboard/ users/
  scripts/                 verification suites and DB utilities
```

---

## Security

### Database level

| Control | Detail |
|---|---|
| **Least-privilege roles** | `classrank_app` (read/write) and `classrank_readonly` (reporting). `PUBLIC` loses all rights and cannot create objects. Run the API as `classrank_app`, not the owner, for these to bite. |
| **Row-level security** | Enabled on all 13 tables with per-role policies. |
| **Append-only audit trail** | `AuditLog` and `LoginAttempt` use `FORCE ROW LEVEL SECURITY` plus a `BEFORE UPDATE OR DELETE` trigger. Neither the app role nor the owner can rewrite history at the row level. |
| **Audit triggers** | Every INSERT/UPDATE/DELETE on `User`, `Room`, `RoomMember`, `Document`, `Test`, `Question` and `Submission` is recorded. Secret columns (`password`, `twoFactorSecret`, `refreshTokenHash`, `tokenHash`, `extractedText`) are stripped before the row image is written. |
| **CHECK constraints (26)** | Lower-case emails, email format, bcrypt-format hashes, 6-character upper-case room codes, 0–3 answer indexes, 0–100 percentages, 4-option questions, PDF-only documents, non-negative counters, `submittedAt >= startedAt`. Invalid rows are impossible even via raw SQL. |
| **Column-level grants** | `classrank_readonly` can read `User` columns *except* `password`, `twoFactorSecret` and `tokenVersion`, and has no access at all to `Session`, `PasswordResetToken` or `EmailVerificationToken`. |
| **`updatedAt` triggers** | Timestamps stay correct even for raw SQL writes. |

### Authentication

- **bcrypt** with a cost of 12 (configurable 10–15). Hashes are never returned
  by any endpoint, and the DTO/`select` layers make accidental exposure hard.
- **Account lockout** — `MAX_LOGIN_ATTEMPTS` (default 5) failures locks the
  account for `LOCKOUT_MINUTES` (default 15). The lock is checked *before*
  password verification.
- **User-enumeration resistance** — unknown account and wrong password return
  the same message, and a dummy bcrypt comparison runs for unknown accounts so
  response timing does not leak existence either.
- **Short-lived access tokens** (15 minutes) carrying a `tokenVersion`.
- **Refresh tokens** are random 48-byte values stored **only as SHA-256
  hashes**, delivered in an `HttpOnly`, `SameSite=Lax`, `Secure`-in-production
  cookie. They are never in a JSON response.
- **Rotation with replay detection** — every refresh revokes the previous token.
  Presenting an already-revoked token means it leaked, so the entire rotation
  family is revoked and the event is audited.
- **Real revocation** — `JwtStrategy` re-checks the account on every request.
  Bumping `tokenVersion` (password change, password reset, sign-out-everywhere)
  invalidates every outstanding access token immediately.
- **Password policy** — ≥ 10 characters with upper case, lower case, a digit
  and a symbol; rejects common passwords (including l33t spellings), keyboard
  and alphabet runs, four-character repeats, and anything derived from the
  user's own name or email. Enforced on the server (DTO + service) and mirrored
  in the UI for immediate feedback.
- **Password reset** — single-use, hashed, 30-minute tokens; the response is
  identical whether or not the address exists; a successful reset revokes every
  session.
- **Email verification** — single-use hashed tokens; opt-in enforcement via
  `REQUIRE_EMAIL_VERIFICATION=true`.
- **Public registration can never mint an `ADMIN`.**

### API level

- **helmet** with a locked-down CSP, HSTS (production), `X-Frame-Options: DENY`,
  `nosniff`, no referrer, and `X-Powered-By` removed.
- **Strict CORS** — explicit allow-list, credentials enabled, wildcards
  rejected outright, and blocked origins logged.
- **Global validation pipe** with `whitelist`, `forbidNonWhitelisted` and
  `forbidUnknownValues`: unknown fields are rejected, not silently ignored, so
  mass-assignment attempts fail loudly.
- **Sanitising exception filter** — 5xx responses never leak stack traces or
  driver/SQL internals, and every response carries a correlation id matching the
  server log line.
- **Rate limiting** — per-route budgets (register 5/min, login 10/min, password
  endpoints 5/min, LLM 5/min) on top of a global default. All tunable via
  `THROTTLE_*` environment variables.
- **Uploads validated by content** — PDF magic bytes (`%PDF-`), `%%EOF` trailer,
  declared-size match, and rejection of embedded active content
  (`/JavaScript`, `/Launch`, `/OpenAction`, `/EmbeddedFile`, …). Filenames are
  sanitised and a SHA-256 integrity hash is stored.
- **Body size limits** (256 KB JSON) and **proxy-aware client IPs** for accurate
  auditing and throttling.
- **Boot-time environment validation** — no weak or placeholder secrets, TLS
  required on `DATABASE_URL` in production, bounded lockout/hashing settings.

### Resilience

Neon suspends idle databases, so the Prisma client retries connection-level
failures (`P1001`, `P1002`, `P1008`, `P1017`, `P2024`, …) with exponential
backoff both at boot and per statement. A cold start surfaces as latency rather
than a 500. Only connection errors are retried — a failed connection means the
statement never ran, so replaying a write cannot double-apply it.

### Deliberate trade-offs

- Access tokens live in `localStorage` for the SPA, so an XSS foothold could
  read one. The blast radius is bounded to 15 minutes by short expiry, the
  refresh token is `HttpOnly` and unreadable from JavaScript, and CSP plus React
  escaping are the primary XSS defences. Moving to cookie-only access tokens is
  the next step if you want to eliminate this entirely.
- The audit trail is append-only for row operations. Purging for retention or
  GDPR requires deliberately disabling the trigger (documented in the SQL file)
  or `TRUNCATE`, which bypasses row triggers.
- The weekly global score is not difficulty-normalised across different tests.

---

## Verification

Every claim above is covered by a runnable check.

```bash
cd backend

# 188 unit tests — auth, lockout, password policy, env validation, grading
npm test

# 20 database-security checks — roles, RLS, append-only, CHECK constraints
node scripts/security-check.mjs

# Full build + type check
npm run build

# --- the following need the API running on :3001 ---

# 50 live security checks — headers, lockout, rotation, replay detection,
# token revocation, payload whitelisting, upload content checks, error hygiene
node scripts/security-live.mjs

# 53 API/authorisation checks
node scripts/e2e-smoke.mjs

# 21 checks through the full demo path, including a real PDF -> AI -> publish
node scripts/demo-path.mjs

# 4 rate-limit checks — run against default limits (no THROTTLE_* overrides)
node scripts/rate-limit-check.mjs
```

`security-live.mjs` deliberately exercises many auth endpoints, so run the API
with widened limits for that suite and with defaults for the rate-limit suite:

```bash
# functional suites
THROTTLE_LOGIN_LIMIT=500 THROTTLE_REGISTER_LIMIT=500 \
THROTTLE_SENSITIVE_LIMIT=500 node dist/main.js

# rate-limit suite
node dist/main.js
```

Supporting utilities:

```bash
node scripts/make-pdf.mjs                     # regenerate fixtures/dbms-unit-1.pdf
node scripts/build-neon-schema.mjs            # regenerate the Neon SQL file
node scripts/dbcheck.mjs                      # inspect users/rooms/tests
node scripts/cleanup-test-data.mjs --dry-run  # review smoke-test leftovers
```

---

## Production checklist

1. Run `classrank-neon-schema.sql` (or `security-hardening.sql`) on the database.
2. Set strong, unique values for `JWT_SECRET`, `APP_ENCRYPTION_KEY` and the
   `classrank_app` password. Store them in a secret manager, never in git.
3. **Point `DATABASE_URL` at `classrank_app`**, not the owner role — otherwise
   RLS and the audit guarantees do not apply to the application.
4. Set `NODE_ENV=production` and `CORS_ORIGINS` to your real origins. The API
   will refuse to start if either is wrong.
5. Terminate TLS in front of the API so `Secure` cookies are sent.
6. Decide on `REQUIRE_EMAIL_VERIFICATION` and wire a mail provider — the reset
   and verification tokens are only logged, not emailed, until you do.
7. Back up the database. `wipe-data.sql` and the schema script are destructive.

---

## Known limitations

- MCQs test recall, not deep understanding.
- No proctoring, so scores depend on student honesty.
- Scanned PDFs need OCR; such uploads are marked `FAILED` with a clear message.
- Embeddings use placeholder vectors when no embedding provider is configured,
  so Qdrant acts as a chunk store and retrieval falls back to the text extracted
  at upload time.
- AI generation retries up to three times inside the request; there is no
  background job queue.
- No mail provider is wired, so password-reset and verification tokens are
  returned in development and must be logged in production.

## Post-MVP ideas

Weak-topic practice, more question types, teacher analytics, OCR,
difficulty-normalised global scoring, institution dashboards, TOTP two-factor
(the schema and encryption helper are already in place).
