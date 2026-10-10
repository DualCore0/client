/**
 * Password policy.
 *
 * Deliberately strict: length first, then character diversity, then a blocklist
 * of passwords that appear in every credential-stuffing list. Also rejects
 * passwords built from the user's own identity.
 */

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

/** Small blocklist of extremely common credentials and app-specific guesses. */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password12', 'password123', 'password1234',
  'passw0rd', 'p@ssw0rd', 'p@ssword1', 'passwords',
  '123456', '1234567', '12345678', '123456789', '1234567890', 'qwerty',
  'qwerty123', 'qwertyuiop', 'letmein', 'letmein123', 'welcome', 'welcome1',
  'welcome123', 'admin', 'admin123', 'administrator', 'root', 'toor',
  'iloveyou', 'monkey', 'dragon', 'sunshine', 'princess', 'football',
  'baseball', 'master', 'shadow', 'superman', 'trustno1', 'abc123',
  'abcd1234', 'test1234', 'changeme', 'changeme123', 'secret', 'secret123',
  'classrank', 'classrank123', 'student', 'student123', 'teacher',
  'teacher123', 'school', 'school123', 'exam', 'exam1234',
]);

/** Keyboard walks we see constantly in generated demo passwords. */
const SEQUENCES = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
];

/** Maps common l33t substitutions back to letters. */
function deLeet(value: string): string {
  return value
    .replace(/[@4]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b');
}

/** Lower-cased alphanumeric skeleton of a password, with l33t folded in. */
function skeleton(value: string): string {
  return deLeet(value.toLowerCase()).replace(/[^a-z0-9]/g, '');
}

/** Lower-cased alphanumeric skeleton without l33t folding (keeps digits intact). */
function plainSkeleton(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type PasswordCheck = { ok: boolean; errors: string[] };

export function validatePasswordStrength(
  password: string,
  context: { email?: string; fullname?: string } = {},
): PasswordCheck {
  const errors: string[] = [];

  if (typeof password !== 'string' || password.length === 0) {
    return { ok: false, errors: ['Password is required'] };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push(`Password must be at most ${MAX_PASSWORD_LENGTH} characters long`);
  }
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a digit');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain a symbol');

  const lower = password.toLowerCase();
  const bare = plainSkeleton(password);
  const leetBare = skeleton(password);

  // Two views of the password are compared against the blocklist: the plain
  // alphanumeric skeleton (catches "Classrank123!") and the l33t-folded one
  // (catches "P@ssw0rd1"). Folding digits would corrupt number suffixes, so
  // both are needed.
  if (
    COMMON_PASSWORDS.has(lower) ||
    COMMON_PASSWORDS.has(bare) ||
    COMMON_PASSWORDS.has(leetBare)
  ) {
    errors.push('Password is too common — choose something unique');
  }

  // Reject runs like "aaaa" / "AAAA" and straight keyboard walks.
  if (/(.)\1{3,}/i.test(password)) {
    errors.push('Password must not repeat the same character four or more times');
  }
  let hasSequence = false;
  for (const sequence of SEQUENCES) {
    for (let i = 0; i + 4 <= sequence.length; i++) {
      if (lower.includes(sequence.slice(i, i + 4))) {
        hasSequence = true;
        break;
      }
    }
    if (hasSequence) break;
  }
  if (hasSequence) {
    errors.push('Password must not contain a straight keyboard or alphabet sequence');
  }

  // Reject passwords built from the account identity, including l33t spellings.
  // Leet folding is only applied to purely alphabetic identity tokens, because
  // folding digits would create false positives (e.g. "test1" -> "testi").
  const identityTokens = [context.email?.split('@')[0], context.fullname]
    .filter((value): value is string => Boolean(value && value.trim().length >= 4))
    .map((value) => ({
      plain: plainSkeleton(value),
      leet: skeleton(value),
      alphabetic: /^[a-z]+$/i.test(value.replace(/[^a-z0-9]/gi, '')),
    }))
    .filter((token) => token.plain.length >= 4);

  for (const token of identityTokens) {
    if (bare.includes(token.plain) || (token.alphabetic && leetBare.includes(token.leet))) {
      errors.push('Password must not contain your name or email address');
      break;
    }
  }

  return { ok: errors.length === 0, errors };
}
