import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
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
    ConfigModule.forRoot({ isGlobal: true }),
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
  providers: [AppService],
})
export class AppModule {}
