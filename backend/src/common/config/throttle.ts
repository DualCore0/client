/**
 * Rate-limit configuration.
 *
 * Limits are read from the environment at module-load time so that operations
 * can tune them per deployment (and so integration tests can raise them)
 * without a code change. Every value is validated and falls back to a safe
 * default.
 */

function limitFromEnv(key: string, fallback: number): number {
  const raw = Number(process.env[key]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const TTL = 60_000;

/** Builds a @Throttle() argument for the named throttler. */
function bucket(envKey: string, fallback: number) {
  return { default: { limit: limitFromEnv(envKey, fallback), ttl: TTL } };
}

export const throttle = {
  /** Account creation — the tightest budget. */
  register: () => bucket('THROTTLE_REGISTER_LIMIT', 5),
  /** Credential submission. */
  login: () => bucket('THROTTLE_LOGIN_LIMIT', 10),
  /** Token rotation and session teardown (legitimate clients call these often). */
  session: () => bucket('THROTTLE_SESSION_LIMIT', 30),
  /** Anything that triggers outbound email or expensive verification work. */
  sensitive: () => bucket('THROTTLE_SENSITIVE_LIMIT', 5),
  /** LLM calls — expensive and abusable. */
  expensive: () => bucket('THROTTLE_EXPENSIVE_LIMIT', 5),
  /** Verification resend. */
  resend: () => bucket('THROTTLE_RESEND_LIMIT', 3),
};

/** Global default applied to every route by the ThrottlerGuard. */
export function globalThrottleLimit(): number {
  return limitFromEnv('THROTTLE_GLOBAL_LIMIT', 100);
}

/** True when the deployment has widened the limits (used by test tooling). */
export function limitsAreRelaxed(): boolean {
  return limitFromEnv('THROTTLE_LOGIN_LIMIT', 10) > 50;
}
