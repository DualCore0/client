-- ============================================================================
--  ClassRank — complete secure schema for the Neon SQL console
-- ============================================================================
--
--  WHAT THIS DOES
--    Creates the full ClassRank database: extensions, enums, all tables,
--    indexes, CHECK constraints, row-level security, append-only audit
--    triggers, least-privilege roles and grants.
--
--    It inserts NO data. Every table starts empty; users sign up through
--    the application.
--
--  HOW TO USE
--    1. Open the Neon console for your project -> SQL Editor.
--    2. Paste this entire file and run it once.
--    3. Read the SECURITY NOTES at the bottom before going to production.
--
--  SAFE TO RE-RUN: the script drops and recreates everything, so it is
--  destructive. On a database that already holds real data, use
--  prisma/security-hardening.sql instead (it only adds protections).
-- ============================================================================

BEGIN;

-- ─── 1. Extensions ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- ─── 2. Reset ───────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public."AuditLog" CASCADE;
DROP TABLE IF EXISTS public."LoginAttempt" CASCADE;
DROP TABLE IF EXISTS public."EmailVerificationToken" CASCADE;
DROP TABLE IF EXISTS public."PasswordResetToken" CASCADE;
DROP TABLE IF EXISTS public."Session" CASCADE;
DROP TABLE IF EXISTS public."Answer" CASCADE;
DROP TABLE IF EXISTS public."Submission" CASCADE;
DROP TABLE IF EXISTS public."Question" CASCADE;
DROP TABLE IF EXISTS public."Test" CASCADE;
DROP TABLE IF EXISTS public."Document" CASCADE;
DROP TABLE IF EXISTS public."RoomMember" CASCADE;
DROP TABLE IF EXISTS public."Room" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
DROP FUNCTION IF EXISTS public.classrank_audit_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.classrank_block_mutation() CASCADE;
DROP FUNCTION IF EXISTS public.classrank_touch_updated_at() CASCADE;
DROP TYPE IF EXISTS public."DocumentStatus" CASCADE;
DROP TYPE IF EXISTS public."TestStatus" CASCADE;
DROP TYPE IF EXISTS public."Role" CASCADE;
DROP TYPE IF EXISTS public."UserStatus" CASCADE;

-- ─── 3. Tables, constraints, indexes, RLS policies and triggers ─────────────
--
-- PostgreSQL database dump
--



SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: DocumentStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DocumentStatus" AS ENUM (
    'PROCESSING',
    'READY',
    'FAILED'
);


--
-- Name: Role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Role" AS ENUM (
    'STUDENT',
    'TEACHER',
    'ADMIN'
);


--
-- Name: TestStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TestStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'CLOSED'
);


--
-- Name: UserStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'SUSPENDED',
    'LOCKED',
    'DELETED'
);


--
-- Name: classrank_audit_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.classrank_audit_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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


--
-- Name: classrank_block_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.classrank_block_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only; % is not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'insufficient_privilege';
END $$;


--
-- Name: classrank_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.classrank_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Answer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Answer" (
    id text NOT NULL,
    "submissionId" text NOT NULL,
    "questionId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "isCorrect" boolean DEFAULT false NOT NULL,
    "selectedAnswer" integer,
    CONSTRAINT answer_selected_range CHECK ((("selectedAnswer" IS NULL) OR (("selectedAnswer" >= 0) AND ("selectedAnswer" <= 3))))
);


--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    "actorId" text,
    "actorEmail" text,
    action text NOT NULL,
    entity text,
    "entityId" text,
    ip text,
    "userAgent" text,
    metadata jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE ONLY public."AuditLog" FORCE ROW LEVEL SECURITY;


--
-- Name: Document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Document" (
    id text NOT NULL,
    "roomId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    status public."DocumentStatus" DEFAULT 'PROCESSING'::public."DocumentStatus" NOT NULL,
    "uploadedBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "chunkCount" integer DEFAULT 0 NOT NULL,
    error text,
    "extractedText" text,
    "fileHash" text,
    "fileSize" integer,
    "mimeType" text,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT document_chunk_count_non_negative CHECK (("chunkCount" >= 0)),
    CONSTRAINT document_file_size_non_negative CHECK ((("fileSize" IS NULL) OR ("fileSize" >= 0))),
    CONSTRAINT document_pdf_only CHECK ((("mimeType" IS NULL) OR ("mimeType" = 'application/pdf'::text)))
);


