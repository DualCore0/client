import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard, Roles } from '../auth/roles.guard.js';
import { Role } from '@prisma/client';
import { CreateRoomDto, JoinRoomDto } from './dto/rooms.dto.js';

/** Unauthenticated endpoints. Only non-sensitive room metadata is exposed. */
@Controller('public')
export class PublicRoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('rooms/:code')
  getRoomPreview(@Param('code') code: string) {
    return this.roomsService.getRoomPreview(code);
  }
}

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

  /** Look a room up by its 6-character code (used by /join/[code]). */
  @Get('code/:code')
  getRoomByCode(@Param('code') code: string) {
    return this.roomsService.getRoomPreview(code);
  }

  @Get(':id')
  getRoomDetails(@Param('id') id: string, @Request() req: any) {
    return this.roomsService.getRoomDetails(id, req.user.userId, req.user.role);
  }
}
