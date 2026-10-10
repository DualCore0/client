import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import * as QRCode from 'qrcode';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude 0, O, 1, I
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async createRoom(name: string, teacherId: string, subject?: string, description?: string) {
    let code = this.generateRoomCode();
    // Ensure uniqueness
    while (await this.prisma.room.findUnique({ where: { code } })) {
      code = this.generateRoomCode();
    }

    return this.prisma.room.create({
      data: {
        name,
        code,
        teacherId,
        subject,
        description,
      },
    });
  }

  async getRoomsForUser(userId: string, role: string) {
    if (role === 'TEACHER') {
      return this.prisma.room.findMany({
        where: { teacherId: userId },
        include: { _count: { select: { members: true, tests: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } else {
      return this.prisma.room.findMany({
        where: { members: { some: { studentId: userId } } },
        include: { 
          teacher: { select: { email: true, fullname: true } }, 
          _count: { select: { tests: true } } 
        },
        orderBy: { createdAt: 'desc' }
      });
    }
  }

  async joinRoom(code: string, studentId: string) {
    const room = await this.prisma.room.findUnique({ where: { code: code.toUpperCase() } });
    if (!room) throw new NotFoundException('Room not found');

    const existing = await this.prisma.roomMember.findUnique({
      where: { roomId_studentId: { roomId: room.id, studentId } }
    });
    if (existing) throw new ConflictException('Already joined this room');

    return this.prisma.roomMember.create({
      data: {
        roomId: room.id,
        studentId,
      },
      include: {
        room: true
      }
    });
  }

  /**
   * Public room preview used by /join/[code] before a student has joined.
   * Exposes only non-sensitive room metadata.
   */
  async getRoomPreview(code: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        teacher: { select: { fullname: true, email: true } },
        _count: { select: { members: true, tests: true } },
      },
    });
    if (!room) throw new NotFoundException('Room not found');

    const publishedTestCount = await this.prisma.test.count({
      where: { roomId: room.id, status: 'PUBLISHED' },
    });

    return {
      id: room.id,
      code: room.code,
      name: room.name,
      subject: room.subject,
      description: room.description,
      instructor: room.teacher.fullname || room.teacher.email.split('@')[0],
      memberCount: room._count.members,
      testCount: publishedTestCount,
      createdAt: room.createdAt,
    };
  }

  async getRoomDetails(roomId: string, userId: string, role: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        tests: {
          include: { _count: { select: { questions: true } } },
          orderBy: { createdAt: 'desc' }
        },
        members: {
          include: { student: { select: { id: true, email: true, fullname: true } } },
          orderBy: { joinedAt: 'desc' }
        }
      }
    });
    if (!room) throw new NotFoundException('Room not found');

    if (role === 'STUDENT') {
      const isMember = room.members.some(m => m.studentId === userId);
      if (!isMember) throw new ForbiddenException('Not a member of this room');
    } else if (role === 'TEACHER') {
      if (room.teacherId !== userId) throw new ForbiddenException('Not the teacher of this room');
    }

    // Generate QR code for the room link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const joinUrl = `${frontendUrl}/join/${room.code}`;
    const qrCodeDataUrl = await QRCode.toDataURL(joinUrl);

    return { ...room, qrCode: qrCodeDataUrl, joinUrl };
  }
}
