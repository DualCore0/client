import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaService } from '../prisma.service.js';
import { createPrismaMock, PrismaMock } from '../testing/test-doubles.js';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects a duplicate email', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await expect(service.create('a@b.com', 'hash', 'A')).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a user with the supplied password hash', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: any) => ({ id: 'u1', ...data }));

    const user: any = await service.create('a@b.com', 'hashed', 'A Student', 'STUDENT');

    expect(user).toMatchObject({ email: 'a@b.com', password: 'hashed', role: 'STUDENT' });
  });

  it('lower-cases the email on create so the CHECK constraint holds', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }: any) => ({ id: 'u1', ...data }));

    await service.create('  MiXeD@Example.COM ', 'hashed', 'A');

    expect(prisma.user.create.mock.calls[0][0].data.email).toBe('mixed@example.com');
  });

  describe('soft delete awareness', () => {
    it('findByEmail excludes soft-deleted accounts', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await service.findByEmail('gone@example.com');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'gone@example.com', deletedAt: null },
      });
    });

    it('findById excludes soft-deleted accounts', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await service.findById('u1');

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { id: 'u1', deletedAt: null },
      });
    });

    it('softDelete marks the row, revokes sessions and bumps the token version', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      prisma.user.update.mockResolvedValue({ id: 'u1' });
      prisma.session.updateMany.mockResolvedValue({ count: 3 });
      prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });

      const result = await service.softDelete('u1', 'admin-1');

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DELETED',
            tokenVersion: { increment: 1 },
          }),
        }),
      );
      expect(prisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'u1', revokedAt: null },
          data: expect.objectContaining({ revokedReason: 'account_deleted' }),
        }),
      );
    });

    it('softDelete refuses an already deleted account', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.softDelete('u1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getPublicProfile', () => {
    it('throws for an unknown user', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.getPublicProfile('nope')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('never exposes the email address', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        fullname: 'Alice Smith',
        role: 'STUDENT',
        createdAt: new Date(),
      });
      prisma.submission.findMany.mockResolvedValue([
        {
          id: 's1',
          percentage: 90,
          score: 9,
          correctAnswers: 9,
          wrongAnswers: 1,
          submittedAt: new Date(),
          test: { id: 't1', title: 'Week 1', topic: 'DBMS', room: { name: 'BCA DBMS', code: 'K7M4P2' } },
        },
      ]);

      const profile: any = await service.getPublicProfile('u1');

      expect(profile.name).toBe('Alice Smith');
      expect(JSON.stringify(profile)).not.toContain('@');
      expect(profile.stats).toMatchObject({ testsCompleted: 1, averagePercentage: 90, accuracy: 90 });
    });

    it('reports the room the student is most active in', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        fullname: 'Alice',
        role: 'STUDENT',
        createdAt: new Date(),
      });
      const sub = (code: string, name: string) => ({
        id: `s-${code}`,
        percentage: 50,
        score: 1,
        correctAnswers: 1,
        wrongAnswers: 1,
        submittedAt: new Date(),
        test: { id: 't', title: 'T', topic: null, room: { name, code } },
      });
      prisma.submission.findMany.mockResolvedValue([
        sub('AAAAAA', 'Room A'),
        sub('AAAAAA', 'Room A'),
        sub('BBBBBB', 'Room B'),
      ]);

      const profile: any = await service.getPublicProfile('u1');
      expect(profile.primaryRoom).toMatchObject({ code: 'AAAAAA', count: 2 });
    });

    it('handles a student with no attempts', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'u1',
        fullname: null,
        role: 'STUDENT',
        createdAt: new Date(),
      });
      prisma.submission.findMany.mockResolvedValue([]);

      const profile: any = await service.getPublicProfile('u1');

      expect(profile.name).toBe('Student');
      expect(profile.primaryRoom).toBeNull();
      expect(profile.stats.averagePercentage).toBeNull();
      expect(profile.recentTests).toEqual([]);
    });
  });
});
