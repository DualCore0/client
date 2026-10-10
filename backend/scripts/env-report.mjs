import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
for (const line of env.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const key = line.slice(0, i);
  const value = line.slice(i + 1).replace(/^"|"$/g, '');
  if (!/SECRET|KEY|URL|PASSWORD|API/i.test(key)) continue;
  const isSecret = /SECRET|KEY|PASSWORD|API/i.test(key) && !/URL/i.test(key);
  console.log(
    key.padEnd(24),
    'len=' + String(value.length).padEnd(4),
    isSecret ? 'preview=' + value.slice(0, 8) + '…' : value.slice(0, 60),
  );
}
