import { Controller, Get, Param, UseGuards, Request } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('room/:roomCode')
  @UseGuards(JwtAuthGuard)
  async getRoomLeaderboard(@Param('roomCode') roomCode: string, @Request() req: any) {
    return this.leaderboardService.getRoomLeaderboard(roomCode, req.user?.userId);
  }

  /**
   * Public leaderboard (no auth required). When a valid token is supplied the
   * response also includes the viewer's own row so the UI can highlight it.
   */
  @Get('global/weekly')
  async getGlobalWeeklyLeaderboard(@Request() req: any) {
    return this.leaderboardService.getGlobalWeeklyLeaderboard(req.user?.userId);
  }
}
