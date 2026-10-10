/**
 * Generates prisma/classrank-neon-schema.sql — the single file to paste into
 * the Neon SQL console.
 *
 * It creates the complete, hardened ClassRank schema and inserts NO data:
 *   extensions, enums, tables, indexes, CHECK constraints, RLS policies,
 *   append-only triggers, audit triggers, least-privilege roles and grants.
 *
 * The table/constraint/policy/trigger definitions come from a live pg_dump of
 * the verified database, so the file always matches what was actually tested.
 *
 *   node scripts/build-neon-schema.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const here = (p) => new URL(p, import.meta.url);

/* ── base schema from pg_dump ────────────────────────────────── */
let dump = readFileSync(here('./schema-dump.sql'), 'utf8');
dump = dump
  .split(/\r?\n/)
  .filter(
    (line) =>
      !/^\\restrict/.test(line) &&
      !/^\\unrestrict/.test(line) &&
      !/^-- Dumped (from|by)/.test(line) &&
      !/^SET (statement_timeout|lock_timeout|idle_in_transaction_session_timeout|transaction_timeout)/.test(line) &&
      !/^SELECT pg_catalog\.set_config\('search_path'/.test(line),
  )
  .join('\n')
  .trim()
  // `public` always exists on a Neon database.
  .replace(/^CREATE SCHEMA public;$/m, 'CREATE SCHEMA IF NOT EXISTS public;');

/**
 * Placeholder role passwords. Operators MUST replace these before use; the
 * script prints freshly generated suggestions to make that easy.
 */
function suggestPassword() {
  return randomBytes(24).toString('base64url');
}
const APP_PASSWORD = suggestPassword();
const READONLY_PASSWORD = suggestPassword();

const TABLE_LIST = [
  'User', 'Room', 'RoomMember', 'Document', 'Test', 'Question',
  'Submission', 'Answer', 'Session', 'PasswordResetToken',
  'EmailVerificationToken', 'LoginAttempt', 'AuditLog',
];

const lines = [];
const push = (...values) => lines.push(...values);

/* ── header ──────────────────────────────────────────────────── */
push(
  '-- ============================================================================',
  '--  ClassRank — complete secure schema for the Neon SQL console',
  '-- ============================================================================',
  '--',
  '--  WHAT THIS DOES',
  '--    Creates the full ClassRank database: extensions, enums, all tables,',
  '--    indexes, CHECK constraints, row-level security, append-only audit',
  '--    triggers, least-privilege roles and grants.',
  '--',
  '--    It inserts NO data. Every table starts empty; users sign up through',
  '--    the application.',
  '--',
  '--  HOW TO USE',
  '--    1. Open the Neon console for your project -> SQL Editor.',
  '--    2. Paste this entire file and run it once.',
  '--    3. Read the SECURITY NOTES at the bottom before going to production.',
  '--',
  '--  SAFE TO RE-RUN: the script drops and recreates everything, so it is',
  '--  destructive. On a database that already holds real data, use',
  '--  prisma/security-hardening.sql instead (it only adds protections).',
  '-- ============================================================================',
  '',
  'BEGIN;',
  '',
  '-- ─── 1. Extensions ──────────────────────────────────────────────────────────',
  'CREATE EXTENSION IF NOT EXISTS pgcrypto;',
  'CREATE EXTENSION IF NOT EXISTS citext;',
  '',
  '-- ─── 2. Reset ───────────────────────────────────────────────────────────────',
);

for (const table of [...TABLE_LIST].reverse()) {
  push(`DROP TABLE IF EXISTS public."${table}" CASCADE;`);
}
push(
  'DROP FUNCTION IF EXISTS public.classrank_audit_trigger() CASCADE;',
  'DROP FUNCTION IF EXISTS public.classrank_block_mutation() CASCADE;',
  'DROP FUNCTION IF EXISTS public.classrank_touch_updated_at() CASCADE;',
  'DROP TYPE IF EXISTS public."DocumentStatus" CASCADE;',
  'DROP TYPE IF EXISTS public."TestStatus" CASCADE;',
  'DROP TYPE IF EXISTS public."Role" CASCADE;',
  'DROP TYPE IF EXISTS public."UserStatus" CASCADE;',
  '',
  '-- ─── 3. Tables, constraints, indexes, RLS policies and triggers ─────────────',
  dump,
  '',
  '-- ─── 4. Least-privilege roles ───────────────────────────────────────────────',
  '--  Rotate these passwords immediately. They are random placeholders, but the',
  '--  real values belong in a secret manager, never in this file.',
  'DO $$',
  'BEGIN',
  '  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'classrank_app\') THEN',
  `    CREATE ROLE classrank_app LOGIN PASSWORD '${APP_PASSWORD}'`,
  '      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;',
  '  END IF;',
  '  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'classrank_readonly\') THEN',
  `    CREATE ROLE classrank_readonly LOGIN PASSWORD '${READONLY_PASSWORD}'`,
  '      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;',
  '  END IF;',
  'EXCEPTION WHEN insufficient_privilege THEN',
  "  RAISE NOTICE 'Skipping role creation (insufficient privilege on this plan).';",
  'END $$;',
  '',
  '-- Nobody may create objects in the public schema.',
  'REVOKE ALL ON SCHEMA public FROM PUBLIC;',
  'REVOKE CREATE ON SCHEMA public FROM PUBLIC;',
  '',
  '-- ─── 5. Grants ──────────────────────────────────────────────────────────────',
  'DO $$',
  'DECLARE',
  '  t text;',
  'BEGIN',
  "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_app') THEN",
  '    GRANT USAGE ON SCHEMA public TO classrank_app;',
  '    FOREACH t IN ARRAY ARRAY[',
  "      'User', 'Room', 'RoomMember', 'Document', 'Test', 'Question',",
  "      'Submission', 'Answer', 'Session', 'PasswordResetToken', 'EmailVerificationToken'",
  '    ] LOOP',
  "      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO classrank_app', t);",
  '    END LOOP;',
  '    -- Audit + login history: append and read only, never rewrite.',
  '    GRANT SELECT, INSERT ON public."AuditLog" TO classrank_app;',
  '    GRANT SELECT, INSERT ON public."LoginAttempt" TO classrank_app;',
  '    REVOKE UPDATE, DELETE, TRUNCATE ON public."AuditLog" FROM classrank_app;',
  '    REVOKE UPDATE, DELETE, TRUNCATE ON public."LoginAttempt" FROM classrank_app;',
  '  END IF;',
  '',
  "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_readonly') THEN",
  '    GRANT USAGE ON SCHEMA public TO classrank_readonly;',
  '    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM classrank_readonly;',
  '    GRANT SELECT ON public."Room", public."RoomMember", public."Test",',
  '                    public."Question", public."Submission", public."Answer",',
  '                    public."Document", public."LoginAttempt", public."AuditLog"',
  '      TO classrank_readonly;',
  '    -- Only non-secret columns of User: no password, no 2FA secret.',
  '    GRANT SELECT (id, email, fullname, role, status, "emailVerified",',
  '                  "emailVerifiedAt", "createdAt", "updatedAt", "deletedAt")',
  '      ON public."User" TO classrank_readonly;',
  '    -- Session/token internals are never visible to reporting.',
  '    REVOKE ALL ON public."Session"                FROM classrank_readonly;',
  '    REVOKE ALL ON public."PasswordResetToken"     FROM classrank_readonly;',
  '    REVOKE ALL ON public."EmailVerificationToken" FROM classrank_readonly;',
  '  END IF;',
  'END $$;',
  '',
  '-- Future tables inherit the same privilege shape.',
  'DO $$',
  'BEGIN',
  "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_app') THEN",
  '    ALTER DEFAULT PRIVILEGES IN SCHEMA public',
  '      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO classrank_app;',
  '  END IF;',
  "  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_readonly') THEN",
  '    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO classrank_readonly;',
  '  END IF;',
  'END $$;',
  '',
  'COMMIT;',
  '',
  '-- ─── 6. Verification ────────────────────────────────────────────────────────',
  'SELECT',
  "  (SELECT count(*) FROM information_schema.tables",
  "     WHERE table_schema = 'public' AND table_type = 'BASE TABLE')       AS tables,",
  "  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS rls_policies,",
  "  (SELECT count(*) FROM pg_trigger",
  "     WHERE NOT tgisinternal AND tgname LIKE 'classrank_%')              AS security_triggers,",
  "  (SELECT count(*) FROM pg_constraint",
  "     WHERE contype = 'c' AND connamespace = 'public'::regnamespace)     AS check_constraints,",
  "  (SELECT count(*) FROM pg_roles WHERE rolname LIKE 'classrank%')        AS roles;",
  '',
  '-- Expected: 13 tables, 18 RLS policies, 12 classrank_* security triggers',
  '--           (plus 2 append-only triggers on AuditLog/LoginAttempt),',
  '--           ~26 CHECK constraints, 2 roles.',
  '',
  '-- Every table must be empty.',
  'SELECT',
  '  (SELECT count(*) FROM public."User")        AS users,',
  '  (SELECT count(*) FROM public."Room")        AS rooms,',
  '  (SELECT count(*) FROM public."Test")        AS tests,',
  '  (SELECT count(*) FROM public."Submission")  AS submissions,',
  '  (SELECT count(*) FROM public."AuditLog")    AS audit_logs;',
  '',
  '-- ─── 7. SECURITY NOTES (read before production) ─────────────────────────────',
  '--',
  '--  * Point DATABASE_URL at classrank_app (not the owner role). The owner',
  '--    bypasses RLS; classrank_app does not, and it cannot rewrite the audit',
  '--    trail. Set the password you want and store it in a secret manager.',
  '--',
  '--  * AuditLog and LoginAttempt are append-only. A BEFORE DELETE trigger',
  '--    blocks row-level deletion for every role, including the owner. To purge',
  '--    (retention/GDPR), use the supported path in prisma/wipe-data.sql or:',
  '--        ALTER TABLE public."AuditLog" DISABLE TRIGGER audit_log_append_only;',
  '--        DELETE FROM public."AuditLog" WHERE ...;',
  '--        ALTER TABLE public."AuditLog" ENABLE  TRIGGER audit_log_append_only;',
  '--',
  '--  * The application sets `app.current_user_id` when writing so the audit',
  '--    trigger can attribute changes. Without it, actorId stays NULL.',
  '--',
  '--  * CHECK constraints enforce the invariants the API relies on: lower-case',
  '--    emails, bcrypt-format password hashes, 6-character upper-case room codes,',
  '--    0-3 answer indexes, 0-100 percentages, 4-option questions, PDF-only',
  '--    documents. Invalid rows are impossible even via raw SQL.',
  '--',
  '-- ===========================================================================',
);

const output = lines.join('\n');
const target = here('../prisma/classrank-neon-schema.sql');
writeFileSync(target, output, 'utf8');
console.log(`wrote prisma/classrank-neon-schema.sql (${Buffer.byteLength(output, 'utf8')} bytes, ${output.split('\n').length} lines)`);
console.log(`suggested classrank_app password:      ${APP_PASSWORD}`);
console.log(`suggested classrank_readonly password: ${READONLY_PASSWORD}`);
