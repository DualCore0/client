import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoomsService } from './rooms.service.js';
import { PrismaService } from '../prisma.service.js';
import { createPrismaMock, PrismaMock } from '../testing/test-doubles.js';

describe('RoomsService', () => {
  let service: RoomsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = new RoomsService(prisma as any);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoom', () => {
    it('generates an unambiguous 6-character room code', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      prisma.room.create.mockImplementation(async ({ data }: any) => ({ id: 'room-1', ...data }));

      const room: any = await service.createRoom('DBMS', 'teacher-1', 'CS', 'desc');

      expect(room.code).toHaveLength(6);
      // 0/O and 1/I are excluded so codes can be read aloud reliably.
      expect(room.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      expect(room).toMatchObject({ name: 'DBMS', teacherId: 'teacher-1', subject: 'CS' });
    });

    it('retries when a generated code already exists', async () => {
      prisma.room.findUnique
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValue(null);
      prisma.room.create.mockImplementation(async ({ data }: any) => ({ id: 'room-2', ...data }));

      const room: any = await service.createRoom('DBMS', 'teacher-1');
      expect(room.code).toHaveLength(6);
      expect(prisma.room.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  describe('joinRoom', () => {
    it('normalises the code to uppercase', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'K7M4P2' });
      prisma.roomMember.findUnique.mockResolvedValue(null);
      prisma.roomMember.create.mockResolvedValue({ id: 'member-1' });

      await service.joinRoom('k7m4p2', 'student-1');

      expect(prisma.room.findUnique).toHaveBeenCalledWith({ where: { code: 'K7M4P2' } });
    });

    it('reports a missing room', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      await expect(service.joinRoom('ZZZZZZ', 'student-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('prevents joining the same room twice', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', code: 'K7M4P2' });
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'member-1' });

      await expect(service.joinRoom('K7M4P2', 'student-1')).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('getRoomDetails', () => {
    const room = {
      id: 'room-1',
      code: 'K7M4P2',
      name: 'DBMS',
      teacherId: 'teacher-1',
      tests: [],
      members: [{ studentId: 'student-1' }],
    };

    it('returns a QR code and join URL for the room code (not the uuid)', async () => {
      prisma.room.findUnique.mockResolvedValue(room);

      const result: any = await service.getRoomDetails('room-1', 'teacher-1', 'TEACHER');

      expect(result.qrCode).toMatch(/^data:image\/png;base64,/);
      expect(result.joinUrl).toContain('/join/K7M4P2');
      expect(result.joinUrl).not.toContain('room-1');
    });

    it('blocks a student who is not a member', async () => {
      prisma.room.findUnique.mockResolvedValue({ ...room, members: [] });
      await expect(service.getRoomDetails('room-1', 'outsider', 'STUDENT')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('blocks a teacher who does not own the room', async () => {
      prisma.room.findUnique.mockResolvedValue(room);
      await expect(service.getRoomDetails('room-1', 'other-teacher', 'TEACHER')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('getRoomPreview', () => {
    it('exposes only non-sensitive room metadata', async () => {
      prisma.room.findUnique.mockResolvedValue({
        id: 'room-1',
        code: 'K7M4P2',
        name: 'DBMS',
        subject: 'CS',
        description: null,
        createdAt: new Date(),
        teacher: { fullname: 'Prof. Jordan', email: 'teacher@demo.com' },
        _count: { members: 5, tests: 4 },
      });
      prisma.test.count.mockResolvedValue(4);

      const preview: any = await service.getRoomPreview('k7m4p2');

      expect(preview).toMatchObject({ code: 'K7M4P2', instructor: 'Prof. Jordan', memberCount: 5 });
      expect(preview).not.toHaveProperty('members');
      expect(preview).not.toHaveProperty('teacherId');
    });

    it('throws for an unknown code', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      await expect(service.getRoomPreview('XXXXXX')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
