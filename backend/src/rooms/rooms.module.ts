import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { RoomsController, PublicRoomsController } from './rooms.controller.js';
import { PrismaService } from '../prisma.service.js';

@Module({
  controllers: [RoomsController, PublicRoomsController],
  providers: [RoomsService, PrismaService],
})
export class RoomsModule {}
