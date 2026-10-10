import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AiService } from './ai.service.js';
import { GenerateTestDto } from './ai.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';
import { throttle } from '../common/config/throttle.js';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // LLM calls are expensive and abusable, so they get the tightest budget.
  @Throttle(throttle.expensive())
  @Post('generate-test')
  @Roles(Role.TEACHER)
  async generateTest(@Body() body: GenerateTestDto, @Request() req: any) {
    return this.aiService.generateTest(body, req.user.userId);
  }
}
