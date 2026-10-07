import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AiService } from './ai.service.js';
import { GenerateTestDto } from './ai.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate-test')
  @Roles(Role.TEACHER)
  async generateTest(@Body() body: GenerateTestDto, @Request() req: any) {
    return this.aiService.generateTest(body, req.user.userId);
  }
}
