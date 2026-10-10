-- ============================================================================
--  ClassRank — database security hardening
-- ============================================================================
--
--  Run this AFTER the schema exists (prisma db push, or the schema section of
--  classrank-neon-schema.sql). It is idempotent: safe to run repeatedly.
--
--  What it adds
--    1. Extensions used for cryptographic ids and case-insensitive helpers.
--    2. Least-privilege roles: classrank_app (read/write) and
--       classrank_readonly (reporting), with PUBLIC locked out.
--    3. CHECK constraints that make invalid or malicious rows impossible.
--    4. Row-level security enabled on every table.
--    5. Append-only enforcement on AuditLog and LoginAttempt (tamper-evident).
--    6. Audit triggers that record every change to core entities, with secrets
--       redacted before they reach the log.
--    7. updatedAt triggers so timestamps are correct even for raw SQL writes.
--    8. Least-privilege grants and default privileges.
--
--  IMPORTANT — production checklist
--    * Set real passwords for the created roles, then point DATABASE_URL at
--      classrank_app instead of the owner role so RLS and grants actually bite.
--    * The owner role bypasses RLS; classrank_app does not (FORCE is used on
--      the append-only tables).
--    * Store DATABASE_URL / JWT_SECRET / APP_ENCRYPTION_KEY in a secret
--      manager, never in the repository.
-- ============================================================================

-- ─── 1. Extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ─── 2. Least-privilege roles ───────────────────────────────────────────────
-- Guarded: creating roles needs CREATEROLE, which some managed plans restrict.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_app') THEN
    -- Replace this password before use; it is a placeholder.
    CREATE ROLE classrank_app LOGIN PASSWORD 'change-me-app-role-password'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_readonly') THEN
    CREATE ROLE classrank_readonly LOGIN PASSWORD 'change-me-readonly-role-password'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping role creation (insufficient privilege). Grants/RLS below still apply to existing roles.';
END $$;

-- Nobody gets object-creation rights on the public schema.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ─── 3. CHECK constraints ───────────────────────────────────────────────────
-- Constraints are added inside DO blocks so re-running is harmless.

