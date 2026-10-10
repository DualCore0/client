/** Verifies the edge middleware gates protected routes when no session cookie is present. */
const paths = ['/dashboard', '/tests/xyz', '/rooms', '/profile', '/join', '/leaderboard', '/tests/create', '/rooms/K7M4P2'];

let failures = 0;
for (const path of paths) {
  const res = await fetch(`http://localhost:3000${path}`, { redirect: 'manual' });
  const location = res.headers.get('location') || '';
  const ok = (res.status === 307 || res.status === 302) && location.includes('/login');
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${path.padEnd(18)} -> ${res.status} ${location.replace('http://localhost:3000', '')}`,
  );
}

// Public routes must stay reachable.
for (const path of ['/', '/login', '/signup']) {
  const res = await fetch(`http://localhost:3000${path}`, { redirect: 'manual' });
  const ok = res.status === 200;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${path.padEnd(18)} -> ${res.status} (public)`);
}

// With a session cookie the login page should bounce to the dashboard.
{
  const res = await fetch('http://localhost:3000/login', {
    redirect: 'manual',
    headers: { cookie: 'classrank_token=fake.token.value' },
  });
  const location = res.headers.get('location') || '';
  const ok = (res.status === 307 || res.status === 302) && location.includes('/dashboard');
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  /login with session -> ${res.status} ${location}`);
}

console.log(failures === 0 ? '\nAll middleware checks passed' : `\n${failures} middleware check(s) failed`);
process.exitCode = failures === 0 ? 0 : 1;
