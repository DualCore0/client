/**
 * Removes artifacts created by the automated smoke tests, leaving the demo
 * accounts (teacher@demo.com / studentN@demo.com) and the seeded room intact.
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
const url = line.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();

const dryRun = process.argv.includes('--dry-run');
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 30000 });
await client.connect();

const patterns = ['%@example.com', 'demo.teacher.%@example.com', 'demo.student.%@example.com'];

const users = await client.query(
  `select id, email from "User" where email like '%@example.com'`,
);
console.log(`Test users to remove: ${users.rows.length}`);
for (const u of users.rows) console.log(`  ${u.email}`);

const ids = users.rows.map((u) => u.id);

const counts = await client.query(
  `select
     (select count(*) from "Room" where "teacherId" = any($1)) as rooms,
     (select count(*) from "Test" where "creatorId" = any($1)) as tests,
     (select count(*) from "Submission" where "studentId" = any($1)) as submissions`,
  [ids.length ? ids : ['00000000-0000-0000-0000-000000000000']],
);
console.log('Cascading deletes:', counts.rows[0]);

if (dryRun) {
  console.log('\n(dry run — nothing deleted)');
} else if (ids.length) {
  // Room.teacherId is RESTRICT, so children have to go first. Deleting Rooms
  // and Tests cascades to members, documents, questions, submissions, answers.
  const safe = ids;
  await client.query(`delete from "Room" where "teacherId" = any($1)`, [safe]);
  await client.query(`delete from "Test" where "creatorId" = any($1)`, [safe]);
  const deleted = await client.query(`delete from "User" where id = any($1) returning id`, [safe]);
  console.log(`\nDeleted ${deleted.rowCount} test users (and everything that cascaded from them).`);
}

const remaining = await client.query(
  `select (select count(*) from "User") as users,
          (select count(*) from "Room") as rooms,
          (select count(*) from "Test") as tests,
          (select count(*) from "Submission") as submissions,
          (select count(*) from "Document") as documents`,
);
console.log('Remaining:', remaining.rows[0]);

await client.end();