-- User ---------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."User"
    ADD CONSTRAINT user_email_lowercase CHECK (email = lower(email));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."User"
    ADD CONSTRAINT user_email_format CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."User"
    ADD CONSTRAINT user_email_length CHECK (char_length(email) BETWEEN 3 AND 254);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."User"
    ADD CONSTRAINT user_password_bcrypt CHECK (password ~ '^\$2[aby]\$[0-9]{2}\$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."User"
    ADD CONSTRAINT user_failed_attempts_non_negative CHECK ("failedLoginAttempts" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."User"
    ADD CONSTRAINT user_token_version_non_negative CHECK ("tokenVersion" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Room ---------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."Room"
    ADD CONSTRAINT room_code_format CHECK (code ~ '^[A-Z0-9]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Room"
    ADD CONSTRAINT room_name_length CHECK (char_length(name) BETWEEN 1 AND 120);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Test ---------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."Test"
    ADD CONSTRAINT test_duration_range CHECK (duration IS NULL OR duration BETWEEN 1 AND 600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Test"
    ADD CONSTRAINT test_question_count_non_negative CHECK ("questionCount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Test"
    ADD CONSTRAINT test_title_length CHECK (char_length(title) BETWEEN 1 AND 200);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Question -----------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."Question"
    ADD CONSTRAINT question_correct_answer_range CHECK ("correctAnswer" BETWEEN 0 AND 3);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Question"
    ADD CONSTRAINT question_points_positive CHECK (points > 0 AND points <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Question"
    ADD CONSTRAINT question_options_is_four_element_array
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Question"
    ADD CONSTRAINT question_text_length CHECK (char_length("questionText") BETWEEN 1 AND 2000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Submission ---------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."Submission"
    ADD CONSTRAINT submission_percentage_range CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Submission"
    ADD CONSTRAINT submission_score_non_negative CHECK (score IS NULL OR score >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Submission"
    ADD CONSTRAINT submission_counts_non_negative
    CHECK (("correctAnswers" IS NULL OR "correctAnswers" >= 0) AND ("wrongAnswers" IS NULL OR "wrongAnswers" >= 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Submission"
    ADD CONSTRAINT submission_time_non_negative CHECK ("timeTaken" IS NULL OR "timeTaken" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Submission"
    ADD CONSTRAINT submission_submitted_after_started
    CHECK ("submittedAt" IS NULL OR "submittedAt" >= "startedAt");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Answer -------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."Answer"
    ADD CONSTRAINT answer_selected_range CHECK ("selectedAnswer" IS NULL OR "selectedAnswer" BETWEEN 0 AND 3);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Document -----------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."Document"
    ADD CONSTRAINT document_chunk_count_non_negative CHECK ("chunkCount" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Document"
    ADD CONSTRAINT document_file_size_non_negative CHECK ("fileSize" IS NULL OR "fileSize" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."Document"
    ADD CONSTRAINT document_pdf_only CHECK ("mimeType" IS NULL OR "mimeType" = 'application/pdf');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Session ------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."Session"
    ADD CONSTRAINT session_expires_after_created CHECK ("expiresAt" > "createdAt");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- LoginAttempt -------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public."LoginAttempt"
    ADD CONSTRAINT login_attempt_email_length CHECK (char_length(email) BETWEEN 3 AND 254);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 4. Row-level security ──────────────────────────────────────────────────
-- Enabled on every table so that a non-owner role has no access unless a
-- policy grants it. The owner role is exempt unless FORCE is set (section 5).

ALTER TABLE public."User"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Room"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RoomMember"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Document"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Test"                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Question"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Submission"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Answer"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Session"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PasswordResetToken"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."LoginAttempt"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog"               ENABLE ROW LEVEL SECURITY;

-- Permissive policies for the application role, created only when it exists.
DO $$
DECLARE
  t text;
  app text := 'classrank_app';
  ro  text := 'classrank_readonly';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_app') THEN
    RAISE NOTICE 'classrank_app role not present — skipping application policies.';
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY[
    'User', 'Room', 'RoomMember', 'Document', 'Test', 'Question',
    'Submission', 'Answer', 'Session', 'PasswordResetToken',
    'EmailVerificationToken', 'LoginAttempt'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_app_full', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
      t || '_app_full', t, app
    );
  END LOOP;

  -- AuditLog is read/append only for the application role.
  EXECUTE 'DROP POLICY IF EXISTS audit_app_select ON public."AuditLog"';
  EXECUTE 'CREATE POLICY audit_app_select ON public."AuditLog" FOR SELECT TO classrank_app USING (true)';
  EXECUTE 'DROP POLICY IF EXISTS audit_app_insert ON public."AuditLog"';
  EXECUTE 'CREATE POLICY audit_app_insert ON public."AuditLog" FOR INSERT TO classrank_app WITH CHECK (true)';
END $$;

-- ─── 5. Append-only enforcement ─────────────────────────────────────────────
-- FORCE makes these policies apply to the table owner as well, so the audit
-- trail cannot be rewritten by the application connection.

ALTER TABLE public."AuditLog"     FORCE ROW LEVEL SECURITY;
ALTER TABLE public."LoginAttempt" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_select ON public."AuditLog";
CREATE POLICY audit_select ON public."AuditLog" FOR SELECT USING (true);

DROP POLICY IF EXISTS audit_insert ON public."AuditLog";
CREATE POLICY audit_insert ON public."AuditLog" FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS login_attempt_select ON public."LoginAttempt";
CREATE POLICY login_attempt_select ON public."LoginAttempt" FOR SELECT USING (true);

DROP POLICY IF EXISTS login_attempt_insert ON public."LoginAttempt";
CREATE POLICY login_attempt_insert ON public."LoginAttempt" FOR INSERT WITH CHECK (true);

-- Belt and braces: block UPDATE/DELETE even if a future policy is added by mistake.
CREATE OR REPLACE FUNCTION public.classrank_block_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only; % is not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;

DROP TRIGGER IF EXISTS audit_log_append_only ON public."AuditLog";
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON public."AuditLog"
  FOR EACH ROW EXECUTE FUNCTION public.classrank_block_mutation();

DROP TRIGGER IF EXISTS login_attempt_append_only ON public."LoginAttempt";
CREATE TRIGGER login_attempt_append_only
  BEFORE UPDATE OR DELETE ON public."LoginAttempt"
  FOR EACH ROW EXECUTE FUNCTION public.classrank_block_mutation();

-- ─── 6. Audit triggers ──────────────────────────────────────────────────────
-- Records INSERT/UPDATE/DELETE on core entities. Secret columns are stripped
-- before the row image reaches the log.

CREATE OR REPLACE FUNCTION public.classrank_audit_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_meta      jsonb;
  v_entity_id text;
  v_actor     text;
  v_redact    text[] := ARRAY['password', 'twoFactorSecret', 'refreshTokenHash', 'tokenHash', 'extractedText'];
  k           text;
BEGIN
  v_actor := nullif(current_setting('app.current_user_id', true), '');

  IF TG_OP = 'INSERT' THEN
    v_meta := jsonb_build_object('new', to_jsonb(NEW));
    v_entity_id := to_jsonb(NEW) ->> 'id';
  ELSIF TG_OP = 'UPDATE' THEN
    v_meta := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    v_entity_id := to_jsonb(NEW) ->> 'id';
  ELSE
    v_meta := jsonb_build_object('old', to_jsonb(OLD));
    v_entity_id := to_jsonb(OLD) ->> 'id';
  END IF;

  -- Strip secrets from whichever row images are present.
  FOREACH k IN ARRAY v_redact LOOP
    v_meta := jsonb_set(v_meta, '{new}', COALESCE(v_meta -> 'new', '{}'::jsonb) - k, false);
    v_meta := jsonb_set(v_meta, '{old}', COALESCE(v_meta -> 'old', '{}'::jsonb) - k, false);
  END LOOP;

  INSERT INTO public."AuditLog" (id, "actorId", action, entity, "entityId", metadata)
  VALUES (gen_random_uuid()::text, v_actor, TG_OP, TG_TABLE_NAME, v_entity_id, v_meta);

  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['User', 'Room', 'RoomMember', 'Document', 'Test', 'Question', 'Submission'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'classrank_audit_' || lower(t), t);
    EXECUTE format(
      'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.classrank_audit_trigger()',
      'classrank_audit_' || lower(t), t
    );
  END LOOP;
END $$;

-- ─── 7. updatedAt triggers ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.classrank_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END $$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['User', 'Room', 'Document', 'Test', 'Question'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'classrank_touch_' || lower(t), t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.classrank_touch_updated_at()',
      'classrank_touch_' || lower(t), t
    );
  END LOOP;
END $$;

-- ─── 8. Grants ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_app') THEN
    GRANT USAGE ON SCHEMA public TO classrank_app;

    FOREACH t IN ARRAY ARRAY[
      'User', 'Room', 'RoomMember', 'Document', 'Test', 'Question',
      'Submission', 'Answer', 'Session', 'PasswordResetToken',
      'EmailVerificationToken'
    ] LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO classrank_app', t);
    END LOOP;

    -- Audit + login history: append and read, never rewrite.
    GRANT SELECT, INSERT ON public."AuditLog" TO classrank_app;
    GRANT SELECT, INSERT ON public."LoginAttempt" TO classrank_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON public."AuditLog" FROM classrank_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON public."LoginAttempt" FROM classrank_app;

    -- Never expose password/session material to the reporting role.
    REVOKE ALL ON public."Session" FROM classrank_readonly;
    REVOKE ALL ON public."PasswordResetToken" FROM classrank_readonly;
    REVOKE ALL ON public."EmailVerificationToken" FROM classrank_readonly;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_readonly') THEN
    GRANT USAGE ON SCHEMA public TO classrank_readonly;

    -- Revoke first, then re-grant only the safe surface.
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM classrank_readonly;

    -- Reporting may read academic data...
    GRANT SELECT ON public."Room"       TO classrank_readonly;
    GRANT SELECT ON public."RoomMember" TO classrank_readonly;
    GRANT SELECT ON public."Test"       TO classrank_readonly;
    GRANT SELECT ON public."Question"   TO classrank_readonly;
    GRANT SELECT ON public."Submission" TO classrank_readonly;
    GRANT SELECT ON public."Answer"     TO classrank_readonly;
    GRANT SELECT ON public."Document"   TO classrank_readonly;
    GRANT SELECT ON public."LoginAttempt" TO classrank_readonly;
    GRANT SELECT ON public."AuditLog"   TO classrank_readonly;

    -- ...but only non-secret columns of User. Table-level SELECT is deliberately
    -- withheld so `password`, `twoFactorSecret` and `tokenVersion` stay private.
    REVOKE ALL ON public."User" FROM classrank_readonly;
    GRANT SELECT (
      id, email, fullname, role, status,
      "emailVerified", "emailVerifiedAt", "createdAt", "updatedAt", "deletedAt"
    ) ON public."User" TO classrank_readonly;

    -- Identity/session internals are never visible to reporting.
    REVOKE ALL ON public."Session"                FROM classrank_readonly;
    REVOKE ALL ON public."PasswordResetToken"     FROM classrank_readonly;
    REVOKE ALL ON public."EmailVerificationToken" FROM classrank_readonly;
  END IF;
END $$;

-- Future tables inherit the same privilege shape.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_app') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO classrank_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_readonly') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT ON TABLES TO classrank_readonly;
  END IF;
END $$;

-- ─── 9. Verification ────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE')          AS tables,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')          AS rls_policies,
  (SELECT count(*) FROM pg_trigger
    WHERE NOT tgisinternal AND tgname LIKE 'classrank_%')                 AS security_triggers,
  (SELECT count(*) FROM pg_constraint
    WHERE contype = 'c' AND connamespace = 'public'::regnamespace)        AS check_constraints;
