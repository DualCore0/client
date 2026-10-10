import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const line = env.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
const url = line.slice('DATABASE_URL='.length).replace(/^"|"$/g, '').trim();

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 30000 });
await client.connect();

const r = await client.query(
  `select t.title, count(s.id) as attempts
     from "Test" t
     left join "Submission" s on s."testId" = t.id
    where t."roomId" = (select id from "Room" where code = 'K7M4P2')
    group by t.title order by t.title`,
);
console.log('Demo room K7M4P2 tests:');
for (const row of r.rows) console.log(`  ${row.title.padEnd(32)} attempts=${row.attempts}`);

const totals = await client.query(
  `select (select count(*) from "Test") t, (select count(*) from "Submission") s, (select count(*) from "Answer") a`,
);
console.log('totals:', totals.rows[0]);

await client.end();
