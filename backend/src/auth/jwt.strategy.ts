import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserStatus } from '@prisma/client';

import { PrismaService } from '../prisma.service.js';

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  tv?: number;
  iat?: number;
  exp?: number;
};

export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: string;
};

/**
 * Validates the access token *and* the account behind it.
 *
 * A JWT alone is not enough: on every request we re-check that the account is
 * still live and that its `tokenVersion` still matches the token. Bumping
 * `tokenVersion` (password change, password reset, sign-out-everywhere) or
 * suspending/deleting the account therefore invalidates every issued token
 * immediately, which is what makes revocation real rather than theoretical.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
      issuer: 'classrank',
      audience: 'classrank-web',
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        tokenVersion: true,
        deletedAt: true,
        lockedUntil: true,
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists');
    }

    // Tokens minted before the latest version bump are rejected.
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      throw new UnauthorizedException('Session expired — please sign in again');
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('Account is not active');
    }

    // A lock only blocks new sign-ins; an existing session stays valid until it
    // expires or the version is bumped, which is the standard trade-off.
    return { userId: user.id, email: user.email, role: user.role };
  }
}