--
-- Name: EmailVerificationToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailVerificationToken" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: LoginAttempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."LoginAttempt" (
    id text NOT NULL,
    email text NOT NULL,
    ip text,
    "userAgent" text,
    success boolean NOT NULL,
    reason text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT login_attempt_email_length CHECK (((char_length(email) >= 3) AND (char_length(email) <= 254)))
);

ALTER TABLE ONLY public."LoginAttempt" FORCE ROW LEVEL SECURITY;


--
-- Name: PasswordResetToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PasswordResetToken" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tokenHash" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "usedAt" timestamp(3) without time zone,
    ip text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Question" (
    id text NOT NULL,
    "testId" text NOT NULL,
    points integer DEFAULT 1 NOT NULL,
    options jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "correctAnswer" integer NOT NULL,
    difficulty text,
    "questionText" text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT question_correct_answer_range CHECK ((("correctAnswer" >= 0) AND ("correctAnswer" <= 3))),
    CONSTRAINT question_options_is_four_element_array CHECK (((jsonb_typeof(options) = 'array'::text) AND (jsonb_array_length(options) = 4))),
    CONSTRAINT question_points_positive CHECK (((points > 0) AND (points <= 100))),
    CONSTRAINT question_text_length CHECK (((char_length("questionText") >= 1) AND (char_length("questionText") <= 2000)))
);


--
-- Name: Room; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Room" (
    id text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    "teacherId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text,
    subject text,
    "archivedAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT room_code_format CHECK ((code ~ '^[A-Z0-9]{6}$'::text)),
    CONSTRAINT room_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 120)))
);


--
-- Name: RoomMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RoomMember" (
    id text NOT NULL,
    "roomId" text NOT NULL,
    "studentId" text NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "refreshTokenHash" text NOT NULL,
    "familyId" text NOT NULL,
    ip text,
    "userAgent" text,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "revokedReason" text,
    "lastUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT session_expires_after_created CHECK (("expiresAt" > "createdAt"))
);


--
-- Name: Submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    "testId" text NOT NULL,
    "studentId" text NOT NULL,
    "correctAnswers" integer,
    percentage double precision,
    score integer,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    "timeTaken" integer,
    "wrongAnswers" integer,
    "submittedIp" text,
    CONSTRAINT submission_counts_non_negative CHECK (((("correctAnswers" IS NULL) OR ("correctAnswers" >= 0)) AND (("wrongAnswers" IS NULL) OR ("wrongAnswers" >= 0)))),
    CONSTRAINT submission_percentage_range CHECK (((percentage IS NULL) OR ((percentage >= (0)::double precision) AND (percentage <= (100)::double precision)))),
    CONSTRAINT submission_score_non_negative CHECK (((score IS NULL) OR (score >= 0))),
    CONSTRAINT submission_submitted_after_started CHECK ((("submittedAt" IS NULL) OR ("submittedAt" >= "startedAt"))),
    CONSTRAINT submission_time_non_negative CHECK ((("timeTaken" IS NULL) OR ("timeTaken" >= 0)))
);


