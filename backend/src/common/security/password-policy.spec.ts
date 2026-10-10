import { validatePasswordStrength, MIN_PASSWORD_LENGTH } from './password-policy.js';

describe('validatePasswordStrength', () => {
  const good = 'Str0ng!Passphrase';

  it('accepts a strong password', () => {
    expect(validatePasswordStrength(good).ok).toBe(true);
  });

  it('requires a minimum length', () => {
    const result = validatePasswordStrength('Ab1!cdef');
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/at least 10 characters/i);
    expect(MIN_PASSWORD_LENGTH).toBe(10);
  });

  it('requires lower case, upper case, a digit and a symbol', () => {
    expect(validatePasswordStrength('alllowercase1!').errors.join(' ')).toMatch(/uppercase/i);
    expect(validatePasswordStrength('ALLUPPERCASE1!').errors.join(' ')).toMatch(/lowercase/i);
    expect(validatePasswordStrength('NoDigitsHere!!').errors.join(' ')).toMatch(/digit/i);
    expect(validatePasswordStrength('NoSymbolsHere12').errors.join(' ')).toMatch(/symbol/i);
  });

  it('rejects common passwords', () => {
    expect(validatePasswordStrength('Password123!').ok).toBe(false);
    expect(validatePasswordStrength('Classrank123!').ok).toBe(false);
  });

  it('rejects keyboard and alphabet sequences', () => {
    expect(validatePasswordStrength('XqwertyX1!').errors.join(' ')).toMatch(/sequence/i);
    expect(validatePasswordStrength('XabcdEfgh1!').errors.join(' ')).toMatch(/sequence/i);
  });

  it('rejects a character repeated four or more times', () => {
    expect(validatePasswordStrength('Aaaa1!xyzQ').errors.join(' ')).toMatch(/repeat/i);
  });

  it('rejects a password containing the email local part', () => {
    const result = validatePasswordStrength('AliceSmith1!x', { email: 'alice.smith@example.com' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/name or email/i);
  });

  it('rejects a password containing the full name', () => {
    const result = validatePasswordStrength('BobJones99!x', { fullname: 'Bob Jones' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/name or email/i);
  });

  it('catches simple l33t substitutions of the identity', () => {
    const result = validatePasswordStrength('al1ce1!xyzQ', { email: 'alice@example.com' });
    expect(result.ok).toBe(false);
  });

  it('handles empty and non-string input', () => {
    expect(validatePasswordStrength('').ok).toBe(false);
    expect(validatePasswordStrength(undefined as unknown as string).ok).toBe(false);
  });

  it('rejects an excessively long password', () => {
    expect(validatePasswordStrength('Aa1!' + 'x'.repeat(200)).errors.join(' ')).toMatch(/at most/i);
  });

  it('reports every problem at once, not just the first', () => {
    const result = validatePasswordStrength('short');
    expect(result.errors.length).toBeGreaterThan(2);
  });
});
