/**
 * Generates backend/prisma/classrank-neon.sql — a self-contained script for the
 * Neon SQL console that recreates the ClassRank schema and loads the default
 * dataset (demo teacher, students, room, tests, questions and attempts).
 *
 *   node scripts/build-neon-sql.mjs          # DROP + recreate + seed
 *   node scripts/build-neon-sql.mjs --no-drop # seed only (keep current data)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import bcrypt from 'bcrypt';

const here = (p) => new URL(p, import.meta.url);
const noDrop = process.argv.includes('--no-drop');

/* ── bcrypt hash for the shared demo password ───────────────── */
const DEMO_PASSWORD = 'password123';
const PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);

/* ── schema: reuse the pg_dump output, minus psql-only artefacts ─ */
let schema = readFileSync(here('./schema-dump.sql'), 'utf8');
schema = schema
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
  .trim();

/* ── default dataset ────────────────────────────────────────── */

const STUDENTS = [
  ['demo-user-student1', 'student1@demo.com', 'Alice Smith'],
  ['demo-user-student2', 'student2@demo.com', 'Bob Jones'],
  ['demo-user-student3', 'student3@demo.com', 'Charlie Brown'],
  ['demo-user-student4', 'student4@demo.com', 'Diana Prince'],
  ['demo-user-student5', 'student5@demo.com', 'Eve Adams'],
];

const WEEK1_QUESTIONS = [
  ['What does SQL stand for?', ['Structured Query Language', 'Strong Question Language', 'Structured Question Language', 'None of the above'], 0],
  ['Which is a NoSQL database?', ['MySQL', 'PostgreSQL', 'MongoDB', 'Oracle'], 2],
  ['What is a primary key?', ['A key to a room', 'Unique identifier for a record', 'A foreign key', 'A data type'], 1],
  ['What does DBMS stand for?', ['Database Management System', 'Data Base Management System', 'Data Board Management System', 'None of the above'], 0],
  ['Which command is used to fetch data?', ['GET', 'FETCH', 'SELECT', 'PULL'], 2],
];

const POP_QUIZ_QUESTIONS = [
  ['Which normal form removes partial dependency?', ['1NF', '2NF', '3NF', 'BCNF'], 1],
  ['Which key references another table?', ['Primary key', 'Foreign key', 'Candidate key', 'Super key'], 1],
  ['Which property guarantees a committed transaction survives a crash?', ['Atomicity', 'Consistency', 'Isolation', 'Durability'], 3],
];

const q = (value) => `'${String(value).replace(/'/g, "''")}'`;
const jsonOptions = (options) => `${q(JSON.stringify(options))}::jsonb`;

const lines = [];
const push = (...values) => lines.push(...values);

/* ── header ─────────────────────────────────────────────────── */
push(
  '-- ============================================================================',
  '--  ClassRank — schema + default dataset for the Neon SQL console',
  '-- ============================================================================',
  '--',
  '--  HOW TO USE',
  '--    1. Open the Neon console for your project and select the SQL Editor.',
  '--    2. Paste this entire file and run it.',
  '--',
  noDrop
    ? '--  Behaviour: creates anything missing and inserts the default rows.'
    : '--  Behaviour: DROPS every ClassRank table, recreates the schema, then loads',
  noDrop ? '--             Existing rows are left untouched.' : '--             the default dataset. Any previous data is erased.',
  '--',
  '--  DEFAULT LOGINS (password for every account: ' + DEMO_PASSWORD + ')',
  '--    Teacher  teacher@demo.com',
  '--    Student  student1@demo.com … student5@demo.com',
  '--',
  '--  DEMO ROOM',
  '--    BCA 5th Semester - DBMS   code: K7M4P2',
  '--',
  '--  The script is idempotent: running it twice produces the same data.',
  '--  The password hashes below are bcrypt hashes of "' + DEMO_PASSWORD + '".',
  '-- ============================================================================',
  '',
  'BEGIN;',
  '',
);

