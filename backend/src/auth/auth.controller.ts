import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';
import { requestContext } from '../common/http/request-context.js';
import { throttle } from '../common/config/throttle.js';

/** Name of the httpOnly cookie carrying the refresh token. */
export const REFRESH_COOKIE = 'classrank_refresh';

/** Refresh tokens never touch JavaScript. */
export function refreshCookieOptions() {
  const days = Number(process.env.REFRESH_TOKEN_DAYS ?? 30);
  const maxAge = (Number.isFinite(days) && days > 0 ? days : 30) * 24 * 60 * 60 * 1000;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Writes the refresh token as a cookie and strips it from the JSON body. */
  private issue(
    res: Response,
    result: { accessToken: string; refreshToken: string; user: unknown } & Record<string, unknown>,
  ) {
    res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
    const { refreshToken: _omit, ...rest } = result;
    return { ...rest, access_token: result.accessToken, token_type: 'Bearer' };
  }

  @Throttle(throttle.register())
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      dto.email,
      dto.password,
      dto.fullname,
      dto.role,
      requestContext(req),
    );
    return this.issue(res, result);
  }

  /** Kept as an alias so existing clients keep working. */
  @Throttle(throttle.register())
  @Post('signup')
  async signup(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(
      dto.email,
      dto.password,
      dto.fullname,
      dto.role,
      requestContext(req),
    );
    return this.issue(res, result);
  }

  @Throttle(throttle.login())
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password, requestContext(req));
    return this.issue(res, result);
  }

  /** Rotates the refresh token. Accepts the cookie or an explicit body token. */
  @Throttle(throttle.session())
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Body() body: { refresh_token?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) || body?.refresh_token;
    const result = await this.authService.refresh(token ?? '', requestContext(req));
    return this.issue(res, result);
  }

  @Throttle(throttle.session())
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) || undefined;
    const userId = (req.user as { userId?: string } | undefined)?.userId;
    const result = await this.authService.logout(token, requestContext(req), userId);
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(throttle.session())
  @HttpCode(HttpStatus.OK)
  @Post('logout-all')
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const userId = (req.user as { userId: string }).userId;
    const result = await this.authService.logoutAll(userId, requestContext(req));
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: Request) {
    return this.authService.me((req.user as { userId: string }).userId);
  }

  @Throttle(throttle.sensitive())
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto.email, requestContext(req));
  }

  @Throttle(throttle.sensitive())
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.resetPassword(dto.token, dto.password, requestContext(req));
    // Force a fresh sign-in everywhere.
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(throttle.sensitive())
  @HttpCode(HttpStatus.OK)
  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const userId = (req.user as { userId: string }).userId;
    const result = await this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      requestContext(req),
    );
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    return result;
  }

  @Throttle(throttle.sensitive())
  @HttpCode(HttpStatus.OK)
  @Post('verify-email')
  verifyEmail(@Body() body: { token: string }, @Req() req: Request) {
    return this.authService.verifyEmail(String(body?.token ?? ''), requestContext(req));
  }

  @UseGuards(JwtAuthGuard)
  @Throttle(throttle.resend())
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Req() req: Request) {
    return this.authService.resendVerification((req.user as { userId: string }).userId, requestContext(req));
  }
}
