import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../common/security/audit.service.js';

const REFRESH_TOKEN_BYTES = 48;

/** SHA-256 hex digest — what actually gets stored. */
function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

function newRefreshToken(): string {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

/** Constant-time comparison for two hex digests of equal length. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type SessionContext = {
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * Refresh-token session management with rotation and replay detection.
 *
 * Only the SHA-256 hash of a refresh token is persisted, so a database leak
 * does not yield usable credentials. Every rotation revokes the previous token;
 * presenting an already-revoked token means it was stolen, so the whole
 * rotation family is revoked immediately.
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private ttlMs(): number {
    const days = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
    const safeDays = Number.isFinite(days) && days > 0 && days <= 365 ? days : 30;
    return safeDays * 24 * 60 * 60 * 1000;
  }

  /** Creates a brand new session (new rotation family). */
  async issue(userId: string, ctx: SessionContext = {}) {
    const raw = newRefreshToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: hashToken(raw),
        familyId: randomUUID(),
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 500) ?? null,
        expiresAt: new Date(Date.now() + this.ttlMs()),
      },
    });
    return { session, refreshToken: raw };
  }

  /**
   * Rotates a refresh token. Returns the replacement token plus the owning user.
   * Throws UnauthorizedException for unknown, expired, or replayed tokens.
   */
  async rotate(rawToken: string, ctx: SessionContext = {}) {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const digest = hashToken(rawToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: digest },
      include: { user: { select: { id: true, email: true, role: true, status: true, deletedAt: true, tokenVersion: true } } },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Replay of a revoked token: assume theft and burn the entire family.
    if (session.revokedAt) {
      await this.revokeFamily(session.familyId, 'refresh_token_reuse_detected');
      await this.audit.record({
        action: 'auth.refresh_reuse_detected',
        actorId: session.userId,
        actorEmail: session.user.email,
        entity: 'Session',
        entityId: session.id,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        metadata: { familyId: session.familyId },
      });
      this.logger.warn(`Refresh token reuse detected for user ${session.userId}; family revoked.`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), revokedReason: 'expired' },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = session.user;
    if (!user || user.deletedAt || user.status === 'DELETED' || user.status === 'SUSPENDED') {
      await this.revokeFamily(session.familyId, 'account_inactive');
      throw new UnauthorizedException('Account is not active');
    }

    const raw = newRefreshToken();
    const [, next] = await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), revokedReason: 'rotated', lastUsedAt: new Date() },
      }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: hashToken(raw),
          familyId: session.familyId,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent?.slice(0, 500) ?? null,
          expiresAt: new Date(Date.now() + this.ttlMs()),
        },
      }),
    ]);

    return { session: next, refreshToken: raw, user };
  }

  /** Revokes a single session identified by its raw refresh token. */
  async revokeByToken(rawToken: string, reason = 'logout'): Promise<void> {
    if (!rawToken) return;
    const digest = hashToken(rawToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: digest } });
    if (!session || session.revokedAt) return;
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: reason, lastUsedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string, reason: string): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  async revokeAllForUser(userId: string, reason = 'logout_all'): Promise<number> {
    const result = await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  /** Housekeeping: drop sessions that expired more than `days` ago. */
  async purgeExpired(days = 7): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await this.prisma.session.deleteMany({ where: { expiresAt: { lt: cutoff } } });
    return result.count;
  }

  /** Exposed for tests: verifies a raw token matches a stored hash. */
  static matches(rawToken: string, storedHash: string): boolean {
    return safeEqual(hashToken(rawToken), storedHash);
  }
}
