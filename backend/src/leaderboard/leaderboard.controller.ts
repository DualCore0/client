import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('room/:roomCode')
  @UseGuards(JwtAuthGuard)
  async getRoomLeaderboard(@Param('roomCode') roomCode: string) {
    return this.leaderboardService.getRoomLeaderboard(roomCode);
  }

  @Get('global/weekly')
  async getGlobalWeeklyLeaderboard() {
    return this.leaderboardService.getGlobalWeeklyLeaderboard();
  }
}
