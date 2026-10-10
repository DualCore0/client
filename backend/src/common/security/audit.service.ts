import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service.js';

export type AuditInput = {
  action: string;
  actorId?: string | null;
  actorEmail?: string | null;
  entity?: string | null;
  entityId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Keys that must never reach the audit trail. */
const FORBIDDEN_META_KEYS = [
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
  'token',
  'access_token',
  'refreshToken',
  'refresh_token',
  'tokenHash',
  'twoFactorSecret',
  'secret',
  'authorization',
  'cookie',
];

/**
 * Append-only security audit trail.
 *
 * The database enforces append-only at the row level (see
 * prisma/security-hardening.sql), so this service only ever inserts.
 * Failures to write an audit row are logged but never break the request.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Recursively removes sensitive keys from a metadata object. */
  private redact(value: unknown, depth = 0): unknown {
    if (depth > 6 || value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => this.redact(item, depth + 1));

    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_META_KEYS.includes(key)) {
        out[key] = '[redacted]';
      } else {
        out[key] = this.redact(raw, depth + 1);
      }
    }
    return out;
  }

  async record(input: AuditInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: input.action,
          actorId: input.actorId ?? null,
          actorEmail: input.actorEmail ?? null,
          entity: input.entity ?? null,
          entityId: input.entityId ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent?.slice(0, 500) ?? null,
          metadata: (this.redact(input.metadata ?? null) ?? undefined) as never,
        },
      });
    } catch (error: unknown) {
      // Never let auditing break a user-facing flow, but do surface the failure.
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to write audit entry "${input.action}": ${message}`);
    }
  }

  /** Convenience wrapper that also records the authentication context. */
  async recordRequest(
    action: string,
    ctx: { userId?: string | null; email?: string | null; ip?: string | null; userAgent?: string | null },
    extra: Partial<AuditInput> = {},
  ): Promise<void> {
    await this.record({
      action,
      actorId: ctx.userId ?? null,
      actorEmail: ctx.email ?? null,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      ...extra,
    });
  }
}