/* ── reset ──────────────────────────────────────────────────── */
if (!noDrop) {
  push(
    '-- ─── 1. Reset ──────────────────────────────────────────────────────────────',
    'DROP TABLE IF EXISTS public."Answer" CASCADE;',
    'DROP TABLE IF EXISTS public."Document" CASCADE;',
    'DROP TABLE IF EXISTS public."Question" CASCADE;',
    'DROP TABLE IF EXISTS public."RoomMember" CASCADE;',
    'DROP TABLE IF EXISTS public."Submission" CASCADE;',
    'DROP TABLE IF EXISTS public."Test" CASCADE;',
    'DROP TABLE IF EXISTS public."Room" CASCADE;',
    'DROP TABLE IF EXISTS public."User" CASCADE;',
    'DROP TYPE IF EXISTS public."DocumentStatus" CASCADE;',
    'DROP TYPE IF EXISTS public."TestStatus" CASCADE;',
    'DROP TYPE IF EXISTS public."Role" CASCADE;',
    '',
    '-- ─── 2. Schema ──────────────────────────────────────────────────────────────',
    schema,
    '',
  );
} else {
  push(
    '-- ─── 1. Schema (skipped tables that already exist) ─────────────────────────',
    '-- Run the full script (without --no-drop) to recreate everything from scratch.',
    '',
    'DO $$ BEGIN',
    "  CREATE TYPE public.\"Role\" AS ENUM ('STUDENT', 'TEACHER');",
    'EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    'DO $$ BEGIN',
    "  CREATE TYPE public.\"TestStatus\" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');",
    'EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    'DO $$ BEGIN',
    "  CREATE TYPE public.\"DocumentStatus\" AS ENUM ('PROCESSING', 'READY', 'FAILED');",
    'EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    '',
  );
}

/* ── users ──────────────────────────────────────────────────── */
push(
  '-- ─── 3. Users ───────────────────────────────────────────────────────────────',
  'INSERT INTO public."User" (id, email, fullname, password, role, "createdAt", "updatedAt") VALUES',
);
const userRows = [
  `  ('demo-user-teacher', 'teacher@demo.com', 'Prof. Jordan', ${q(PASSWORD_HASH)}, 'TEACHER', NOW(), NOW())`,
  ...STUDENTS.map(
    ([id, email, name], index) =>
      `  (${q(id)}, ${q(email)}, ${q(name)}, ${q(PASSWORD_HASH)}, 'STUDENT', NOW() - INTERVAL '${20 - index} days', NOW())`,
  ),
];
push(
  userRows.join(',\n') + '',
  'ON CONFLICT (email) DO UPDATE SET',
  '  fullname = EXCLUDED.fullname,',
  '  password = EXCLUDED.password,',
  '  role     = EXCLUDED.role;',
  '',
);

/* ── room ───────────────────────────────────────────────────── */
push(
  '-- ─── 4. Demo room (code K7M4P2) ─────────────────────────────────────────────',
  'INSERT INTO public."Room" (id, code, name, subject, description, "teacherId", "createdAt") VALUES',
  "  ('demo-room-dbms', 'K7M4P2', 'BCA 5th Semester - DBMS', 'Computer Science', 'Database Management Systems', 'demo-user-teacher', NOW() - INTERVAL '30 days')",
  'ON CONFLICT (code) DO UPDATE SET',
  '  name        = EXCLUDED.name,',
  '  subject     = EXCLUDED.subject,',
  '  description = EXCLUDED.description;',
  '',
);

/* ── membership ─────────────────────────────────────────────── */
push(
  '-- ─── 5. Room membership ─────────────────────────────────────────────────────',
  'INSERT INTO public."RoomMember" (id, "roomId", "studentId", "joinedAt")',
  "SELECT 'demo-member-' || u.id, 'demo-room-dbms', u.id, NOW() - INTERVAL '25 days'",
  'FROM public."User" u',
  "WHERE u.email LIKE 'student%@demo.com'",
  'ON CONFLICT ("roomId", "studentId") DO NOTHING;',
  '',
);