--
-- Name: Test; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Test" (
    id text NOT NULL,
    title text NOT NULL,
    topic text,
    duration integer,
    difficulty text,
    "roomId" text,
    "creatorId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "documentId" text,
    "publishedAt" timestamp(3) without time zone,
    "questionCount" integer DEFAULT 0 NOT NULL,
    status public."TestStatus" DEFAULT 'DRAFT'::public."TestStatus" NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT test_duration_range CHECK (((duration IS NULL) OR ((duration >= 1) AND (duration <= 600)))),
    CONSTRAINT test_question_count_non_negative CHECK (("questionCount" >= 0)),
    CONSTRAINT test_title_length CHECK (((char_length(title) >= 1) AND (char_length(title) <= 200)))
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    fullname text,
    password text NOT NULL,
    role public."Role" DEFAULT 'STUDENT'::public."Role" NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "emailVerified" boolean DEFAULT false NOT NULL,
    "emailVerifiedAt" timestamp(3) without time zone,
    "failedLoginAttempts" integer DEFAULT 0 NOT NULL,
    "lastFailedLoginAt" timestamp(3) without time zone,
    "lastLoginAt" timestamp(3) without time zone,
    "lastLoginIp" text,
    "lockedUntil" timestamp(3) without time zone,
    "mustChangePassword" boolean DEFAULT false NOT NULL,
    "passwordChangedAt" timestamp(3) without time zone,
    status public."UserStatus" DEFAULT 'ACTIVE'::public."UserStatus" NOT NULL,
    "tokenVersion" integer DEFAULT 0 NOT NULL,
    "twoFactorEnabled" boolean DEFAULT false NOT NULL,
    "twoFactorSecret" text,
    CONSTRAINT user_email_format CHECK ((email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'::text)),
    CONSTRAINT user_email_length CHECK (((char_length(email) >= 3) AND (char_length(email) <= 254))),
    CONSTRAINT user_email_lowercase CHECK ((email = lower(email))),
    CONSTRAINT user_failed_attempts_non_negative CHECK (("failedLoginAttempts" >= 0)),
    CONSTRAINT user_password_bcrypt CHECK ((password ~ '^\$2[aby]\$[0-9]{2}\$'::text)),
    CONSTRAINT user_token_version_non_negative CHECK (("tokenVersion" >= 0))
);


--
-- Name: Answer Answer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Answer"
    ADD CONSTRAINT "Answer_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Document Document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_pkey" PRIMARY KEY (id);


--
-- Name: EmailVerificationToken EmailVerificationToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY (id);


--
-- Name: LoginAttempt LoginAttempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."LoginAttempt"
    ADD CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY (id);


--
-- Name: PasswordResetToken PasswordResetToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY (id);


--
-- Name: Question Question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_pkey" PRIMARY KEY (id);


--
-- Name: RoomMember RoomMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoomMember"
    ADD CONSTRAINT "RoomMember_pkey" PRIMARY KEY (id);


--
-- Name: Room Room_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Room"
    ADD CONSTRAINT "Room_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- Name: Test Test_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Test"
    ADD CONSTRAINT "Test_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Answer_questionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Answer_questionId_idx" ON public."Answer" USING btree ("questionId");


--
-- Name: Answer_submissionId_questionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Answer_submissionId_questionId_key" ON public."Answer" USING btree ("submissionId", "questionId");


--
-- Name: AuditLog_action_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_action_createdAt_idx" ON public."AuditLog" USING btree (action, "createdAt");


--
-- Name: AuditLog_actorId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_actorId_createdAt_idx" ON public."AuditLog" USING btree ("actorId", "createdAt");


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_entity_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AuditLog_entity_entityId_idx" ON public."AuditLog" USING btree (entity, "entityId");


--
-- Name: Document_roomId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_roomId_idx" ON public."Document" USING btree ("roomId");


--
-- Name: Document_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_status_idx" ON public."Document" USING btree (status);


--
-- Name: Document_uploadedBy_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Document_uploadedBy_idx" ON public."Document" USING btree ("uploadedBy");


--
-- Name: EmailVerificationToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON public."EmailVerificationToken" USING btree ("expiresAt");


--
-- Name: EmailVerificationToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON public."EmailVerificationToken" USING btree ("tokenHash");


--
-- Name: EmailVerificationToken_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailVerificationToken_userId_idx" ON public."EmailVerificationToken" USING btree ("userId");


--
-- Name: LoginAttempt_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginAttempt_createdAt_idx" ON public."LoginAttempt" USING btree ("createdAt");


--
-- Name: LoginAttempt_email_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginAttempt_email_createdAt_idx" ON public."LoginAttempt" USING btree (email, "createdAt");


--
-- Name: LoginAttempt_ip_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "LoginAttempt_ip_createdAt_idx" ON public."LoginAttempt" USING btree (ip, "createdAt");


--
-- Name: PasswordResetToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordResetToken_expiresAt_idx" ON public."PasswordResetToken" USING btree ("expiresAt");


--
-- Name: PasswordResetToken_tokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON public."PasswordResetToken" USING btree ("tokenHash");


--
-- Name: PasswordResetToken_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordResetToken_userId_idx" ON public."PasswordResetToken" USING btree ("userId");


--
-- Name: Question_testId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Question_testId_idx" ON public."Question" USING btree ("testId");


--
-- Name: RoomMember_roomId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RoomMember_roomId_studentId_key" ON public."RoomMember" USING btree ("roomId", "studentId");


--
-- Name: RoomMember_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoomMember_studentId_idx" ON public."RoomMember" USING btree ("studentId");


--
-- Name: Room_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Room_code_key" ON public."Room" USING btree (code);


--
-- Name: Room_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Room_createdAt_idx" ON public."Room" USING btree ("createdAt");


--
-- Name: Room_teacherId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Room_teacherId_idx" ON public."Room" USING btree ("teacherId");


--
-- Name: Session_expiresAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_expiresAt_idx" ON public."Session" USING btree ("expiresAt");


--
-- Name: Session_familyId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_familyId_idx" ON public."Session" USING btree ("familyId");


--
-- Name: Session_refreshTokenHash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON public."Session" USING btree ("refreshTokenHash");


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: Submission_studentId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_studentId_idx" ON public."Submission" USING btree ("studentId");


--
-- Name: Submission_submittedAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_submittedAt_idx" ON public."Submission" USING btree ("submittedAt");


--
-- Name: Submission_testId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_testId_idx" ON public."Submission" USING btree ("testId");


--
-- Name: Submission_testId_studentId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Submission_testId_studentId_key" ON public."Submission" USING btree ("testId", "studentId");


--
-- Name: Test_creatorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Test_creatorId_idx" ON public."Test" USING btree ("creatorId");


--
-- Name: Test_roomId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Test_roomId_idx" ON public."Test" USING btree ("roomId");


--
-- Name: Test_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Test_status_idx" ON public."Test" USING btree (status);


--
-- Name: User_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_createdAt_idx" ON public."User" USING btree ("createdAt");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: User_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_status_idx" ON public."User" USING btree (status);


--
-- Name: AuditLog audit_log_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_log_append_only BEFORE DELETE OR UPDATE ON public."AuditLog" FOR EACH ROW EXECUTE FUNCTION public.classrank_block_mutation();


--
-- Name: Document classrank_audit_document; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_audit_document AFTER INSERT OR DELETE OR UPDATE ON public."Document" FOR EACH ROW EXECUTE FUNCTION public.classrank_audit_trigger();


--
-- Name: Question classrank_audit_question; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_audit_question AFTER INSERT OR DELETE OR UPDATE ON public."Question" FOR EACH ROW EXECUTE FUNCTION public.classrank_audit_trigger();


--
-- Name: Room classrank_audit_room; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_audit_room AFTER INSERT OR DELETE OR UPDATE ON public."Room" FOR EACH ROW EXECUTE FUNCTION public.classrank_audit_trigger();


--
-- Name: RoomMember classrank_audit_roommember; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_audit_roommember AFTER INSERT OR DELETE OR UPDATE ON public."RoomMember" FOR EACH ROW EXECUTE FUNCTION public.classrank_audit_trigger();


--
-- Name: Submission classrank_audit_submission; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_audit_submission AFTER INSERT OR DELETE OR UPDATE ON public."Submission" FOR EACH ROW EXECUTE FUNCTION public.classrank_audit_trigger();


--
-- Name: Test classrank_audit_test; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_audit_test AFTER INSERT OR DELETE OR UPDATE ON public."Test" FOR EACH ROW EXECUTE FUNCTION public.classrank_audit_trigger();


--
-- Name: User classrank_audit_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_audit_user AFTER INSERT OR DELETE OR UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.classrank_audit_trigger();


--
-- Name: Document classrank_touch_document; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_touch_document BEFORE UPDATE ON public."Document" FOR EACH ROW EXECUTE FUNCTION public.classrank_touch_updated_at();


--
-- Name: Question classrank_touch_question; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_touch_question BEFORE UPDATE ON public."Question" FOR EACH ROW EXECUTE FUNCTION public.classrank_touch_updated_at();


--
-- Name: Room classrank_touch_room; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_touch_room BEFORE UPDATE ON public."Room" FOR EACH ROW EXECUTE FUNCTION public.classrank_touch_updated_at();


--
-- Name: Test classrank_touch_test; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_touch_test BEFORE UPDATE ON public."Test" FOR EACH ROW EXECUTE FUNCTION public.classrank_touch_updated_at();


--
-- Name: User classrank_touch_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER classrank_touch_user BEFORE UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.classrank_touch_updated_at();


--
-- Name: LoginAttempt login_attempt_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER login_attempt_append_only BEFORE DELETE OR UPDATE ON public."LoginAttempt" FOR EACH ROW EXECUTE FUNCTION public.classrank_block_mutation();


--
-- Name: Answer Answer_questionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Answer"
    ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public."Question"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Answer Answer_submissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Answer"
    ADD CONSTRAINT "Answer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."Submission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_actorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Document Document_roomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES public."Room"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Document Document_uploadedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Document"
    ADD CONSTRAINT "Document_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: EmailVerificationToken EmailVerificationToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PasswordResetToken PasswordResetToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordResetToken"
    ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Question Question_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RoomMember RoomMember_roomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoomMember"
    ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES public."Room"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RoomMember RoomMember_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoomMember"
    ADD CONSTRAINT "RoomMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Room Room_teacherId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Room"
    ADD CONSTRAINT "Room_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Submission Submission_studentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Submission Submission_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Test Test_creatorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Test"
    ADD CONSTRAINT "Test_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Test Test_documentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Test"
    ADD CONSTRAINT "Test_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES public."Document"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Test Test_roomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Test"
    ADD CONSTRAINT "Test_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES public."Room"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Answer; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Answer" ENABLE ROW LEVEL SECURITY;

--
-- Name: Answer Answer_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Answer_app_full" ON public."Answer" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: AuditLog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."AuditLog" ENABLE ROW LEVEL SECURITY;

--
-- Name: Document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;

--
-- Name: Document Document_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Document_app_full" ON public."Document" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: EmailVerificationToken; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."EmailVerificationToken" ENABLE ROW LEVEL SECURITY;

--
-- Name: EmailVerificationToken EmailVerificationToken_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "EmailVerificationToken_app_full" ON public."EmailVerificationToken" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: LoginAttempt; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."LoginAttempt" ENABLE ROW LEVEL SECURITY;

--
-- Name: LoginAttempt LoginAttempt_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "LoginAttempt_app_full" ON public."LoginAttempt" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: PasswordResetToken; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."PasswordResetToken" ENABLE ROW LEVEL SECURITY;

--
-- Name: PasswordResetToken PasswordResetToken_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "PasswordResetToken_app_full" ON public."PasswordResetToken" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: Question; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Question" ENABLE ROW LEVEL SECURITY;

--
-- Name: Question Question_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Question_app_full" ON public."Question" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: Room; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Room" ENABLE ROW LEVEL SECURITY;

--
-- Name: RoomMember; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."RoomMember" ENABLE ROW LEVEL SECURITY;

--
-- Name: RoomMember RoomMember_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "RoomMember_app_full" ON public."RoomMember" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: Room Room_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Room_app_full" ON public."Room" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: Session; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Session" ENABLE ROW LEVEL SECURITY;

--
-- Name: Session Session_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Session_app_full" ON public."Session" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: Submission; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Submission" ENABLE ROW LEVEL SECURITY;

--
-- Name: Submission Submission_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Submission_app_full" ON public."Submission" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: Test; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."Test" ENABLE ROW LEVEL SECURITY;

--
-- Name: Test Test_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Test_app_full" ON public."Test" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: User; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;

--
-- Name: User User_app_full; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "User_app_full" ON public."User" TO classrank_app USING (true) WITH CHECK (true);


--
-- Name: AuditLog audit_app_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_app_insert ON public."AuditLog" FOR INSERT TO classrank_app WITH CHECK (true);


--
-- Name: AuditLog audit_app_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_app_select ON public."AuditLog" FOR SELECT TO classrank_app USING (true);


--
-- Name: AuditLog audit_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_insert ON public."AuditLog" FOR INSERT WITH CHECK (true);


--
-- Name: AuditLog audit_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_select ON public."AuditLog" FOR SELECT USING (true);


--
-- Name: LoginAttempt login_attempt_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY login_attempt_insert ON public."LoginAttempt" FOR INSERT WITH CHECK (true);


--
-- Name: LoginAttempt login_attempt_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY login_attempt_select ON public."LoginAttempt" FOR SELECT USING (true);


--
-- PostgreSQL database dump complete
--

-- ─── 4. Least-privilege roles ───────────────────────────────────────────────
--  Rotate these passwords immediately. They are random placeholders, but the
--  real values belong in a secret manager, never in this file.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_app') THEN
    CREATE ROLE classrank_app LOGIN PASSWORD 'JTf6UIdYPIBCNhSqQeXIATHdWF6qYPBN'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_readonly') THEN
    CREATE ROLE classrank_readonly LOGIN PASSWORD 'seKHUYMgauiCfh8Pf2X22u72lO-iL_Mo'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping role creation (insufficient privilege on this plan).';
END $$;

-- Nobody may create objects in the public schema.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ─── 5. Grants ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  t text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_app') THEN
    GRANT USAGE ON SCHEMA public TO classrank_app;
    FOREACH t IN ARRAY ARRAY[
      'User', 'Room', 'RoomMember', 'Document', 'Test', 'Question',
      'Submission', 'Answer', 'Session', 'PasswordResetToken', 'EmailVerificationToken'
    ] LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO classrank_app', t);
    END LOOP;
    -- Audit + login history: append and read only, never rewrite.
    GRANT SELECT, INSERT ON public."AuditLog" TO classrank_app;
    GRANT SELECT, INSERT ON public."LoginAttempt" TO classrank_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON public."AuditLog" FROM classrank_app;
    REVOKE UPDATE, DELETE, TRUNCATE ON public."LoginAttempt" FROM classrank_app;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'classrank_readonly') THEN
    GRANT USAGE ON SCHEMA public TO classrank_readonly;
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM classrank_readonly;
    GRANT SELECT ON public."Room", public."RoomMember", public."Test",
                    public."Question", public."Submission", public."Answer",
                    public."Document", public."LoginAttempt", public."AuditLog"
      TO classrank_readonly;
    -- Only non-secret columns of User: no password, no 2FA secret.
    GRANT SELECT (id, email, fullname, role, status, "emailVerified",
                  "emailVerifiedAt", "createdAt", "updatedAt", "deletedAt")
      ON public."User" TO classrank_readonly;
    -- Session/token internals are never visible to reporting.
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
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO classrank_readonly;
  END IF;
