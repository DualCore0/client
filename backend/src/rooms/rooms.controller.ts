import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';
import { CreateRoomDto, JoinRoomDto } from './dto/rooms.dto.js';

@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @Roles(Role.TEACHER)
  createRoom(@Body() dto: CreateRoomDto, @Request() req: any) {
    return this.roomsService.createRoom(dto.name, req.user.userId, dto.subject, dto.description);
  }

  @Get()
  getRooms(@Request() req: any) {
    return this.roomsService.getRoomsForUser(req.user.userId, req.user.role);
  }

  @Post('join')
  @Roles(Role.STUDENT)
  joinRoom(@Body() dto: JoinRoomDto, @Request() req: any) {
    return this.roomsService.joinRoom(dto.code, req.user.userId);
  }

  @Get(':id')
  getRoomDetails(@Param('id') id: string, @Request() req: any) {
    return this.roomsService.getRoomDetails(id, req.user.userId, req.user.role);
  }
}