/* ── tests + questions ──────────────────────────────────────── */
push(
  '-- ─── 6. Tests ───────────────────────────────────────────────────────────────',
  'INSERT INTO public."Test" (id, title, topic, duration, "questionCount", difficulty, status, "roomId", "creatorId", "createdAt", "publishedAt") VALUES',
  "  ('demo-test-week1', 'Week 1: Intro to Databases', 'Databases', 15, 5, 'EASY',   'PUBLISHED', 'demo-room-dbms', 'demo-user-teacher', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days')",
  "  , ('demo-test-pop1', 'Pop Quiz 1', 'Normalization & keys', 5, 3, 'MEDIUM', 'PUBLISHED', 'demo-room-dbms', 'demo-user-teacher', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')",
  "  , ('demo-test-pop2', 'Pop Quiz 2', 'Normalization & keys', 5, 3, 'MEDIUM', 'PUBLISHED', 'demo-room-dbms', 'demo-user-teacher', NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days')",
  "  , ('demo-test-pop3', 'Pop Quiz 3', 'Normalization & keys', 5, 3, 'MEDIUM', 'PUBLISHED', 'demo-room-dbms', 'demo-user-teacher', NOW(), NOW())",
  'ON CONFLICT (id) DO UPDATE SET',
  '  title         = EXCLUDED.title,',
  '  duration      = EXCLUDED.duration,',
  '  "questionCount" = EXCLUDED."questionCount",',
  '  status        = EXCLUDED.status,',
  '  "publishedAt" = EXCLUDED."publishedAt";',
  '',
  '-- ─── 7. Questions ───────────────────────────────────────────────────────────',
  'INSERT INTO public."Question" (id, "testId", "questionText", options, "correctAnswer", difficulty, points) VALUES',
);

const questionRows = [];
for (const [index, [text, options, correct]] of WEEK1_QUESTIONS.entries()) {
  questionRows.push(
    `  ('demo-q-week1-${index}', 'demo-test-week1', ${q(text)}, ${jsonOptions(options)}, ${correct}, 'EASY', 1)`,
  );
}
for (let round = 1; round <= 3; round++) {
  for (const [index, [text, options, correct]] of POP_QUIZ_QUESTIONS.entries()) {
    questionRows.push(
      `  ('demo-q-pop${round}-${index}', 'demo-test-pop${round}', ${q(text)}, ${jsonOptions(options)}, ${correct}, 'MEDIUM', 1)`,
    );
  }
}
push(
  questionRows.join(',\n'),
  'ON CONFLICT (id) DO UPDATE SET',
  '  "questionText"  = EXCLUDED."questionText",',
  '  options         = EXCLUDED.options,',
  '  "correctAnswer" = EXCLUDED."correctAnswer";',
  '',
);

/* ── attempts ───────────────────────────────────────────────── */
push(
  '-- ─── 8. Attempts (populate the leaderboards) ────────────────────────────────',
  '--   Deterministic scores so the room and weekly boards are never empty.',
  'INSERT INTO public."Submission" (id, "testId", "studentId", score, percentage, "correctAnswers", "wrongAnswers", "timeTaken", "startedAt", "submittedAt")',
  'SELECT',
  "  'demo-sub-' || t.id || '-' || u.id,",
  '  t.id,',
  '  u.id,',
  '  LEAST(g.seed, t."questionCount")                                        AS score,',
  '  ROUND((LEAST(g.seed, t."questionCount")::numeric / t."questionCount") * 100, 2) AS percentage,',
  '  LEAST(g.seed, t."questionCount")                                        AS "correctAnswers",',
  '  t."questionCount" - LEAST(g.seed, t."questionCount")                     AS "wrongAnswers",',
  '  300                                                                     AS "timeTaken",',
  '  t."publishedAt",',
  '  t."publishedAt" + INTERVAL \'5 minutes\'                                 AS "submittedAt"',
  'FROM public."Test" t',
  'JOIN public."Room" r ON r.id = t."roomId"',
  'CROSS JOIN public."User" u',
  'CROSS JOIN LATERAL (',
  '  SELECT (CASE',
  "    WHEN u.email = 'student1@demo.com' THEN rpad('1', t.\"questionCount\", '1')::bigint",
  "    WHEN u.email = 'student2@demo.com' THEN rpad('3', t.\"questionCount\", '3')::bigint",
  "    WHEN u.email = 'student3@demo.com' THEN rpad('2', t.\"questionCount\", '2')::bigint",
  "    WHEN u.email = 'student4@demo.com' THEN rpad('4', t.\"questionCount\", '4')::bigint",
  "    WHEN u.email = 'student5@demo.com' THEN rpad('5', t.\"questionCount\", '5')::bigint",
  '    ELSE 1 END) % (t."questionCount" + 1) AS seed',
  ') g',
  "WHERE u.email LIKE 'student%@demo.com'",
  '  AND t."roomId" = \'demo-room-dbms\'',
  'ON CONFLICT ("testId", "studentId") DO NOTHING;',
  '',
);

