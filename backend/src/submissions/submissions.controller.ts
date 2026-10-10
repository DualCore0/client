import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SubmissionsService } from './submissions.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';
import { SubmitTestDto } from '../tests/dto/tests.dto.js';

@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post(':testId/start')
  @Roles(Role.STUDENT)
  startTest(@Param('testId') testId: string, @Request() req: any) {
    return this.submissionsService.startTest(testId, req.user.userId);
  }

  @Post(':testId/submit')
  @Roles(Role.STUDENT)
  submitTest(
    @Param('testId') testId: string,
    @Body() dto: SubmitTestDto,
    @Request() req: any
  ) {
    return this.submissionsService.submitTest(testId, req.user.userId, dto.answers);
  }

  @Get('me')
  @Roles(Role.STUDENT)
  getMySubmissions(@Request() req: any) {
    return this.submissionsService.getMySubmissions(req.user.userId);
  }

  /** Attempt state + server deadline for a test (used by the test screen). */
  @Get('attempt/:testId')
  @Roles(Role.STUDENT)
  getAttemptState(@Param('testId') testId: string, @Request() req: any) {
    return this.submissionsService.getAttemptState(testId, req.user.userId);
  }

  @Get(':id')
  @Roles(Role.STUDENT)
  getSubmissionDetails(@Param('id') id: string, @Request() req: any) {
    return this.submissionsService.getSubmissionDetails(id, req.user.userId);
  }
}
