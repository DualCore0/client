import { readFileSync, writeFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env
  .split(/\r?\n/)
  .find((l) => l.startsWith('DATABASE_URL='))
  .slice('DATABASE_URL='.length)
  .replace(/^"|"$/g, '')
  .trim();

writeFileSync(new URL('./.dbtmp', import.meta.url), url);
console.log('wrote connection string to scripts/.dbtmp');
