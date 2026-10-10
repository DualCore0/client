-- ============================================================================
--  ClassRank — wipe all data, keep the schema
-- ============================================================================
--
--  Removes every row (users, rooms, tests, submissions, audit trail, ...) so the
--  database is empty and ready for real users to sign up.
--
--  TRUNCATE is used deliberately: the append-only audit tables have a
--  BEFORE DELETE row trigger that blocks row-level deletion (that is the
--  tamper-evidence guarantee). TRUNCATE does not fire row triggers, so it is the
--  supported way to perform a full reset. It is destructive and cannot be
--  undone — take a backup first in production.
-- ============================================================================

BEGIN;

TRUNCATE TABLE
  public."Answer",
  public."Submission",
  public."Question",
  public."Test",
  public."Document",
  public."RoomMember",
  public."Room",
  public."Session",
  public."PasswordResetToken",
  public."EmailVerificationToken",
  public."AuditLog",
  public."LoginAttempt",
  public."User"
RESTART IDENTITY CASCADE;

COMMIT;

-- Verification: everything must be zero.
SELECT
  (SELECT count(*) FROM public."User")                   AS users,
  (SELECT count(*) FROM public."Room")                   AS rooms,
  (SELECT count(*) FROM public."RoomMember")             AS members,
  (SELECT count(*) FROM public."Test")                   AS tests,
  (SELECT count(*) FROM public."Question")               AS questions,
  (SELECT count(*) FROM public."Submission")             AS submissions,
  (SELECT count(*) FROM public."Answer")                 AS answers,
  (SELECT count(*) FROM public."Document")               AS documents,
  (SELECT count(*) FROM public."Session")                AS sessions,
  (SELECT count(*) FROM public."LoginAttempt")           AS login_attempts,
  (SELECT count(*) FROM public."AuditLog")               AS audit_logs,
  (SELECT count(*) FROM public."PasswordResetToken")     AS reset_tokens,
  (SELECT count(*) FROM public."EmailVerificationToken") AS verification_tokens;
