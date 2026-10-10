-- ============================================================================
--  ClassRank — schema + default dataset for the Neon SQL console
-- ============================================================================
--
--  HOW TO USE
--    1. Open the Neon console for your project and select the SQL Editor.
--    2. Paste this entire file and run it.
--
--  Behaviour: creates anything missing and inserts the default rows.
--             Existing rows are left untouched.
--
--  DEFAULT LOGINS (password for every account: password123)
--    Teacher  teacher@demo.com
--    Student  student1@demo.com … student5@demo.com
--
--  DEMO ROOM
--    BCA 5th Semester - DBMS   code: K7M4P2
--
--  The script is idempotent: running it twice produces the same data.
--  The password hashes below are bcrypt hashes of "password123".
-- ============================================================================

BEGIN;

-- ─── 1. Schema (skipped tables that already exist) ─────────────────────────
-- Run the full script (without --no-drop) to recreate everything from scratch.

DO $$ BEGIN
  CREATE TYPE public."Role" AS ENUM ('STUDENT', 'TEACHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."TestStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public."DocumentStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 3. Users ───────────────────────────────────────────────────────────────
INSERT INTO public."User" (id, email, fullname, password, role, "createdAt", "updatedAt") VALUES
  ('demo-user-teacher', 'teacher@demo.com', 'Prof. Jordan', '$2b$10$IyiqJUZnpS423rHC4iASoeR1F2qCEDW2rfJ/ntSRnyfRvtRNzB2DK', 'TEACHER', NOW(), NOW()),
  ('demo-user-student1', 'student1@demo.com', 'Alice Smith', '$2b$10$IyiqJUZnpS423rHC4iASoeR1F2qCEDW2rfJ/ntSRnyfRvtRNzB2DK', 'STUDENT', NOW() - INTERVAL '20 days', NOW()),
  ('demo-user-student2', 'student2@demo.com', 'Bob Jones', '$2b$10$IyiqJUZnpS423rHC4iASoeR1F2qCEDW2rfJ/ntSRnyfRvtRNzB2DK', 'STUDENT', NOW() - INTERVAL '19 days', NOW()),
  ('demo-user-student3', 'student3@demo.com', 'Charlie Brown', '$2b$10$IyiqJUZnpS423rHC4iASoeR1F2qCEDW2rfJ/ntSRnyfRvtRNzB2DK', 'STUDENT', NOW() - INTERVAL '18 days', NOW()),
  ('demo-user-student4', 'student4@demo.com', 'Diana Prince', '$2b$10$IyiqJUZnpS423rHC4iASoeR1F2qCEDW2rfJ/ntSRnyfRvtRNzB2DK', 'STUDENT', NOW() - INTERVAL '17 days', NOW()),
  ('demo-user-student5', 'student5@demo.com', 'Eve Adams', '$2b$10$IyiqJUZnpS423rHC4iASoeR1F2qCEDW2rfJ/ntSRnyfRvtRNzB2DK', 'STUDENT', NOW() - INTERVAL '16 days', NOW())
ON CONFLICT (email) DO UPDATE SET
  fullname = EXCLUDED.fullname,
  password = EXCLUDED.password,
  role     = EXCLUDED.role;

-- ─── 4. Demo room (code K7M4P2) ─────────────────────────────────────────────
INSERT INTO public."Room" (id, code, name, subject, description, "teacherId", "createdAt") VALUES
  ('demo-room-dbms', 'K7M4P2', 'BCA 5th Semester - DBMS', 'Computer Science', 'Database Management Systems', 'demo-user-teacher', NOW() - INTERVAL '30 days')
ON CONFLICT (code) DO UPDATE SET
  name        = EXCLUDED.name,
  subject     = EXCLUDED.subject,
  description = EXCLUDED.description;

-- ─── 5. Room membership ─────────────────────────────────────────────────────
INSERT INTO public."RoomMember" (id, "roomId", "studentId", "joinedAt")
SELECT 'demo-member-' || u.id, 'demo-room-dbms', u.id, NOW() - INTERVAL '25 days'
FROM public."User" u
WHERE u.email LIKE 'student%@demo.com'
ON CONFLICT ("roomId", "studentId") DO NOTHING;

-- ─── 6. Tests ───────────────────────────────────────────────────────────────
INSERT INTO public."Test" (id, title, topic, duration, "questionCount", difficulty, status, "roomId", "creatorId", "createdAt", "publishedAt") VALUES
  ('demo-test-week1', 'Week 1: Intro to Databases', 'Databases', 15, 5, 'EASY',   'PUBLISHED', 'demo-room-dbms', 'demo-user-teacher', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')
  , ('demo-test-pop1', 'Pop Quiz 1', 'Normalization & keys', 5, 3, 'MEDIUM', 'PUBLISHED', 'demo-room-dbms', 'demo-user-teacher', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')
  , ('demo-test-pop2', 'Pop Quiz 2', 'Normalization & keys', 5, 3, 'MEDIUM', 'PUBLISHED', 'demo-room-dbms', 'demo-user-teacher', NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days')
  , ('demo-test-pop3', 'Pop Quiz 3', 'Normalization & keys', 5, 3, 'MEDIUM', 'PUBLISHED', 'demo-room-dbms', 'demo-user-teacher', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  title         = EXCLUDED.title,
  duration      = EXCLUDED.duration,
  "questionCount" = EXCLUDED."questionCount",
  status        = EXCLUDED.status,
  "publishedAt" = EXCLUDED."publishedAt";

-- ─── 7. Questions ───────────────────────────────────────────────────────────
INSERT INTO public."Question" (id, "testId", "questionText", options, "correctAnswer", difficulty, points) VALUES
  ('demo-q-week1-0', 'demo-test-week1', 'What does SQL stand for?', '["Structured Query Language","Strong Question Language","Structured Question Language","None of the above"]'::jsonb, 0, 'EASY', 1),
  ('demo-q-week1-1', 'demo-test-week1', 'Which is a NoSQL database?', '["MySQL","PostgreSQL","MongoDB","Oracle"]'::jsonb, 2, 'EASY', 1),
  ('demo-q-week1-2', 'demo-test-week1', 'What is a primary key?', '["A key to a room","Unique identifier for a record","A foreign key","A data type"]'::jsonb, 1, 'EASY', 1),
  ('demo-q-week1-3', 'demo-test-week1', 'What does DBMS stand for?', '["Database Management System","Data Base Management System","Data Board Management System","None of the above"]'::jsonb, 0, 'EASY', 1),
  ('demo-q-week1-4', 'demo-test-week1', 'Which command is used to fetch data?', '["GET","FETCH","SELECT","PULL"]'::jsonb, 2, 'EASY', 1),
  ('demo-q-pop1-0', 'demo-test-pop1', 'Which normal form removes partial dependency?', '["1NF","2NF","3NF","BCNF"]'::jsonb, 1, 'MEDIUM', 1),
  ('demo-q-pop1-1', 'demo-test-pop1', 'Which key references another table?', '["Primary key","Foreign key","Candidate key","Super key"]'::jsonb, 1, 'MEDIUM', 1),
  ('demo-q-pop1-2', 'demo-test-pop1', 'Which property guarantees a committed transaction survives a crash?', '["Atomicity","Consistency","Isolation","Durability"]'::jsonb, 3, 'MEDIUM', 1),
  ('demo-q-pop2-0', 'demo-test-pop2', 'Which normal form removes partial dependency?', '["1NF","2NF","3NF","BCNF"]'::jsonb, 1, 'MEDIUM', 1),
  ('demo-q-pop2-1', 'demo-test-pop2', 'Which key references another table?', '["Primary key","Foreign key","Candidate key","Super key"]'::jsonb, 1, 'MEDIUM', 1),
  ('demo-q-pop2-2', 'demo-test-pop2', 'Which property guarantees a committed transaction survives a crash?', '["Atomicity","Consistency","Isolation","Durability"]'::jsonb, 3, 'MEDIUM', 1),
  ('demo-q-pop3-0', 'demo-test-pop3', 'Which normal form removes partial dependency?', '["1NF","2NF","3NF","BCNF"]'::jsonb, 1, 'MEDIUM', 1),
  ('demo-q-pop3-1', 'demo-test-pop3', 'Which key references another table?', '["Primary key","Foreign key","Candidate key","Super key"]'::jsonb, 1, 'MEDIUM', 1),
  ('demo-q-pop3-2', 'demo-test-pop3', 'Which property guarantees a committed transaction survives a crash?', '["Atomicity","Consistency","Isolation","Durability"]'::jsonb, 3, 'MEDIUM', 1)
ON CONFLICT (id) DO UPDATE SET
  "questionText"  = EXCLUDED."questionText",
  options         = EXCLUDED.options,
  "correctAnswer" = EXCLUDED."correctAnswer";

-- ─── 8. Attempts (populate the leaderboards) ────────────────────────────────
--   Deterministic scores so the room and weekly boards are never empty.
INSERT INTO public."Submission" (id, "testId", "studentId", score, percentage, "correctAnswers", "wrongAnswers", "timeTaken", "startedAt", "submittedAt")
SELECT
  'demo-sub-' || t.id || '-' || u.id,
  t.id,
  u.id,
  LEAST(g.seed, t."questionCount")                                        AS score,
  ROUND((LEAST(g.seed, t."questionCount")::numeric / t."questionCount") * 100, 2) AS percentage,
  LEAST(g.seed, t."questionCount")                                        AS "correctAnswers",
  t."questionCount" - LEAST(g.seed, t."questionCount")                     AS "wrongAnswers",
  300                                                                     AS "timeTaken",
  t."publishedAt",
  t."publishedAt" + INTERVAL '5 minutes'                                 AS "submittedAt"
FROM public."Test" t
JOIN public."Room" r ON r.id = t."roomId"
CROSS JOIN public."User" u
CROSS JOIN LATERAL (
  SELECT (CASE
    WHEN u.email = 'student1@demo.com' THEN rpad('1', t."questionCount", '1')::bigint
    WHEN u.email = 'student2@demo.com' THEN rpad('3', t."questionCount", '3')::bigint
    WHEN u.email = 'student3@demo.com' THEN rpad('2', t."questionCount", '2')::bigint
    WHEN u.email = 'student4@demo.com' THEN rpad('4', t."questionCount", '4')::bigint
    WHEN u.email = 'student5@demo.com' THEN rpad('5', t."questionCount", '5')::bigint
    ELSE 1 END) % (t."questionCount" + 1) AS seed
) g
WHERE u.email LIKE 'student%@demo.com'
  AND t."roomId" = 'demo-room-dbms'
ON CONFLICT ("testId", "studentId") DO NOTHING;

-- ─── 9. Per-question answers (needed for accuracy and answer review) ────────
INSERT INTO public."Answer" (id, "submissionId", "questionId", "selectedAnswer", "isCorrect", "createdAt")
SELECT
  'demo-ans-' || s.id || '-' || q.id,
  s.id,
  q.id,
  -- correct option for the first N questions, otherwise the next option along
  CASE WHEN row_number() OVER (PARTITION BY s.id ORDER BY q."createdAt", q.id) <= s."correctAnswers"
       THEN q."correctAnswer"
       ELSE (q."correctAnswer" + 1) % 4 END,
  row_number() OVER (PARTITION BY s.id ORDER BY q."createdAt", q.id) <= s."correctAnswers",
  s."submittedAt"
FROM public."Submission" s
JOIN public."Question" q ON q."testId" = s."testId"
WHERE s.id LIKE 'demo-sub-%'
ON CONFLICT ("submissionId", "questionId") DO NOTHING;

COMMIT;

-- ─── Verification ───────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public."User")        AS users,
  (SELECT count(*) FROM public."Room")        AS rooms,
  (SELECT count(*) FROM public."RoomMember")  AS members,
  (SELECT count(*) FROM public."Test")        AS tests,
  (SELECT count(*) FROM public."Question")    AS questions,
  (SELECT count(*) FROM public."Submission")  AS attempts,
  (SELECT count(*) FROM public."Answer")      AS answers;

-- Expected on a clean run: 6 users, 1 room, 5 members, 4 tests, 14 questions, 20 attempts, 70 answers.

SELECT u."fullname", u.email, u.role FROM public."User" u ORDER BY u.role DESC, u.email;

SELECT r.code, r.name, count(DISTINCT m."studentId") AS students, count(DISTINCT t.id) AS tests
FROM public."Room" r
LEFT JOIN public."RoomMember" m ON m."roomId" = r.id
LEFT JOIN public."Test" t ON t."roomId" = r.id
GROUP BY r.code, r.name;

-- Room leaderboard preview (average percentage per student)
SELECT u."fullname", ROUND(AVG(s.percentage)::numeric, 2) AS avg_percentage, count(*) AS tests_completed
FROM public."Submission" s
JOIN public."User" u ON u.id = s."studentId"
WHERE s."submittedAt" IS NOT NULL
GROUP BY u."fullname"
ORDER BY avg_percentage DESC;
