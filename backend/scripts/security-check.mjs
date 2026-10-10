/**
 * Verifies the database-level security controls are actually enforced:
 * roles, append-only audit tables, CHECK constraints, audit triggers.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env
  .split(/\r?\n/)
  .find((l) => l.startsWith('DATABASE_URL='))
  .slice('DATABASE_URL='.length)
  .replace(/^"|"$/g, '')
  .trim();

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 30000 });
await client.connect();

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

async function expectFailure(name, sql, params = []) {
  const savepoint = 'sp_' + Math.random().toString(36).slice(2);
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(sql, params);
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    check(name, false, 'statement unexpectedly succeeded');
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    check(name, true, error.code || error.message.slice(0, 60));
  }
}

async function expectSuccess(name, sql, params = []) {
  await client.query(`SAVEPOINT sp2_${Math.random().toString(36).slice(2)}`);
  try {
    const r = await client.query(sql, params);
    check(name, true, `rows=${r.rowCount}`);
    return r;
  } catch (error) {
    check(name, false, error.message.slice(0, 100));
    return null;
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT ' + client._lastSavepoint).catch(() => {});
  }
}

/* ── roles ─────────────────────────────────────────────────── */
{
  const r = await client.query(`select rolname, rolsuper, rolcreatedb, rolcreaterole from pg_roles where rolname like 'classrank%' order by rolname`);
  check('least-privilege roles exist', r.rows.length === 2, r.rows.map((x) => x.rolname).join(','));
  check(
    'app role is not superuser/createdb/createrole',
    r.rows.every((x) => !x.rolsuper && !x.rolcreatedb && !x.rolcreaterole),
    JSON.stringify(r.rows),
  );
}

/* ── RLS policies ──────────────────────────────────────────── */
{
  const r = await client.query(`select count(*)::int n from pg_policies where schemaname='public'`);
  check('RLS policies installed', r.rows[0].n >= 15, `count=${r.rows[0].n}`);
  const forced = await client.query(
    `select relname from pg_class where relrowsecurity and relforcerowsecurity and relnamespace='public'::regnamespace order by relname`,
  );
  check('append-only tables force RLS', forced.rows.length === 2, forced.rows.map((x) => x.relname).join(','));
}

/* ── CHECK constraints ─────────────────────────────────────── */
await client.query('BEGIN');

await expectFailure(
  'rejects a non-lowercase email',
  `insert into "User" (id, email, password, role, "updatedAt") values (gen_random_uuid()::text, 'MiXeD@Example.com', '$2b$10$abcdefghijklmnopqrstuv', 'STUDENT', now())`,
);
await expectFailure(
  'rejects a malformed email',
  `insert into "User" (id, email, password, role, "updatedAt") values (gen_random_uuid()::text, 'not-an-email', '$2b$10$abcdefghijklmnopqrstuv', 'STUDENT', now())`,
);
await expectFailure(
  'rejects a non-bcrypt password',
  `insert into "User" (id, email, password, role, "updatedAt") values (gen_random_uuid()::text, 'plain@example.com', 'plaintext', 'STUDENT', now())`,
);
await expectFailure(
  'rejects a room code that is not 6 upper-case chars',
  `insert into "Room" (id, code, name, "teacherId", "updatedAt") values (gen_random_uuid()::text, 'abc', 'x', 'nobody', now())`,
);
await expectFailure(
  'rejects a percentage above 100',
  `insert into "Submission" (id, "testId", "studentId", percentage) values (gen_random_uuid()::text, 't', 's', 150)`,
);
await expectFailure(
  'rejects an out-of-range selected answer',
  `insert into "Answer" (id, "submissionId", "questionId", "selectedAnswer") values (gen_random_uuid()::text, 's', 'q', 9)`,
);
await expectFailure(
  'rejects a question whose options array is not length 4',
  `insert into "Question" (id, "testId", "questionText", options, "correctAnswer", "updatedAt") values (gen_random_uuid()::text, 't', 'q?', '["a","b"]'::jsonb, 0, now())`,
);
await expectFailure(
  'rejects an out-of-range correct answer',
  `insert into "Question" (id, "testId", "questionText", options, "correctAnswer", "updatedAt") values (gen_random_uuid()::text, 't', 'q?', '["a","b","c","d"]'::jsonb, 7, now())`,
);
await expectFailure(
  'rejects a negative failed-login counter',
  `insert into "User" (id, email, password, role, "failedLoginAttempts", "updatedAt") values (gen_random_uuid()::text, 'neg@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'STUDENT', -5, now())`,
);

/* ── audit trigger records changes, with secrets redacted ──── */
{
  const insert = await client.query(
    `insert into "User" (id, email, password, role, "updatedAt")
     values (gen_random_uuid()::text, 'audit-probe@example.com', '$2b$10$abcdefghijklmnopqrstuv', 'STUDENT', now())
     returning id`,
  );
  const userId = insert.rows[0].id;

  const audit = await client.query(
    `select action, entity, metadata from "AuditLog" where "entityId" = $1 order by "createdAt" desc limit 1`,
    [userId],
  );
  check('audit trigger records inserts', audit.rows.length === 1 && audit.rows[0].action === 'INSERT', JSON.stringify(audit.rows[0]?.action));
  const meta = JSON.stringify(audit.rows[0]?.metadata ?? {});
  check('audit metadata redacts the password hash', !meta.includes('$2b$10$abcdefghijklmnopqrstuv'), meta.slice(0, 80));

  /* append-only enforcement */
  await expectFailure(
    'audit log cannot be updated',
    `update "AuditLog" set action = 'TAMPERED' where "entityId" = $1`,
    [userId],
  );
  await expectFailure(
    'audit log cannot be deleted',
    `delete from "AuditLog" where "entityId" = $1`,
    [userId],
  );

  // Insert a real row first: row-level triggers only fire when rows match.
  await client.query(
    `insert into "LoginAttempt" (id, email, success) values (gen_random_uuid()::text, 'immutable-probe@example.com', false)`,
  );
  await expectFailure(
    'login attempts cannot be deleted',
    `delete from "LoginAttempt" where email = 'immutable-probe@example.com'`,
  );
  await expectFailure(
    'login attempts cannot be updated',
    `update "LoginAttempt" set success = true where email = 'immutable-probe@example.com'`,
  );
}

await client.query('ROLLBACK');

/* ── append-only tables accept new rows ─────────────────────── */
{
  await client.query('BEGIN');
  await client.query(
    `insert into "LoginAttempt" (id, email, success, reason) values (gen_random_uuid()::text, 'probe@example.com', false, 'bad_password')`,
  );
  const r = await client.query(`select count(*)::int n from "LoginAttempt" where email = 'probe@example.com'`);
  check('login attempts can be appended', r.rows[0].n === 1, `rows=${r.rows[0].n}`);
  await client.query('ROLLBACK');
}

/* ── summary ──────────────────────────────────────────────── */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} database security checks passed`);
if (failed.length) {
  console.log('FAILED: ' + failed.map((f) => f.name).join(' | '));
  process.exitCode = 1;
}

await client.end();
