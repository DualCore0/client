import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';

import { AuthController, REFRESH_COOKIE } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: Record<string, ReturnType<typeof vi.fn>>;

  /** Minimal Express Response double that records cookie writes. */
  function resDouble() {
    const cookies: Record<string, unknown> = {};
    const cleared: string[] = [];
    const res = {
      cookie: vi.fn((name: string, value: unknown) => {
        cookies[name] = value;
        return res;
      }),
      clearCookie: vi.fn((name: string) => {
        cleared.push(name);
        return res;
      }),
    };
    return { res: res as unknown as Response, cookies, cleared };
  }

  const reqDouble = (overrides: Partial<Request> = {}) =>
    ({ cookies: {}, headers: {}, ip: '127.0.0.1', ...overrides }) as unknown as Request;

  const authResult = () => ({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    user: { id: 'user-1', email: 'alice@example.com', role: 'STUDENT' },
  });

  beforeEach(async () => {
    authService = {
      register: vi.fn().mockResolvedValue(authResult()),
      login: vi.fn().mockResolvedValue(authResult()),
      refresh: vi.fn().mockResolvedValue(authResult()),
      logout: vi.fn().mockResolvedValue({ success: true }),
      logoutAll: vi.fn().mockResolvedValue({ success: true, sessionsRevoked: 2 }),
      me: vi.fn().mockResolvedValue({ id: 'user-1' }),
      forgotPassword: vi.fn().mockResolvedValue({ success: true }),
      resetPassword: vi.fn().mockResolvedValue({ success: true }),
      changePassword: vi.fn().mockResolvedValue({ success: true }),
      verifyEmail: vi.fn().mockResolvedValue({ success: true }),
      resendVerification: vi.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('returns the access token in the body and the refresh token only as a cookie', async () => {
      const { res, cookies } = resDouble();

      const body: any = await controller.login(
        { email: 'alice@example.com', password: 'pw' } as any,
        reqDouble(),
        res,
      );

      expect(body.access_token).toBe('access-1');
      expect(body.token_type).toBe('Bearer');
      // The refresh token must never appear in the JSON payload.
      expect(body).not.toHaveProperty('refreshToken');
      expect(body).not.toHaveProperty('refresh_token');
      expect(JSON.stringify(body)).not.toContain('refresh-1');

      // ...but it is set as a cookie.
      expect(cookies[REFRESH_COOKIE]).toBe('refresh-1');
      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE,
        'refresh-1',
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
    });

    it('passes the request context through for auditing', async () => {
      const { res } = resDouble();
      await controller.login(
        { email: 'alice@example.com', password: 'pw' } as any,
        reqDouble({ ip: '10.0.0.5' }),
        res,
      );
      expect(authService.login).toHaveBeenCalledWith(
        'alice@example.com',
        'pw',
        expect.objectContaining({ ip: '10.0.0.5' }),
      );
    });
  });

  describe('register', () => {
    it('sets the refresh cookie and forwards the role', async () => {
      const { res, cookies } = resDouble();
      await controller.register(
        { email: 'a@b.com', password: 'pw', fullname: 'A', role: 'TEACHER' } as any,
        reqDouble(),
        res,
      );

      expect(authService.register).toHaveBeenCalledWith(
        'a@b.com',
        'pw',
        'A',
        'TEACHER',
        expect.anything(),
      );
      expect(cookies[REFRESH_COOKIE]).toBe('refresh-1');
    });

    it('exposes /auth/signup as an alias', async () => {
      const { res } = resDouble();
      await controller.signup(
        { email: 'a@b.com', password: 'pw', fullname: 'A' } as any,
        reqDouble(),
        res,
      );
      expect(authService.register).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('uses the cookie when present', async () => {
      const { res } = resDouble();
      await controller.refresh({}, reqDouble({ cookies: { [REFRESH_COOKIE]: 'cookie-token' } } as any), res);
      expect(authService.refresh).toHaveBeenCalledWith('cookie-token', expect.anything());
    });

    it('falls back to the body token for non-browser clients', async () => {
      const { res } = resDouble();
      await controller.refresh({ refresh_token: 'body-token' }, reqDouble(), res);
      expect(authService.refresh).toHaveBeenCalledWith('body-token', expect.anything());
    });

    it('rotates the cookie to the new token', async () => {
      const { res, cookies } = resDouble();
      await controller.refresh({}, reqDouble({ cookies: { [REFRESH_COOKIE]: 'old' } } as any), res);
      expect(cookies[REFRESH_COOKIE]).toBe('refresh-1');
    });
  });

  describe('logout', () => {
    it('revokes the session and clears the cookie', async () => {
      const { res, cleared } = resDouble();
      await controller.logout(reqDouble({ cookies: { [REFRESH_COOKIE]: 'tok' } } as any), res);

      expect(authService.logout).toHaveBeenCalledWith('tok', expect.anything(), undefined);
      expect(cleared).toContain(REFRESH_COOKIE);
    });
  });

  describe('logoutAll', () => {
    it('scopes revocation to the authenticated user and clears the cookie', async () => {
      const { res, cleared } = resDouble();
      await controller.logoutAll(reqDouble({ user: { userId: 'user-1' } } as any), res);

      expect(authService.logoutAll).toHaveBeenCalledWith('user-1', expect.anything());
      expect(cleared).toContain(REFRESH_COOKIE);
    });
  });

  describe('me', () => {
    it('resolves the user from the token subject', async () => {
      await controller.me(reqDouble({ user: { userId: 'user-1' } } as any));
      expect(authService.me).toHaveBeenCalledWith('user-1');
    });
  });

  describe('password endpoints', () => {
    it('forwards forgot-password', async () => {
      await controller.forgotPassword({ email: 'a@b.com' } as any, reqDouble());
      expect(authService.forgotPassword).toHaveBeenCalledWith('a@b.com', expect.anything());
    });

    it('clears the refresh cookie after a reset so a fresh sign-in is required', async () => {
      const { res, cleared } = resDouble();
      await controller.resetPassword({ token: 't', password: 'pw' } as any, reqDouble(), res);
      expect(authService.resetPassword).toHaveBeenCalledWith('t', 'pw', expect.anything());
      expect(cleared).toContain(REFRESH_COOKIE);
    });

    it('clears the refresh cookie after a password change', async () => {
      const { res, cleared } = resDouble();
      await controller.changePassword(
        { currentPassword: 'old', newPassword: 'new' } as any,
        reqDouble({ user: { userId: 'user-1' } } as any),
        res,
      );
      expect(authService.changePassword).toHaveBeenCalledWith(
        'user-1',
        'old',
        'new',
        expect.anything(),
      );
      expect(cleared).toContain(REFRESH_COOKIE);
    });
  });
});
