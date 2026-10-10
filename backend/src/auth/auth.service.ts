import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { Role, UserStatus } from '@prisma/client';

import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../common/security/audit.service.js';
import { validatePasswordStrength } from '../common/security/password-policy.js';
import { SessionsService, type SessionContext } from './sessions.service.js';

/** Uniform message for every credential failure — prevents user enumeration. */
const GENERIC_CREDENTIALS_ERROR = 'Invalid email or password';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = AuthTokens & {
  user: {
    id: string;
    email: string;
    fullname: string | null;
    role: Role;
    status: UserStatus;
    emailVerified: boolean;
    createdAt: Date;
  };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** Hash compared against when the account does not exist, to equalise timing. */
  private dummyHash: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly sessions: SessionsService,
  ) {}

  /* ── configuration helpers ─────────────────────────────────── */

  private get bcryptRounds(): number {
    const raw = Number(this.config.get<string>('BCRYPT_ROUNDS') ?? 12);
    return Number.isInteger(raw) && raw >= 10 && raw <= 15 ? raw : 12;
  }

  private get maxLoginAttempts(): number {
    const raw = Number(this.config.get<string>('MAX_LOGIN_ATTEMPTS') ?? 5);
    return Number.isInteger(raw) && raw >= 3 ? raw : 5;
  }

  private get lockoutMs(): number {
    const minutes = Number(this.config.get<string>('LOCKOUT_MINUTES') ?? 15);
    const safe = Number.isInteger(minutes) && minutes > 0 ? minutes : 15;
    return safe * 60 * 1000;
  }

  private get requiresEmailVerification(): boolean {
    return String(this.config.get<string>('REQUIRE_EMAIL_VERIFICATION') ?? 'false').toLowerCase() === 'true';
  }

  /** Ensures a bcrypt hash exists to compare against for unknown accounts. */
  private async getDummyHash(): Promise<string> {
    if (!this.dummyHash) {
      this.dummyHash = await bcrypt.hash(randomUUID(), this.bcryptRounds);
    }
    return this.dummyHash;
  }

  /* ── token helpers ─────────────────────────────────────────── */

  private async signAccessToken(user: {
    id: string;
    email: string;
    role: Role;
    tokenVersion: number;
  }): Promise<string> {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      // Bumped to invalidate every outstanding access token.
      tv: user.tokenVersion,
    });
  }

  private publicUser(user: {
    id: string;
    email: string;
    fullname: string | null;
    role: Role;
    status: UserStatus;
    emailVerified: boolean;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullname: user.fullname,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /* ── registration ──────────────────────────────────────────── */

  async register(
    email: string,
    password: string,
    fullname: string,
    role: Role = Role.STUDENT,
    ctx: SessionContext = {},
  ): Promise<AuthResult & { verificationToken?: string }> {
    const normalizedEmail = email.trim().toLowerCase();

    // Defence in depth: re-validate even though the DTO already did.
    const policy = validatePasswordStrength(password, { email: normalizedEmail, fullname });
    if (!policy.ok) {
      throw new BadRequestException(policy.errors);
    }

    // Public registration can never mint an ADMIN.
    const safeRole = role === Role.ADMIN ? Role.STUDENT : role;

    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      // Do not confirm whether the address is registered.
      await this.audit.record({
        action: 'auth.register_duplicate',
        actorEmail: normalizedEmail,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      // Generic message: it must not confirm whether the address is registered.
      throw new ConflictException('An account with these details already exists');
    }

    const passwordHash = await bcrypt.hash(password, this.bcryptRounds);
    const requireVerification = this.requiresEmailVerification;

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        fullname,
        password: passwordHash,
        role: safeRole,
        status: requireVerification ? UserStatus.PENDING : UserStatus.ACTIVE,
        passwordChangedAt: new Date(),
        lastLoginIp: ctx.ip ?? null,
      },
    });

    // Issue an email-verification token (hash at rest, single use).
    const rawVerificationToken = randomBytes(32).toString('base64url');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawVerificationToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.record({
      action: 'auth.register',
      actorId: user.id,
      actorEmail: user.email,
      entity: 'User',
      entityId: user.id,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: { role: safeRole, emailVerificationRequired: requireVerification },
    });

    const tokens = await this.issueTokens(user, ctx);

    return {
      ...tokens,
      user: this.publicUser(user),
      // Only surfaced outside production so the flow is testable without a mailer.
      ...(process.env.NODE_ENV !== 'production' ? { verificationToken: rawVerificationToken } : {}),
    };
  }

  /* ── login ─────────────────────────────────────────────────── */

  async login(email: string, password: string, ctx: SessionContext = {}): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    /* Lockout is checked before password verification. */
    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const seconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      await this.recordAttempt(normalizedEmail, false, 'locked', ctx);
      await this.audit.record({
        action: 'auth.login_blocked_locked',
        actorId: user.id,
        actorEmail: normalizedEmail,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      throw new ForbiddenException(
        `Account temporarily locked after too many failed attempts. Try again in ${seconds} second(s).`,
      );
    }

    // Always run a comparison so response timing does not reveal existence.
    const hash = user?.password ?? (await this.getDummyHash());
    const passwordMatches = await bcrypt.compare(password, hash);

    if (!user || !passwordMatches) {
      if (user) await this.registerFailedAttempt(user.id);
      await this.recordAttempt(normalizedEmail, false, user ? 'bad_password' : 'unknown_user', ctx);
      await this.audit.record({
        action: 'auth.login_failed',
        actorId: user?.id ?? null,
        actorEmail: normalizedEmail,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        metadata: { reason: user ? 'bad_password' : 'unknown_user' },
      });
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }

    if (user.deletedAt) {
      await this.recordAttempt(normalizedEmail, false, 'deleted', ctx);
      throw new UnauthorizedException(GENERIC_CREDENTIALS_ERROR);
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.LOCKED) {
      await this.recordAttempt(normalizedEmail, false, 'suspended', ctx);
      await this.audit.record({
        action: 'auth.login_blocked_status',
        actorId: user.id,
        actorEmail: normalizedEmail,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
        metadata: { status: user.status },
      });
      throw new ForbiddenException('This account is not active. Contact an administrator.');
    }

    if (user.status === UserStatus.PENDING && this.requiresEmailVerification && !user.emailVerified) {
      await this.recordAttempt(normalizedEmail, false, 'email_unverified', ctx);
      throw new ForbiddenException('Please verify your email address before signing in.');
    }

    /* Success: clear the counter, record the login. */
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ctx.ip ?? null,
      },
    });

    await this.recordAttempt(normalizedEmail, true, null, ctx);
    await this.audit.record({
      action: 'auth.login',
      actorId: user.id,
      actorEmail: user.email,
      entity: 'User',
      entityId: user.id,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    const tokens = await this.issueTokens(updated, ctx);
    return { ...tokens, user: this.publicUser(updated) };
  }

  private async registerFailedAttempt(userId: string): Promise<void> {
    // A bookkeeping failure must never change the authentication outcome: the
    // caller still returns the same generic error either way.
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { failedLoginAttempts: { increment: 1 }, lastFailedLoginAt: new Date() },
        select: { failedLoginAttempts: true },
      });

      if (user && user.failedLoginAttempts >= this.maxLoginAttempts) {
        const lockedUntil = new Date(Date.now() + this.lockoutMs);
        await this.prisma.user.update({
          where: { id: userId },
          data: { lockedUntil, status: UserStatus.LOCKED, failedLoginAttempts: 0 },
        });
        await this.audit.record({
          action: 'auth.account_locked',
          actorId: userId,
          entity: 'User',
          entityId: userId,
          metadata: { lockedUntil: lockedUntil.toISOString(), threshold: this.maxLoginAttempts },
        });
        this.logger.warn(`Account ${userId} locked until ${lockedUntil.toISOString()}`);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Could not record the failed attempt for ${userId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async recordAttempt(
    email: string,
    success: boolean,
    reason: string | null,
    ctx: SessionContext,
  ): Promise<void> {
    try {
      await this.prisma.loginAttempt.create({
        data: {
          email: email.slice(0, 254),
          success,
          reason,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent?.slice(0, 500) ?? null,
        },
      });
    } catch (error: unknown) {
      this.logger.warn(`Could not record login attempt: ${error instanceof Error ? error.message : error}`);
    }
  }

  /* ── tokens / sessions ─────────────────────────────────────── */

  private async issueTokens(
    user: { id: string; email: string; role: Role; tokenVersion: number },
    ctx: SessionContext,
  ): Promise<AuthTokens> {
    const [accessToken, session] = await Promise.all([
      this.signAccessToken(user),
      this.sessions.issue(user.id, ctx),
    ]);
    return { accessToken, refreshToken: session.refreshToken };
  }

  /** Exchanges a refresh token for a new pair, rotating the token. */
  async refresh(refreshToken: string, ctx: SessionContext = {}): Promise<AuthResult> {
    let rotated;
    try {
      rotated = await this.sessions.rotate(refreshToken, ctx);
    } catch (error) {
      await this.audit.record({
        action: 'auth.refresh_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      throw error;
    }

    const user = rotated.user;
    const fresh = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, email: true, fullname: true, role: true, status: true,
        emailVerified: true, createdAt: true, tokenVersion: true, deletedAt: true,
      },
    });

    if (!fresh || fresh.deletedAt || fresh.status === UserStatus.SUSPENDED) {
      await this.sessions.revokeAllForUser(user.id, 'account_inactive');
      throw new UnauthorizedException('Account is not active');
    }

    const accessToken = await this.signAccessToken(fresh);
    return { accessToken, refreshToken: rotated.refreshToken, user: this.publicUser(fresh) };
  }

  async logout(refreshToken: string | undefined, ctx: SessionContext = {}, userId?: string) {
    if (refreshToken) await this.sessions.revokeByToken(refreshToken, 'logout');
    await this.audit.record({
      action: 'auth.logout',
      actorId: userId ?? null,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    return { success: true };
  }

  /** Signs the user out of every device and invalidates outstanding access tokens. */
  async logoutAll(userId: string, ctx: SessionContext = {}) {
    const [sessionsRevoked] = await Promise.all([
      this.sessions.revokeAllForUser(userId, 'logout_all'),
      this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
    await this.audit.record({
      action: 'auth.logout_all',
      actorId: userId,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: { sessionsRevoked },
    });
    return { success: true, sessionsRevoked };
  }

  /* ── password lifecycle ────────────────────────────────────── */

  async forgotPassword(email: string, ctx: SessionContext = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
      select: { id: true, email: true },
    });

    // Always answer identically so the endpoint cannot enumerate accounts.
    const genericResponse = {
      success: true,
      message: 'If an account exists for that address, a reset link has been sent.',
    };

    if (!user) {
      await this.audit.record({
        action: 'auth.password_reset_requested_unknown',
        actorEmail: normalizedEmail,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      return genericResponse;
    }

    const rawToken = randomBytes(32).toString('base64url');

    // Invalidate any outstanding tokens for this user first.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        ip: ctx.ip ?? null,
      },
    });

    await this.audit.record({
      action: 'auth.password_reset_requested',
      actorId: user.id,
      actorEmail: user.email,
      entity: 'User',
      entityId: user.id,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    return {
      ...genericResponse,
      // Without a mail provider the token is logged; surfaced in dev only.
      ...(process.env.NODE_ENV !== 'production' ? { resetToken: rawToken } : {}),
    };
  }

  async resetPassword(token: string, newPassword: string, ctx: SessionContext = {}) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: { select: { id: true, email: true, fullname: true, deletedAt: true } } },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      await this.audit.record({
        action: 'auth.password_reset_failed',
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    if (record.user.deletedAt) {
      throw new BadRequestException('This reset link is invalid or has expired');
    }

    const policy = validatePasswordStrength(newPassword, {
      email: record.user.email,
      fullname: record.user.fullname ?? undefined,
    });
    if (!policy.ok) throw new BadRequestException(policy.errors);

    const passwordHash = await bcrypt.hash(newPassword, this.bcryptRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          password: passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          // A LOCKED account becomes usable again after a reset.
          status: UserStatus.ACTIVE,
          // Invalidate every existing access token.
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Every session is untrusted after a password reset.
    const sessionsRevoked = await this.sessions.revokeAllForUser(record.userId, 'password_reset');

    await this.audit.record({
      action: 'auth.password_reset_completed',
      actorId: record.userId,
      actorEmail: record.user.email,
      entity: 'User',
      entityId: record.userId,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: { sessionsRevoked },
    });

    return { success: true, message: 'Password updated. Please sign in again.' };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ctx: SessionContext = {},
  ) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new UnauthorizedException('Account not found');

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      await this.audit.record({
        action: 'auth.password_change_failed',
        actorId: userId,
        actorEmail: user.email,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      throw new BadRequestException('The new password must differ from the current password');
    }

    const policy = validatePasswordStrength(newPassword, {
      email: user.email,
      fullname: user.fullname ?? undefined,
    });
    if (!policy.ok) throw new BadRequestException(policy.errors);

    const passwordHash = await bcrypt.hash(newPassword, this.bcryptRounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: passwordHash,
        passwordChangedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    });

    const sessionsRevoked = await this.sessions.revokeAllForUser(userId, 'password_change');

    await this.audit.record({
      action: 'auth.password_changed',
      actorId: userId,
      actorEmail: user.email,
      entity: 'User',
      entityId: userId,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
      metadata: { sessionsRevoked },
    });

    return { success: true, sessionsRevoked };
  }

  /* ── email verification ────────────────────────────────────── */

  async verifyEmail(token: string, ctx: SessionContext = {}) {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
      include: { user: { select: { id: true, email: true, emailVerified: true } } },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This verification link is invalid or has expired');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true, emailVerifiedAt: new Date(), status: UserStatus.ACTIVE },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      action: 'auth.email_verified',
      actorId: record.userId,
      actorEmail: record.user.email,
      entity: 'User',
      entityId: record.userId,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    return { success: true };
  }

  /** Re-issues a verification token for the signed-in user. */
  async resendVerification(userId: string, ctx: SessionContext = {}) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, emailVerified: true },
    });
    if (!user) throw new UnauthorizedException('Account not found');
    if (user.emailVerified) return { success: true, alreadyVerified: true };

    await this.prisma.emailVerificationToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(32).toString('base64url');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await this.audit.record({
      action: 'auth.verification_resent',
      actorId: user.id,
      actorEmail: user.email,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });

    return {
      success: true,
      ...(process.env.NODE_ENV !== 'production' ? { verificationToken: rawToken } : {}),
    };
  }

  /* ── current user ──────────────────────────────────────────── */

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        id: true, email: true, fullname: true, role: true, status: true,
        emailVerified: true, createdAt: true, lastLoginAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }
}
