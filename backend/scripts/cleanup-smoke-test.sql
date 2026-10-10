-- Remove the smoke test leftover test
BEGIN;

DELETE FROM public."Answer"
WHERE "submissionId" IN (
  SELECT id FROM public."Submission"
  WHERE "testId" = (SELECT id FROM public."Test" WHERE title = 'Test on Relational databases')
);

DELETE FROM public."Submission"
WHERE "testId" = (SELECT id FROM public."Test" WHERE title = 'Test on Relational databases');

DELETE FROM public."Question"
WHERE "testId" = (SELECT id FROM public."Test" WHERE title = 'Test on Relational databases');

DELETE FROM public."Test"
WHERE title = 'Test on Relational databases';

COMMIT;