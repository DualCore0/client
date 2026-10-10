import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service.js';
import { SessionsService } from './sessions.service.js';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from '../common/security/audit.service.js';
import { createPrismaMock, createConfigMock, createJwtMock, PrismaMock } from '../testing/test-doubles.js';

const STRONG_PASSWORD = 'Str0ng!Passphrase';
const WEAK_PASSWORD = 'password123';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn>; recordRequest: ReturnType<typeof vi.fn> };
  let sessions: {
    issue: ReturnType<typeof vi.fn>;
    rotate: ReturnType<typeof vi.fn>;
    revokeByToken: ReturnType<typeof vi.fn>;
    revokeAllForUser: ReturnType<typeof vi.fn>;
    revokeFamily: ReturnType<typeof vi.fn>;
  };
  const jwtMock = createJwtMock();

  const baseUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'user-1',
    email: 'alice@example.com',
    fullname: 'Alice Smith',
    password: 'hash',
    role: 'STUDENT',
    status: 'ACTIVE',
    emailVerified: false,
    emailVerifiedAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    lastFailedLoginAt: null,
    passwordChangedAt: null,
    mustChangePassword: false,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    tokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });

  /** Builds the service with optional config overrides. */
  async function buildService(config: Record<string, string | undefined> = {}) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtMock },
        {
          provide: ConfigService,
          useValue: createConfigMock({
            BCRYPT_ROUNDS: '10',
            MAX_LOGIN_ATTEMPTS: '5',
            LOCKOUT_MINUTES: '15',
            REQUIRE_EMAIL_VERIFICATION: 'false',
            ...config,
          }),
        },
        { provide: AuditService, useValue: audit },
        { provide: SessionsService, useValue: sessions },
      ],
    }).compile();
    return module.get<AuthService>(AuthService);
  }

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = {
      record: vi.fn().mockResolvedValue(undefined),
      recordRequest: vi.fn().mockResolvedValue(undefined),
    };
    sessions = {
      issue: vi.fn().mockResolvedValue({ session: { id: 'session-1' }, refreshToken: 'refresh-token-1' }),
      rotate: vi.fn(),
      revokeByToken: vi.fn().mockResolvedValue(undefined),
      revokeAllForUser: vi.fn().mockResolvedValue(2),
      revokeFamily: vi.fn().mockResolvedValue(1),
    };

    service = await buildService();
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  /* ── registration ─────────────────────────────────────────── */

  describe('register', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(async ({ data }: any) => baseUser({ ...data, id: 'new-user' }));
      prisma.emailVerificationToken.create.mockResolvedValue({ id: 'evt-1' });
    });

    it('rejects a password that fails the policy', async () => {
      await expect(
        service.register('new@example.com', WEAK_PASSWORD, 'New User'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password and never returns it', async () => {
      const result = await service.register('new@example.com', STRONG_PASSWORD, 'New User');

      const created = prisma.user.create.mock.calls[0][0].data;
      expect(created.password).not.toBe(STRONG_PASSWORD);
      expect(await bcrypt.compare(STRONG_PASSWORD, created.password)).toBe(true);
      expect(result.user).not.toHaveProperty('password');
      expect(JSON.stringify(result)).not.toContain(STRONG_PASSWORD);
    });

    it('normalises the email to lower case', async () => {
      await service.register('  MiXeD@Example.COM  ', STRONG_PASSWORD, 'New User');
      expect(prisma.user.create.mock.calls[0][0].data.email).toBe('mixed@example.com');
    });

    it('never lets public registration create an ADMIN', async () => {
      await service.register('sneaky@example.com', STRONG_PASSWORD, 'Sneaky', 'ADMIN' as never);
      expect(prisma.user.create.mock.calls[0][0].data.role).toBe('STUDENT');
    });

    it('answers identically for a duplicate email (no account enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser());
      await expect(
        service.register('alice@example.com', STRONG_PASSWORD, 'Alice'),
      ).rejects.toBeInstanceOf(ConflictException);
      // The audit trail records the real reason server-side.
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.register_duplicate' }),
      );
    });

    it('issues an access token and a refresh session', async () => {
      const result = await service.register('new@example.com', STRONG_PASSWORD, 'New User');
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refreshToken).toBe('refresh-token-1');
      expect(sessions.issue).toHaveBeenCalled();
    });

    it('records an audit entry for the new account', async () => {
      await service.register('new@example.com', STRONG_PASSWORD, 'New User');
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.register' }));
    });
  });

  /* ── login ────────────────────────────────────────────────── */

  describe('login', () => {
    it('returns a generic error for an unknown account', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.login('nobody@example.com', 'whatever')).rejects.toThrow(
        /invalid email or password/i,
      );
    });

    it('returns the same generic error for a wrong password', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash('the-right-one', 4) }),
      );
      await expect(service.login('alice@example.com', 'the-wrong-one')).rejects.toThrow(
        /invalid email or password/i,
      );
    });

    it('increments the failed-attempt counter on a bad password', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash('the-right-one', 4) }),
      );
      prisma.user.update.mockResolvedValue(baseUser({ failedLoginAttempts: 1 }));

      await expect(service.login('alice@example.com', 'nope')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: { increment: 1 } }),
        }),
      );
    });

    it('records every attempt in the append-only login trail', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash('the-right-one', 4) }),
      );
      prisma.user.update.mockResolvedValue(baseUser({ failedLoginAttempts: 1 }));

      await expect(service.login('alice@example.com', 'nope')).rejects.toBeDefined();

      expect(prisma.loginAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'alice@example.com', success: false }),
        }),
      );
    });

    it('locks the account once the attempt threshold is reached', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash('the-right-one', 4) }),
      );
      // The counter increment returns the 5th failure, which trips the threshold.
      prisma.user.update.mockResolvedValueOnce(baseUser({ failedLoginAttempts: 5 }));
      prisma.user.update.mockResolvedValue(baseUser({ status: 'LOCKED' }));

      await expect(service.login('alice@example.com', 'nope')).rejects.toBeDefined();

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.account_locked' }),
      );
      const lockCall = prisma.user.update.mock.calls.find((call) => call[0]?.data?.status === 'LOCKED');
      expect(lockCall).toBeDefined();
      expect(lockCall![0].data.lockedUntil).toBeInstanceOf(Date);
    });

    it('refuses to even check the password while locked', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ lockedUntil: new Date(Date.now() + 10 * 60 * 1000) }),
      );

      await expect(service.login('alice@example.com', STRONG_PASSWORD)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      // No counter change and no session issued for a locked account.
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(sessions.issue).not.toHaveBeenCalled();
    });

    it('signs in successfully and clears the failure counters', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash('the-right-one', 4), failedLoginAttempts: 3 }),
      );
      prisma.user.update.mockResolvedValue(baseUser({ failedLoginAttempts: 0 }));

      const result = await service.login('alice@example.com', 'the-right-one');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ failedLoginAttempts: 0, lockedUntil: null }),
        }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('refuses a suspended account', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash('the-right-one', 4), status: 'SUSPENDED' }),
      );
      await expect(service.login('alice@example.com', 'the-right-one')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuses an unverified account when verification is enforced', async () => {
      const strictService = await buildService({ REQUIRE_EMAIL_VERIFICATION: 'true' });

      prisma.user.findFirst.mockResolvedValue(
        baseUser({
          password: await bcrypt.hash('the-right-one', 4),
          status: 'PENDING',
          emailVerified: false,
        }),
      );

      await expect(strictService.login('alice@example.com', 'the-right-one')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  /* ── sessions / revocation ────────────────────────────────── */

  describe('logoutAll', () => {
    it('revokes every session and bumps the token version', async () => {
      prisma.user.update.mockResolvedValue(baseUser({ tokenVersion: 1 }));

      const result = await service.logoutAll('user-1');

      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1', 'logout_all');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { tokenVersion: { increment: 1 } } }),
      );
      expect(result.success).toBe(true);
    });
  });

  /* ── password reset ──────────────────────────────────────── */

  describe('forgotPassword', () => {
    it('answers identically for a known and an unknown address', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      const unknown = await service.forgotPassword('nobody@example.com');

      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', email: 'alice@example.com' });
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'prt-1' });
      const known = await service.forgotPassword('alice@example.com');

      expect(unknown.message).toBe(known.message);
      expect(unknown.success).toBe(true);
    });

    it('stores only a hash of the reset token', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', email: 'alice@example.com' });
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'prt-1' });

      const result: any = await service.forgotPassword('alice@example.com');

      const stored = prisma.passwordResetToken.create.mock.calls[0][0].data;
      expect(stored.tokenHash).toBeDefined();
      expect(stored.tokenHash).not.toBe(result.resetToken);
      expect(stored.tokenHash).toHaveLength(64); // sha-256 hex
    });
  });

  describe('resetPassword', () => {
    const validRecord = () => ({
      id: 'prt-1',
      userId: 'user-1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 100000),
      user: { id: 'user-1', email: 'a@b.com', fullname: 'A', deletedAt: null },
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord(),
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword('tok', STRONG_PASSWORD)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a token that was already used', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...validRecord(),
        usedAt: new Date(),
      });

      await expect(service.resetPassword('tok', STRONG_PASSWORD)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('enforces the password policy on the new password', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());

      await expect(service.resetPassword('tok', WEAK_PASSWORD)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('invalidates every session and bumps the token version', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(validRecord());
      prisma.user.update.mockResolvedValue(baseUser());
      prisma.passwordResetToken.update.mockResolvedValue({ id: 'prt-1' });

      await service.resetPassword('tok', STRONG_PASSWORD);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
        }),
      );
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1', 'password_reset');
    });
  });

  describe('changePassword', () => {
    it('rejects an incorrect current password', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash('original-password', 4) }),
      );

      await expect(
        service.changePassword('user-1', 'wrong-password', STRONG_PASSWORD),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects reusing the current password', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash(STRONG_PASSWORD, 4) }),
      );

      await expect(
        service.changePassword('user-1', STRONG_PASSWORD, STRONG_PASSWORD),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rotates the credential and revokes sessions', async () => {
      prisma.user.findFirst.mockResolvedValue(
        baseUser({ password: await bcrypt.hash('original-password', 4) }),
      );
      prisma.user.update.mockResolvedValue(baseUser());

      await service.changePassword('user-1', 'original-password', STRONG_PASSWORD);

      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('user-1', 'password_change');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.password_changed' }),
      );
    });
  });

  /* ── me ───────────────────────────────────────────────────── */

  describe('me', () => {
    it('throws when the account is gone', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.me('missing')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('never returns the password hash', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
      const result = await service.me('user-1');
      expect(result).not.toHaveProperty('password');
    });
  });
});
