import { Module } from '@nestjs/common';
import { TestsService } from './tests.service.js';
import { TestsController } from './tests.controller.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  providers: [TestsService, PrismaService],
  controllers: [TestsController],
})
export class TestsModule {}
