import { validateEnv } from './env.validation.js';

/** Baseline configuration that passes validation. */
const base = () => ({
  DATABASE_URL: 'postgresql://user:pass@host:5432/db',
  JWT_SECRET: 'a-very-long-and-unique-secret-value-1234',
  NODE_ENV: 'development',
});

describe('validateEnv', () => {
  it('accepts a valid configuration', () => {
    expect(() => validateEnv(base())).not.toThrow();
  });

  it('requires DATABASE_URL and JWT_SECRET', () => {
    expect(() => validateEnv({ ...base(), DATABASE_URL: '' })).toThrow(/DATABASE_URL is required/);
    expect(() => validateEnv({ ...base(), JWT_SECRET: '' })).toThrow(/JWT_SECRET is required/);
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() => validateEnv({ ...base(), DATABASE_URL: 'mysql://x' })).toThrow(/postgres/);
  });

  it('requires TLS on the database URL in production', () => {
    expect(() =>
      validateEnv({ ...base(), NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example.com' }),
    ).toThrow(/sslmode/);

    expect(() =>
      validateEnv({
        ...base(),
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@h/db?sslmode=require',
        CORS_ORIGINS: 'https://app.example.com',
      }),
    ).not.toThrow();
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...base(), JWT_SECRET: 'too-short' })).toThrow(/32 characters/);
  });

  it('rejects well-known placeholder secrets', () => {
    expect(() => validateEnv({ ...base(), JWT_SECRET: 'secret'.padEnd(40, 'x') })).toThrow(
      /placeholder/i,
    );
    expect(() => validateEnv({ ...base(), JWT_SECRET: 'changeme'.padEnd(40, 'y') })).toThrow(
      /placeholder/i,
    );
  });

  it('rejects a low-entropy JWT secret', () => {
    expect(() => validateEnv({ ...base(), JWT_SECRET: 'ab'.repeat(20) })).toThrow(/entropy/);
  });

  it('rejects a refresh secret identical to the access secret', () => {
    expect(() =>
      validateEnv({
        ...base(),
        JWT_REFRESH_SECRET: base().JWT_SECRET,
      }),
    ).toThrow(/must differ/);
  });

  it('rejects a wildcard CORS origin', () => {
    expect(() => validateEnv({ ...base(), CORS_ORIGINS: '*' })).toThrow(/wildcard/);
  });

  it('requires an explicit CORS origin in production', () => {
    expect(() =>
      validateEnv({
        ...base(),
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://u:p@h/db?sslmode=require',
      }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('bounds the bcrypt cost', () => {
    expect(() => validateEnv({ ...base(), BCRYPT_ROUNDS: '4' })).toThrow(/BCRYPT_ROUNDS/);
    expect(() => validateEnv({ ...base(), BCRYPT_ROUNDS: '20' })).toThrow(/BCRYPT_ROUNDS/);
    expect(() => validateEnv({ ...base(), BCRYPT_ROUNDS: '12' })).not.toThrow();
  });

  it('bounds the lockout settings', () => {
    expect(() => validateEnv({ ...base(), MAX_LOGIN_ATTEMPTS: '1' })).toThrow(/MAX_LOGIN_ATTEMPTS/);
    expect(() => validateEnv({ ...base(), LOCKOUT_MINUTES: '0' })).toThrow(/LOCKOUT_MINUTES/);
  });

  it('requires a long enough encryption key when one is set', () => {
    expect(() => validateEnv({ ...base(), APP_ENCRYPTION_KEY: 'short' })).toThrow(
      /APP_ENCRYPTION_KEY/,
    );
  });

  it('collects every problem into a single error', () => {
    let message = '';
    try {
      validateEnv({ NODE_ENV: 'development' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/JWT_SECRET/);
  });
});
