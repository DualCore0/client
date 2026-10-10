/**
 * Demo-path verification (the flow in the pitch script):
 *   teacher signs up -> creates a room -> uploads a real PDF -> AI generates
 *   MCQs -> publishes -> student joins by code -> attempts -> is graded ->
 *   room + global leaderboards update.
 *
 * Requires the backend to be running on :3001.
 */
import { readFileSync } from 'node:fs';

const BASE = 'http://localhost:3001';
const results = [];

function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

async function req(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, body: json };
}

const suffix = Date.now().toString().slice(-6);

/* 1. Teacher account + room ------------------------------------------------ */
const teacher = await req('POST', '/auth/register', {
  body: { email: `demo.teacher.${suffix}@example.com`, password: 'password123', fullname: 'Prof. Jordan', role: 'TEACHER' },
});
log('teacher registers', teacher.status === 201, `status=${teacher.status}`);

const room = await req('POST', '/rooms', {
  token: teacher.body.access_token,
  body: { name: 'BCA 5th Semester - DBMS', subject: 'Computer Science', description: 'Database Management Systems' },
});
log('teacher creates the demo room', room.status === 201 && !!room.body?.code, `code=${room.body?.code}`);

/* 2. Upload the real PDF --------------------------------------------------- */
const pdfBytes = readFileSync(new URL('../fixtures/dbms-unit-1.pdf', import.meta.url));
const form = new FormData();
form.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), 'DBMS Unit 1.pdf');