/* ── answers ────────────────────────────────────────────────── */
push(
  '-- ─── 9. Per-question answers (needed for accuracy and answer review) ────────',
  'INSERT INTO public."Answer" (id, "submissionId", "questionId", "selectedAnswer", "isCorrect", "createdAt")',
  'SELECT',
  "  'demo-ans-' || s.id || '-' || q.id,",
  '  s.id,',
  '  q.id,',
  '  -- correct option for the first N questions, otherwise the next option along',
  '  CASE WHEN row_number() OVER (PARTITION BY s.id ORDER BY q."createdAt", q.id) <= s."correctAnswers"',
  '       THEN q."correctAnswer"',
  '       ELSE (q."correctAnswer" + 1) % 4 END,',
  '  row_number() OVER (PARTITION BY s.id ORDER BY q."createdAt", q.id) <= s."correctAnswers",',
  '  s."submittedAt"',
  'FROM public."Submission" s',
  'JOIN public."Question" q ON q."testId" = s."testId"',
  'WHERE s.id LIKE \'demo-sub-%\'',
  'ON CONFLICT ("submissionId", "questionId") DO NOTHING;',
  '',
);

/* ── verification + commit ──────────────────────────────────── */
push(
  'COMMIT;',
  '',
  '-- ─── Verification ───────────────────────────────────────────────────────────',
  'SELECT',
  "  (SELECT count(*) FROM public.\"User\")        AS users,",
  "  (SELECT count(*) FROM public.\"Room\")        AS rooms,",
  "  (SELECT count(*) FROM public.\"RoomMember\")  AS members,",
  "  (SELECT count(*) FROM public.\"Test\")        AS tests,",
  "  (SELECT count(*) FROM public.\"Question\")    AS questions,",
  "  (SELECT count(*) FROM public.\"Submission\")  AS attempts,",
  "  (SELECT count(*) FROM public.\"Answer\")      AS answers;",
  '',
  '-- Expected on a clean run: 6 users, 1 room, 5 members, 4 tests, 14 questions, 20 attempts, 70 answers.',
  '',
  'SELECT u."fullname", u.email, u.role FROM public."User" u ORDER BY u.role DESC, u.email;',
  '',
  "SELECT r.code, r.name, count(DISTINCT m.\"studentId\") AS students, count(DISTINCT t.id) AS tests",
  'FROM public."Room" r',
  'LEFT JOIN public."RoomMember" m ON m."roomId" = r.id',
  'LEFT JOIN public."Test" t ON t."roomId" = r.id',
  'GROUP BY r.code, r.name;',
  '',
  '-- Room leaderboard preview (average percentage per student)',
  "SELECT u.\"fullname\", ROUND(AVG(s.percentage)::numeric, 2) AS avg_percentage, count(*) AS tests_completed",
  'FROM public."Submission" s',
  'JOIN public."User" u ON u.id = s."studentId"',
  "WHERE s.\"submittedAt\" IS NOT NULL",
  'GROUP BY u."fullname"',
  'ORDER BY avg_percentage DESC;',
  '',
);

const output = lines.join('\n');
const target = here('../prisma/classrank-neon.sql');
writeFileSync(target, output, 'utf8');
console.log(`wrote prisma/classrank-neon.sql (${Buffer.byteLength(output, 'utf8')} bytes, ${output.split('\n').length} lines)`);
console.log(`demo password hash: ${PASSWORD_HASH}`);
