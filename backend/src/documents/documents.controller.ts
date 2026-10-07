import { Controller, Post, UseInterceptors, UploadedFile, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload/:roomId')
  @Roles(Role.TEACHER)
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: any,
    @Param('roomId') roomId: string,
    @Request() req: any
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.documentsService.uploadAndProcess(file, roomId, req.user.userId);
  }
}