const uploadRes = await fetch(`${BASE}/documents/upload/${room.body.id}`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${teacher.body.access_token}` },
  body: form,
});
const uploaded = await uploadRes.json();
log(
  'teacher uploads a PDF',
  uploadRes.status === 201 && uploaded?.status === 'PROCESSING',
  `status=${uploadRes.status} docStatus=${uploaded?.status}`,
);

/* 3. Poll until extraction finishes --------------------------------------- */
let doc = uploaded;
for (let attempt = 0; attempt < 20 && doc.status === 'PROCESSING'; attempt++) {
  await new Promise((r) => setTimeout(r, 700));
  const polled = await req('GET', `/documents/${uploaded.id}`, { token: teacher.body.access_token });
  doc = polled.body;
}
log(
  'PDF text extraction completes',
  doc?.status === 'READY' && doc?.chunkCount > 0,
  `status=${doc?.status} chunks=${doc?.chunkCount} error=${doc?.error ?? 'none'}`,
);

/* 4. AI generates questions from the document ----------------------------- */
const genStart = Date.now();
const generated = await req('POST', '/ai/generate-test', {
  token: teacher.body.access_token,
  body: {
    roomId: room.body.id,
    documentId: uploaded.id,
    title: 'Week 1: Intro to Databases',
    topic: 'Databases',
    duration: 15,
    questionCount: 10,
    difficulty: 'MEDIUM',
  },
});
log(
  'AI generates a draft test from the PDF',
  generated.status === 201 && generated.body?.status === 'DRAFT' && generated.body?.questions?.length >= 3,
  `status=${generated.status} questions=${generated.body?.questions?.length} in ${Date.now() - genStart}ms`,
);

const testId = generated.body?.id;
if (testId) {
  const shapes = generated.body.questions.every(
    (q) => q.questionText?.trim() && Array.isArray(q.options) && q.options.length === 4,
  );
  log('generated questions have 4 options each', shapes, `count=${generated.body.questions.length}`);
  log(
    'draft is not auto-published',
    generated.body.status === 'DRAFT',
    `status=${generated.body.status}`,
  );
  log(
    'teacher sees the answer key for review',
    generated.body.questions.every((q) => q.correctAnswer >= 0 && q.correctAnswer <= 3),
    `keys=${generated.body.questions.map((q) => q.correctAnswer).join(',')}`,
  );
  console.log('\nSample generated questions:');
  for (const q of generated.body.questions.slice(0, 3)) {
    console.log(`  Q: ${q.questionText}`);
    console.log(`     ${q.options.map((o, i) => `${i === q.correctAnswer ? '*' : ' '}${i}. ${o}`).join(' | ')}`);
  }
  console.log('');
}

/* 5. Publish --------------------------------------------------------------- */
if (testId) {
  const published = await req('POST', `/tests/${testId}/publish`, { token: teacher.body.access_token });
  log('teacher publishes the reviewed test', published.status === 201 && published.body?.status === 'PUBLISHED', `status=${published.status}`);
}

/* 6. Student joins with the code and takes the test ----------------------- */
const student = await req('POST', '/auth/register', {
  body: { email: `demo.student.${suffix}@example.com`, password: 'password123', fullname: 'Alice Smith', role: 'STUDENT' },
});
log('student registers', student.status === 201, `status=${student.status}`);

const preview = await req('GET', `/public/rooms/${room.body.code}`);
log('student sees the room preview before joining', preview.status === 200 && preview.body?.name === 'BCA 5th Semester - DBMS', `instructor=${preview.body?.instructor}`);

const joined = await req('POST', '/rooms/join', { token: student.body.access_token, body: { code: room.body.code } });
log('student joins with the room code', joined.status === 201, `status=${joined.status}`);

const studentTest = await req('GET', `/tests/${testId}`, { token: student.body.access_token });
log('published test is visible to the student', studentTest.status === 200, `status=${studentTest.status}`);
log(
  'student payload carries no answer key',
  studentTest.body?.questions?.every((q) => q.correctAnswer === undefined),
  'clean',
);

const started = await req('POST', `/submissions/${testId}/start`, { token: student.body.access_token });
log('attempt starts and is timed by the server', started.status === 201 && !!started.body?.startedAt, `status=${started.status}`);

const state = await req('GET', `/submissions/attempt/${testId}`, { token: student.body.access_token });
const deadlineMs = state.body?.deadline ? new Date(state.body.deadline).getTime() : null;
log(
  'deadline equals start + duration',
  deadlineMs !== null && Math.abs(deadlineMs - new Date(started.body.startedAt).getTime() - 15 * 60 * 1000) < 2000,
  `deadline=${state.body?.deadline}`,
);

// Answer 9 of 10 correctly (a realistic demo result) by using the teacher key.
const teacherView = await req('GET', `/tests/${testId}`, { token: teacher.body.access_token });
const key = teacherView.body.questions.map((q) => ({ questionId: q.id, selectedAnswer: q.correctAnswer }));
const answers = key.map((a, index) => (index === 0 ? { ...a, selectedAnswer: (a.selectedAnswer + 1) % 4 } : a));

const submitted = await req('POST', `/submissions/${testId}/submit`, {
  token: student.body.access_token,
  body: { answers },
});
log(
  'server grades the attempt',
  submitted.status === 201 && submitted.body?.correctAnswers === key.length - 1,
  `correct=${submitted.body?.correctAnswers}/${key.length} percentage=${submitted.body?.percentage?.toFixed?.(1)}`,
);
log(
  'percentage matches the answers',
  Math.abs((submitted.body?.percentage ?? 0) - ((key.length - 1) / key.length) * 100) < 0.01,
  `percentage=${submitted.body?.percentage}`,
);

/* 7. Leaderboards reflect the attempt ------------------------------------- */
const roomBoard = await req('GET', `/leaderboard/room/${room.body.code}`, { token: student.body.access_token });
const studentRow = roomBoard.body?.leaderboard?.find((e) => e.studentId === student.body.user.id);
log(
  'room leaderboard updates after submission',
  roomBoard.status === 200 && !!studentRow && studentRow.testsCompleted === 1,
  `rank=${studentRow?.rank} avg=${studentRow?.averagePercentage}`,
);

const globalBoard = await req('GET', '/leaderboard/global/weekly');
log(
  'global weekly leaderboard responds',
  globalBoard.status === 200 && Array.isArray(globalBoard.body?.leaderboard),
  `ranked=${globalBoard.body?.leaderboard?.length} minTests=${globalBoard.body?.minTestsRequired}`,
);

const submission = await req('GET', `/submissions/${submitted.body.id}`, { token: student.body.access_token });
log(
  'student can review every question after submitting',
  submission.status === 200 &&
    submission.body.questions.length === key.length &&
    submission.body.questions.every((q) => typeof q.correctAnswer === 'number'),
  `questions=${submission.body?.questions?.length}`,
);

/* summary ------------------------------------------------------------------ */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} demo-path checks passed`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`);
  process.exitCode = 1;
}
console.log(`\nRoom code: ${room.body?.code}`);
console.log(`Test id:   ${testId}`);
