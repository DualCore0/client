/**
 * Environment validation. Runs at boot so a misconfigured deployment fails
 * fast and loudly instead of silently running with a weak secret.
 */
const PLACEHOLDERS = new Set([
  'secret',
  'changeme',
  'change-me',
  'jwt_secret',
  'your-secret-key',
  'test',
  'password',
  'supersecret',
  'development',
]);

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  const str = (key: string) => (typeof config[key] === 'string' ? (config[key] as string).trim() : '');

  /* ── required values ──────────────────────────────────────── */
  for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
    if (!str(key)) errors.push(`${key} is required`);
  }

  const databaseUrl = str('DATABASE_URL');
  if (databaseUrl && !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    errors.push('DATABASE_URL must be a postgres:// or postgresql:// connection string');
  }

  if (databaseUrl && isProduction && !/sslmode=(require|verify-full|verify-ca)/i.test(databaseUrl)) {
    errors.push('DATABASE_URL must enable TLS (append ?sslmode=require) in production');
  }

  /* ── JWT secret strength ──────────────────────────────────── */
  const jwtSecret = str('JWT_SECRET');
  if (jwtSecret) {
    const lowerSecret = jwtSecret.toLowerCase();
    // Exact match, or a secret built from a placeholder plus padding such as
    // "secret-<random>" / "changeme123..." — both are trivially guessable.
    const looksLikePlaceholder =
      PLACEHOLDERS.has(lowerSecret) ||
      [...PLACEHOLDERS].some((placeholder) => lowerSecret.startsWith(placeholder));

    if (jwtSecret.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters long');
    }
    if (looksLikePlaceholder) {
      errors.push('JWT_SECRET is a well-known placeholder value — generate a unique secret');
    }
    if (new Set(jwtSecret).size < 8) {
      errors.push('JWT_SECRET has too little entropy (fewer than 8 distinct characters)');
    }
  }

  const refreshSecret = str('JWT_REFRESH_SECRET');
  if (refreshSecret && refreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters long');
  }
  if (refreshSecret && refreshSecret === jwtSecret) {
    errors.push('JWT_REFRESH_SECRET must differ from JWT_SECRET');
  }

  /* ── optional but security-relevant ───────────────────────── */
  const encryptionKey = str('APP_ENCRYPTION_KEY');
  if (encryptionKey && encryptionKey.length < 32) {
    errors.push('APP_ENCRYPTION_KEY must be at least 32 characters long when set');
  }
  if (isProduction && !encryptionKey) {
    warnings.push('APP_ENCRYPTION_KEY is not set — two-factor secrets cannot be stored securely');
  }

  const origins = str('CORS_ORIGINS') || str('FRONTEND_URL');
  if (isProduction && !origins) {
    errors.push('CORS_ORIGINS (or FRONTEND_URL) must be set in production');
  }
  if (origins && origins.includes('*')) {
    errors.push('CORS_ORIGINS must not contain a wildcard — list explicit origins');
  }

  const bcryptRounds = Number(config.BCRYPT_ROUNDS ?? 12);
  if (!Number.isInteger(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 15) {
    errors.push('BCRYPT_ROUNDS must be an integer between 10 and 15');
  }

  const maxAttempts = Number(config.MAX_LOGIN_ATTEMPTS ?? 5);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 3 || maxAttempts > 20) {
    errors.push('MAX_LOGIN_ATTEMPTS must be an integer between 3 and 20');
  }

  const lockMinutes = Number(config.LOCKOUT_MINUTES ?? 15);
  if (!Number.isInteger(lockMinutes) || lockMinutes < 1 || lockMinutes > 1440) {
    errors.push('LOCKOUT_MINUTES must be an integer between 1 and 1440');
  }

  /* ── surface the result ───────────────────────────────────── */
  for (const warning of warnings) {
    // eslint-disable-next-line no-console
    console.warn(`[env] warning: ${warning}`);
  }

  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  }

  return config;
}
