import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service.js';
import { GenerateTestDto } from './ai.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('generate-test')
  @Roles(Role.TEACHER)
  async generateTest(@Body() body: GenerateTestDto, @Request() req: any) {
    return this.aiService.generateTest(body, req.user.userId);
  }
}
