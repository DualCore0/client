import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { SessionsService } from './sessions.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { UsersModule } from '../users/users.module.js';
import { PrismaModule } from '../prisma.module.js';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          // Short-lived access tokens; the refresh cookie carries the session.
          // Cast because the ms template-literal type cannot accept a plain string.
          expiresIn: (configService.get<string>('ACCESS_TOKEN_TTL') || '15m') as JwtSignOptions['expiresIn'],
          issuer: 'classrank',
          audience: 'classrank-web',
        } satisfies JwtSignOptions,
      }),
    }),
  ],
  providers: [AuthService, SessionsService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, SessionsService],
})
export class AuthModule {}
