/**
 * Ensures the security-related environment variables exist in backend/.env,
 * generating strong values for the ones that must be secret.
 *
 * Existing values are never printed or overwritten.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const envPath = new URL('../.env', import.meta.url);
const original = readFileSync(envPath, 'utf8');
const lines = original.split(/\r?\n/);

const present = new Set(
  lines
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => line.slice(0, line.indexOf('=')).trim()),
);

/** key -> value (or a generator for secrets). */
const wanted = [
  ['NODE_ENV', 'development'],
  ['PORT', '3001'],
  ['ACCESS_TOKEN_TTL', '15m'],
  ['REFRESH_TOKEN_DAYS', '30'],
  ['BCRYPT_ROUNDS', '12'],
  ['MAX_LOGIN_ATTEMPTS', '5'],
  ['LOCKOUT_MINUTES', '15'],
  ['REQUIRE_EMAIL_VERIFICATION', 'false'],
  ['CORS_ORIGINS', 'http://localhost:3000'],
  ['APP_ENCRYPTION_KEY', () => randomBytes(48).toString('base64url')],
];

const added = [];
for (const [key, value] of wanted) {
  if (present.has(key)) continue;
  const resolved = typeof value === 'function' ? value() : value;
  lines.push(`${key}=${resolved}`);
  added.push(key);
}

if (added.length) {
  // Keep exactly one trailing newline.
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  writeFileSync(envPath, lines.join('\n') + '\n', 'utf8');
}

console.log(added.length ? `Added: ${added.join(', ')}` : 'All security variables already present.');
console.log(`Total keys in .env: ${present.size + added.length}`);
