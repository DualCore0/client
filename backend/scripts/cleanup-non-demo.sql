-- Cleanup: remove all non-demo data, keep only demo room K7M4P2 and 6 demo users

BEGIN;

-- Delete answers for submissions in non-demo tests
DELETE FROM public."Answer"
WHERE "submissionId" IN (
  SELECT id FROM public."Submission"
  WHERE "testId" IN (
    SELECT id FROM public."Test"
    WHERE "roomId" IN (
      SELECT id FROM public."Room" WHERE code != 'K7M4P2'
    )
  )
);

-- Delete submissions for non-demo tests
DELETE FROM public."Submission"
WHERE "testId" IN (
  SELECT id FROM public."Test"
  WHERE "roomId" IN (
    SELECT id FROM public."Room" WHERE code != 'K7M4P2'
  )
);

-- Delete questions for non-demo tests
DELETE FROM public."Question"
WHERE "testId" IN (
  SELECT id FROM public."Test"
  WHERE "roomId" IN (
    SELECT id FROM public."Room" WHERE code != 'K7M4P2'
  )
);

-- Delete non-demo tests
DELETE FROM public."Test"
WHERE "roomId" IN (
  SELECT id FROM public."Room" WHERE code != 'K7M4P2'
);

-- Delete documents in non-demo rooms
DELETE FROM public."Document"
WHERE "roomId" IN (
  SELECT id FROM public."Room" WHERE code != 'K7M4P2'
);

-- Delete room members in non-demo rooms
DELETE FROM public."RoomMember"
WHERE "roomId" IN (
  SELECT id FROM public."Room" WHERE code != 'K7M4P2'
);

-- Delete non-demo rooms
DELETE FROM public."Room" WHERE code != 'K7M4P2';

-- Delete non-demo users
DELETE FROM public."User"
WHERE email NOT IN (
  'teacher@demo.com',
  'student1@demo.com',
  'student2@demo.com',
  'student3@demo.com',
  'student4@demo.com',
  'student5@demo.com'
);

COMMIT;

-- Verify
SELECT 'users' AS table_name, count(*) FROM public."User"
UNION ALL SELECT 'rooms', count(*) FROM public."Room"
UNION ALL SELECT 'tests', count(*) FROM public."Test"
UNION ALL SELECT 'submissions', count(*) FROM public."Submission"
UNION ALL SELECT 'answers', count(*) FROM public."Answer";