-- Clean everything - leave database completely empty
BEGIN;

DELETE FROM public."Answer";
DELETE FROM public."Submission";
DELETE FROM public."Question";
DELETE FROM public."Document";
DELETE FROM public."Test";
DELETE FROM public."RoomMember";
DELETE FROM public."Room";
DELETE FROM public."User";

COMMIT;

-- Verify all empty
SELECT 
  (SELECT count(*) FROM public."User")        AS users,
  (SELECT count(*) FROM public."Room")        AS rooms,
  (SELECT count(*) FROM public."Test")        AS tests,
  (SELECT count(*) FROM public."Submission")  AS submissions,
  (SELECT count(*) FROM public."Answer")      AS answers,
  (SELECT count(*) FROM public."Document")    AS documents,
  (SELECT count(*) FROM public."Question")    AS questions;