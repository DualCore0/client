import { Module } from '@nestjs/common';
import { TestsService } from './tests.service.js';
import { TestsController } from './tests.controller.js';
import { PrismaModule } from '../prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [TestsController],
  providers: [TestsService],
})
export class TestsModule {}
