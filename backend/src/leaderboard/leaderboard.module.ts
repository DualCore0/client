import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller.js';
import { LeaderboardService } from './leaderboard.service.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService, PrismaService]
})
export class LeaderboardModule {}