END $$;

COMMIT;

-- ─── 6. Verification ────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE')       AS tables,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')         AS rls_policies,
  (SELECT count(*) FROM pg_trigger
     WHERE NOT tgisinternal AND tgname LIKE 'classrank_%')              AS security_triggers,
  (SELECT count(*) FROM pg_constraint
     WHERE contype = 'c' AND connamespace = 'public'::regnamespace)     AS check_constraints,
  (SELECT count(*) FROM pg_roles WHERE rolname LIKE 'classrank%')        AS roles;

-- Expected: 13 tables, 18 RLS policies, 12 classrank_* security triggers
--           (plus 2 append-only triggers on AuditLog/LoginAttempt),
--           ~26 CHECK constraints, 2 roles.

-- Every table must be empty.
SELECT
  (SELECT count(*) FROM public."User")        AS users,
  (SELECT count(*) FROM public."Room")        AS rooms,
  (SELECT count(*) FROM public."Test")        AS tests,
  (SELECT count(*) FROM public."Submission")  AS submissions,
  (SELECT count(*) FROM public."AuditLog")    AS audit_logs;

-- ─── 7. SECURITY NOTES (read before production) ─────────────────────────────
--
--  * Point DATABASE_URL at classrank_app (not the owner role). The owner
--    bypasses RLS; classrank_app does not, and it cannot rewrite the audit
--    trail. Set the password you want and store it in a secret manager.
--
--  * AuditLog and LoginAttempt are append-only. A BEFORE DELETE trigger
--    blocks row-level deletion for every role, including the owner. To purge
--    (retention/GDPR), use the supported path in prisma/wipe-data.sql or:
--        ALTER TABLE public."AuditLog" DISABLE TRIGGER audit_log_append_only;
--        DELETE FROM public."AuditLog" WHERE ...;
--        ALTER TABLE public."AuditLog" ENABLE  TRIGGER audit_log_append_only;
--
--  * The application sets `app.current_user_id` when writing so the audit
--    trigger can attribute changes. Without it, actorId stays NULL.
--
--  * CHECK constraints enforce the invariants the API relies on: lower-case
--    emails, bcrypt-format password hashes, 6-character upper-case room codes,
--    0-3 answer indexes, 0-100 percentages, 4-option questions, PDF-only
--    documents. Invalid rows are impossible even via raw SQL.
--
-- ===========================================================================