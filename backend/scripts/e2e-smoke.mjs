const BASE = 'http://localhost:3001';

const results = [];
function log(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

async function req(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 300);
  }
  return { status: res.status, body: json };
}

const suffix = Date.now().toString().slice(-6);

/* â”€â”€ health â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('GET', '/health');
  log('GET /health', r.status === 200 && r.body?.status === 'ok');
}

/* â”€â”€ teacher signup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const teacherEmail = `teacher.${suffix}@example.com`;
const studentEmail = `student.${suffix}@example.com`;

const tReg = await req('POST', '/auth/register', {
  body: { email: teacherEmail, password: 'Secur3!Passphrase', fullname: 'Test Teacher', role: 'TEACHER' },
});
log('POST /auth/register (teacher)', tReg.status === 201 && !!tReg.body?.access_token, `status=${tReg.status}`);
const teacherToken = tReg.body?.access_token;

{
  const dup = await req('POST', '/auth/register', {
    body: { email: teacherEmail, password: 'Secur3!Passphrase', fullname: 'Dupe', role: 'TEACHER' },
  });
  log('duplicate email rejected', dup.status === 409, `status=${dup.status}`);
}

{
  const bad = await req('POST', '/auth/register', {
    body: { email: 'not-an-email', password: 'x', fullname: '', role: 'WIZARD' },
  });
  log('invalid register body rejected', bad.status === 400, `status=${bad.status}`);
}

/* â”€â”€ student signup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const sReg = await req('POST', '/auth/register', {
  body: { email: studentEmail, password: 'Secur3!Passphrase', fullname: 'Test Student', role: 'STUDENT' },
});
log('POST /auth/register (student)', sReg.status === 201 && !!sReg.body?.access_token, `status=${sReg.status}`);
const studentToken = sReg.body?.access_token;

/* â”€â”€ login + me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('POST', '/auth/login', { body: { email: teacherEmail, password: 'Secur3!Passphrase' } });
  log('POST /auth/login', r.status === 200 && !!r.body?.access_token, `status=${r.status}`);
}
{
  const r = await req('POST', '/auth/login', { body: { email: teacherEmail, password: 'wrong' } });
  log('wrong password rejected', r.status === 401, `status=${r.status}`);
}
{
  const r = await req('GET', '/auth/me', { token: teacherToken });
  log('GET /auth/me', r.status === 200 && r.body?.role === 'TEACHER', JSON.stringify(r.body)?.slice(0, 120));
}

/* â”€â”€ role guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('POST', '/rooms', { token: studentToken, body: { name: 'Nope' } });
  log('student cannot create a room', r.status === 403, `status=${r.status}`);
}
{
  const r = await req('GET', '/tests', { token: studentToken });
  log('student can list tests', r.status === 200, `status=${r.status}`);
}

/* â”€â”€ create room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const roomRes = await req('POST', '/rooms', {
  token: teacherToken,
  body: { name: 'Integration Test Room', subject: 'QA', description: 'created by e2e smoke test' },
});
log('POST /rooms', roomRes.status === 201 && !!roomRes.body?.code, `code=${roomRes.body?.code}`);
const room = roomRes.body;
{
  const r = await req('POST', '/rooms', { token: teacherToken, body: { name: '' } });
  log('room without a name rejected', r.status === 400, `status=${r.status}`);
}

/* â”€â”€ public room preview + code lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('GET', `/public/rooms/${room.code}`);
  log('GET /public/rooms/:code (no auth)', r.status === 200 && r.body?.code === room.code, `status=${r.status}`);
  log(
    'room preview hides private fields',
    r.body && !('teacherId' in r.body) && !('members' in r.body),
    Object.keys(r.body || {}).join(','),
  );
}
{
  const lower = room.code.toLowerCase();
  const r = await req('GET', `/rooms/code/${lower}`, { token: studentToken });
  log('GET /rooms/code/:code is case-insensitive', r.status === 200 && r.body?.code === room.code, `status=${r.status}`);
}
{
  const r = await req('GET', '/public/rooms/ZZZZZZ');
  log('unknown room code => 404', r.status === 404, `status=${r.status}`);
}

/* â”€â”€ join room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('POST', '/rooms/join', { token: studentToken, body: { code: room.code.toLowerCase() } });
  log('POST /rooms/join (lowercase code)', r.status === 201, `status=${r.status}`);
}
{
  const r = await req('POST', '/rooms/join', { token: studentToken, body: { code: room.code } });
  log('duplicate join => 409', r.status === 409, `status=${r.status}`);
}
{
  const r = await req('POST', '/rooms/join', { token: studentToken, body: { code: 'AAAAAA' } });
  log('unknown code => 404', r.status === 404, `status=${r.status}`);
}

/* â”€â”€ documents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('GET', `/documents/room/${room.id}`, { token: teacherToken });
  log('GET /documents/room/:roomId (empty)', r.status === 200 && Array.isArray(r.body), `count=${r.body?.length}`);
}
{
  const fd = new FormData();
  fd.append('file', new Blob(['hello'], { type: 'text/plain' }), 'notes.txt');
  const res = await fetch(`${BASE}/documents/upload/${room.id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: fd,
  });
  log('non-PDF upload rejected', res.status === 422 || res.status === 400, `status=${res.status}`);
}
{
  const r = await req('GET', `/documents/room/${room.id}`, { token: studentToken });
  log('student cannot list room documents', r.status === 403, `status=${r.status}`);
}

/* â”€â”€ generate a test directly, publish it â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const gen = await req('POST', '/tests/generate', {
  token: teacherToken,
  body: { topic: 'Relational databases', roomId: room.id, questionCount: 5 },
});
log(
  'POST /tests/generate creates a DRAFT',
  gen.status === 201 && gen.body?.status === 'DRAFT' && Array.isArray(gen.body?.questions),
  `status=${gen.status} questions=${gen.body?.questions?.length}`,
);
const testId = gen.body?.id;

if (testId) {
  // The generate response intentionally omits the answer key (it is returned by
  // the teacher-only GET /tests/:id), so only shape is checked here.
  const bad = gen.body.questions.filter(
    (x) => !x.questionText?.trim() || !Array.isArray(x.options) || x.options.length !== 4,
  );
  log(
    'generated questions are well formed',
    bad.length === 0,
    bad.length ? `bad=${bad.length} :: ${JSON.stringify(bad[0])}` : `${gen.body.questions.length} valid`,
  );

  {
    const r = await req('GET', `/tests/${testId}`, { token: teacherToken });
    const keyBad = (r.body?.questions || []).filter(
      (x) => !(x.correctAnswer >= 0 && x.correctAnswer <= 3),
    );
    log(
      'teacher sees a valid answer key',
      r.status === 200 && keyBad.length === 0 && (r.body?.questions?.length ?? 0) > 0,
      `bad=${keyBad.length} keys=${(r.body?.questions || []).map((x) => x.correctAnswer).join(',')}`,
    );
    log(
      'generated tests have a duration so the timer works',
      typeof r.body?.duration === 'number' && r.body.duration > 0,
      `duration=${r.body?.duration}`,
    );
  }

  {
    const r = await req('POST', `/tests/${testId}/publish`, { token: studentToken });
    log('student cannot publish', r.status === 403, `status=${r.status}`);
  }
  {
    const r = await req('POST', `/tests/${testId}/publish`, { token: teacherToken });
    log('POST /tests/:id/publish', r.status === 201 && r.body?.status === 'PUBLISHED', `status=${r.status}`);
  }
  {
    const r = await req('POST', `/tests/${testId}/publish`, { token: teacherToken });
    log('double publish rejected', r.status === 400, `status=${r.status}`);
  }

  /* â”€â”€ student takes the test â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  {
    const r = await req('GET', `/tests/${testId}`, { token: studentToken });
    const leaks = r.body?.questions?.some((x) => 'correctAnswer' in x && x.correctAnswer !== undefined);
    log('GET /tests/:id as student', r.status === 200, `status=${r.status}`);
    log('correct answers hidden from students', !leaks, leaks ? 'LEAKED' : 'hidden');
  }

  {
    const r = await req('GET', `/submissions/attempt/${testId}`, { token: studentToken });
    log('GET /submissions/attempt/:testId (before start)', r.status === 200 && r.body?.submissionId === null, JSON.stringify(r.body)?.slice(0, 140));
  }

  const start = await req('POST', `/submissions/${testId}/start`, { token: studentToken });
  log('POST /submissions/:testId/start', start.status === 201 && !!start.body?.startedAt, `status=${start.status}`);

  {
    const r = await req('POST', `/submissions/${testId}/start`, { token: studentToken });
    log('restarting an in-progress attempt reuses it', r.status === 201 && r.body?.id === start.body?.id, `status=${r.status}`);
  }

  {
    const r = await req('GET', `/submissions/attempt/${testId}`, { token: studentToken });
    log('attempt state exposes a server deadline', r.status === 200 && !!r.body?.deadline, `deadline=${r.body?.deadline}`);
  }

  // Answer with the teacher's key so the score must be 100%.
  const teacherView = await req('GET', `/tests/${testId}`, { token: teacherToken });
  const key = (teacherView.body?.questions || []).map((x) => ({ questionId: x.id, selectedAnswer: x.correctAnswer }));

  const submit = await req('POST', `/submissions/${testId}/submit`, { token: studentToken, body: { answers: key } });
  log(
    'POST /submissions/:testId/submit grades on the server',
    (submit.status === 201 || submit.status === 200) && submit.body?.percentage === 100,
    `status=${submit.status} percentage=${submit.body?.percentage} score=${submit.body?.score}`,
  );
  const submissionId = submit.body?.id;

  {
    const r = await req('POST', `/submissions/${testId}/submit`, { token: studentToken, body: { answers: key } });
    log('duplicate submit rejected', r.status === 400, `status=${r.status}`);
  }
  {
    const r = await req('POST', `/submissions/${testId}/start`, { token: studentToken });
    log('cannot restart a submitted test', r.status === 400, `status=${r.status}`);
  }

  /* â”€â”€ result + review â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (submissionId) {
    const r = await req('GET', `/submissions/${submissionId}`, { token: studentToken });
    log('GET /submissions/:id', r.status === 200 && r.body?.percentage === 100, `status=${r.status}`);
    log(
      'review reveals the answer key after submit',
      r.body?.questions?.every((x) => typeof x.correctAnswer === 'number'),
      `questions=${r.body?.questions?.length}`,
    );
  }
  {
    const r = await req('GET', '/submissions/me', { token: studentToken });
    const found = Array.isArray(r.body) && r.body.some((s) => s.testId === testId);
    log('GET /submissions/me includes the attempt', r.status === 200 && found, `count=${r.body?.length}`);
  }

  /* â”€â”€ teacher results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  {
    const r = await req('GET', `/tests/${testId}/results`, { token: teacherToken });
    log(
      'GET /tests/:id/results aggregates attempts',
      r.status === 200 && r.body?.summary?.attemptCount === 1 && r.body?.summary?.averagePercentage === 100,
      `status=${r.status} attempts=${r.body?.summary?.attemptCount} avg=${r.body?.summary?.averagePercentage}`,
    );
  }
  {
    const r = await req('GET', `/tests/${testId}/results`, { token: studentToken });
    log('student cannot read test results', r.status === 403, `status=${r.status}`);
  }

  /* â”€â”€ question editing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (key[0]) {
    const edited = await req('PATCH', `/tests/${testId}/questions/${key[0].questionId}`, {
      token: teacherToken,
      body: { questionText: 'Edited by the smoke test?', options: ['A1', 'B1', 'C1', 'D1'], correctAnswer: 2 },
    });
    log('PATCH /tests/:id/questions/:qid', edited.status === 200 && edited.body?.correctAnswer === 2, `status=${edited.status}`);

    const deleted = await req('POST', `/tests/${testId}/questions/${key[0].questionId}/delete`, { token: teacherToken });
    log('POST /tests/:id/questions/:qid/delete', deleted.status === 201, `status=${deleted.status}`);
  }
}

/* â”€â”€ leaderboards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('GET', `/leaderboard/room/${room.code}`, { token: studentToken });
  const entry = r.body?.leaderboard?.find((e) => e.studentId === sReg.body?.user?.id);
  log(
    'GET /leaderboard/room/:code ranks the student',
    r.status === 200 && !!entry,
    `status=${r.status} rank=${entry?.rank} avg=${entry?.averagePercentage}`,
  );
  log(
    'room leaderboard highlights the viewer',
    r.body?.viewer?.studentId === sReg.body?.user?.id,
    JSON.stringify(r.body?.viewer)?.slice(0, 120),
  );
}
{
  const r = await req('GET', '/leaderboard/global/weekly');
  log(
    'GET /leaderboard/global/weekly is public',
    r.status === 200 && Array.isArray(r.body?.leaderboard) && typeof r.body?.minTestsRequired === 'number',
    `status=${r.status} ranked=${r.body?.leaderboard?.length} min=${r.body?.minTestsRequired}`,
  );
  log(
    'global leaderboard exposes the week window',
    !!r.body?.weekStart && !!r.body?.weekEnd,
    `${r.body?.weekStart} -> ${r.body?.weekEnd}`,
  );
}

/* â”€â”€ public profile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('GET', `/users/${sReg.body?.user?.id}`, { token: teacherToken });
  log(
    'GET /users/:id returns a public profile',
    r.status === 200 && r.body?.stats?.testsCompleted === 1,
    `status=${r.status} tests=${r.body?.stats?.testsCompleted}`,
  );
  log('public profile never leaks an email', !JSON.stringify(r.body || {}).includes('@'), 'no @ found');
}
{
  const r = await req('GET', '/users/does-not-exist');
  log('unauthorised profile request rejected', r.status === 401, `status=${r.status}`);
}

/* â”€â”€ cleanup the throwaway room â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
{
  const r = await req('POST', '/ai/generate-test', { token: teacherToken, body: {} });
  log('POST /ai/generate-test validates its body', r.status === 400, `status=${r.status}`);
}

/* â”€â”€ summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('FAILED:');
  for (const f of failed) console.log(`  - ${f.name} :: ${f.detail}`);
  process.exitCode = 1;
}
console.log(`\nTest room: ${room.code} (${room.id})`);
console.log(`Test id:   ${testId}`);
console.log(`Student:   ${sReg.body?.user?.id}`);
