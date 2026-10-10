import type { Request } from 'express';

export type RequestContext = {
  ip: string | null;
  userAgent: string | null;
};

/**
 * Extracts the client IP and user agent for audit records.
 *
 * X-Forwarded-For is only trusted because the app runs behind a proxy it
 * controls (Express `trust proxy` is enabled in main.ts). The left-most entry
 * is the original client.
 */
export function requestContext(req: Request | undefined): RequestContext {
  if (!req) return { ip: null, userAgent: null };

  const forwarded = req.headers['x-forwarded-for'];
  let ip: string | null = null;

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    ip = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    ip = forwarded[0].split(',')[0].trim();
  } else {
    ip = req.ip ?? req.socket?.remoteAddress ?? null;
  }

  // Normalise IPv6-mapped IPv4 addresses.
  if (ip?.startsWith('::ffff:')) ip = ip.slice('::ffff:'.length);
  if (ip && ip.length > 45) ip = ip.slice(0, 45);

  const header = req.headers['user-agent'];
  const userAgent = typeof header === 'string' ? header.slice(0, 500) : null;

  return { ip, userAgent };
}

/** Best-effort client IP for rate limiting / lockout keys. */
export function clientIp(req: Request | undefined): string {
  return requestContext(req).ip ?? 'unknown';
}
