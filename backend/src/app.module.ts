import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma.module.js';
import { SecurityModule } from './common/security/security.module.js';
import { validateEnv } from './common/config/env.validation.js';
import { globalThrottleLimit } from './common/config/throttle.js';

import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TestsModule } from './tests/tests.module.js';
import { RoomsModule } from './rooms/rooms.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { AiModule } from './ai/ai.module.js';
import { LeaderboardModule } from './leaderboard/leaderboard.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Refuses to boot on a missing/weak secret instead of failing later.
      validate: validateEnv,
      cache: true,
    }),

    // Global infrastructure.
    PrismaModule,
    SecurityModule,

    ThrottlerModule.forRoot([
      {
        // Global default; sensitive routes narrow this with @Throttle().
        name: 'default',
        ttl: 60_000,
        limit: globalThrottleLimit(),
      },
    ]),

    UsersModule,
    AuthModule,
    TestsModule,
    RoomsModule,
    SubmissionsModule,
    DocumentsModule,
    AiModule,
    LeaderboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
