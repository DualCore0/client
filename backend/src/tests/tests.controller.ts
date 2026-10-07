import { Controller, Post, Get, Body, Param, UseGuards, Request, Patch } from '@nestjs/common';
import { TestsService } from './tests.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';
import { GenerateTestDto } from './dto/tests.dto.js';

@Controller('tests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Post('generate')
  @Roles(Role.TEACHER)
  generateTest(@Body() dto: GenerateTestDto, @Request() req: any) {
    return this.testsService.generateTest(dto.topic, req.user.userId, dto.roomId, dto.questionCount);
  }

  @Post(':id/publish')
  @Roles(Role.TEACHER)
  publishTest(@Param('id') id: string, @Request() req: any) {
    return this.testsService.publishTest(id, req.user.userId);
  }

  @Patch(':id/questions/:qid')
  @Roles(Role.TEACHER)
  editQuestion(
    @Param('id') testId: string,
    @Param('qid') questionId: string,
    @Body() body: any,
    @Request() req: any
  ) {
    return this.testsService.editQuestion(testId, questionId, body, req.user.userId);
  }

  @Post(':id/questions/:qid/delete')
  @Roles(Role.TEACHER)
  deleteQuestion(
    @Param('id') testId: string,
    @Param('qid') questionId: string,
    @Request() req: any
  ) {
    return this.testsService.deleteQuestion(testId, questionId, req.user.userId);
  }

  @Get()
  getTests(@Request() req: any) {
    return this.testsService.getTestsByUser(req.user.userId, req.user.role);
  }

  @Get('room/:roomId')
  getTestsByRoom(@Param('roomId') roomId: string, @Request() req: any) {
    return this.testsService.getTestsByRoom(roomId, req.user.userId, req.user.role);
  }

  @Get(':id')
  getTestById(@Param('id') id: string, @Request() req: any) {
    return this.testsService.getTestById(id, req.user.userId, req.user.role);
  }
}
