import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { RoomsController, PublicRoomsController } from './rooms.controller.js';
import { PrismaModule } from '../prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [RoomsController, PublicRoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
