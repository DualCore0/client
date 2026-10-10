import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service.js';
import { PrismaService } from '../prisma.service.js';
import { createPrismaMock, PrismaMock } from '../testing/test-doubles.js';

describe('LeaderboardService', () => {
  let service: LeaderboardService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaderboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<LeaderboardService>(LeaderboardService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRoomLeaderboard', () => {
    function primeRoom(tests: any[]) {
      prisma.room.findUnique.mockResolvedValue({
        id: 'room-1',
        code: 'K7M4P2',
        name: 'BCA DBMS',
        subject: 'CS',
        tests,
      });
    }

    it('averages percentages across a student completed tests', async () => {
      primeRoom([
        {
          status: 'PUBLISHED',
          submissions: [
            { studentId: 's1', percentage: 80, timeTaken: 100, student: { id: 's1', fullname: 'Alice', email: 'a@x.com' } },
          ],
        },
        {
          status: 'PUBLISHED',
          submissions: [
            { studentId: 's1', percentage: 60, timeTaken: 200, student: { id: 's1', fullname: 'Alice', email: 'a@x.com' } },
            { studentId: 's2', percentage: 90, timeTaken: 50, student: { id: 's2', fullname: 'Bob', email: 'b@x.com' } },
          ],
        },
      ]);

      const result = await service.getRoomLeaderboard('K7M4P2');

      expect(result.leaderboard).toHaveLength(2);
      expect(result.leaderboard[0]).toMatchObject({ name: 'Bob', averagePercentage: 90, rank: 1 });
      expect(result.leaderboard[1]).toMatchObject({ name: 'Alice', averagePercentage: 70, testsCompleted: 2, rank: 2 });
      expect(result.leaderboard[1].averageTimeTaken).toBe(150);
    });

    it('ignores attempts that were never submitted', async () => {
      primeRoom([{ status: 'PUBLISHED', submissions: [] }]);

      const result = await service.getRoomLeaderboard('K7M4P2');

      expect(result.leaderboard).toEqual([]);
      const where = prisma.room.findUnique.mock.calls[0][0].include.tests.include.submissions.where;
      expect(where).toEqual({ submittedAt: { not: null } });
    });

    it('falls back to the email prefix when a name is missing', async () => {
      primeRoom([
        {
          status: 'PUBLISHED',
          submissions: [
            { studentId: 's1', percentage: 50, timeTaken: 10, student: { id: 's1', fullname: null, email: 'quiet@student.com' } },
          ],
        },
      ]);

      const result = await service.getRoomLeaderboard('K7M4P2');
      expect(result.leaderboard[0].name).toBe('quiet');
    });

    it('highlights the viewing student', async () => {
      primeRoom([
        {
          status: 'PUBLISHED',
          submissions: [
            { studentId: 's1', percentage: 80, timeTaken: 10, student: { id: 's1', fullname: 'Alice', email: 'a@x.com' } },
            { studentId: 's2', percentage: 95, timeTaken: 10, student: { id: 's2', fullname: 'Bob', email: 'b@x.com' } },
          ],
        },
      ]);

      const result = await service.getRoomLeaderboard('K7M4P2', 's1');
      expect(result.viewer).toMatchObject({ studentId: 's1', rank: 2 });
    });

    it('uppercases the room code and throws for unknown rooms', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      await expect(service.getRoomLeaderboard('k7m4p2')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.room.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { code: 'K7M4P2' } }));
    });
  });

  describe('getGlobalWeeklyLeaderboard', () => {
    function sub(studentId: string, name: string, percentage: number, correct: number, wrong: number) {
      return {
        studentId,
        percentage,
        correctAnswers: correct,
        wrongAnswers: wrong,
        student: { id: studentId, fullname: name, email: `${studentId}@x.com` },
      };
    }

    it('only includes students who met the minimum number of tests', async () => {
      prisma.submission.findMany.mockResolvedValue([
        sub('s1', 'Alice', 100, 3, 0),
        sub('s1', 'Alice', 100, 3, 0),
        sub('s1', 'Alice', 100, 3, 0),
        sub('s2', 'Bob', 100, 3, 0),
        sub('s2', 'Bob', 100, 3, 0),
      ]);

      const result = await service.getGlobalWeeklyLeaderboard();

      expect(result.minTestsRequired).toBe(3);
      expect(result.leaderboard.map((l) => l.studentId)).toEqual(['s1']);
      expect(result.leaderboard[0].testsCompleted).toBe(3);
    });

    it('applies the documented 70/20/10 weighting', async () => {
      // 3 tests, 100% average, 100% accuracy -> full participation -> score 100
      prisma.submission.findMany.mockResolvedValue([
        sub('s1', 'Alice', 100, 3, 0),
        sub('s1', 'Alice', 100, 3, 0),
        sub('s1', 'Alice', 100, 3, 0),
      ]);

      const result = await service.getGlobalWeeklyLeaderboard();

      expect(result.weights).toEqual({ average: 0.7, accuracy: 0.2, participation: 0.1 });
      expect(result.leaderboard[0].participation).toBe(60);
      // 0.7*100 + 0.2*100 + 0.1*60
      expect(result.leaderboard[0].globalScore).toBe(96);
    });

    it('ranks by global score descending', async () => {
      prisma.submission.findMany.mockResolvedValue([
        sub('low', 'Low', 40, 1, 2),
        sub('low', 'Low', 40, 1, 2),
        sub('low', 'Low', 40, 1, 2),
        sub('high', 'High', 90, 3, 0),
        sub('high', 'High', 90, 3, 0),
        sub('high', 'High', 90, 3, 0),
      ]);

      const result = await service.getGlobalWeeklyLeaderboard();

      expect(result.leaderboard.map((l) => l.name)).toEqual(['High', 'Low']);
      expect(result.leaderboard[0].rank).toBe(1);
      expect(result.leaderboard[1].rank).toBe(2);
    });

    it('restricts the query to the current week', async () => {
      prisma.submission.findMany.mockResolvedValue([]);
      await service.getGlobalWeeklyLeaderboard();

      const where = prisma.submission.findMany.mock.calls[0][0].where;
      expect(where.submittedAt.gte).toBeInstanceOf(Date);
      expect(where.submittedAt.lt).toBeInstanceOf(Date);
      expect(where.submittedAt.lt.getTime()).toBeGreaterThan(where.submittedAt.gte.getTime());
    });

    it('returns an empty board when nobody qualifies', async () => {
      prisma.submission.findMany.mockResolvedValue([sub('s1', 'Alice', 90, 3, 0)]);

      const result = await service.getGlobalWeeklyLeaderboard();

      expect(result.leaderboard).toEqual([]);
      expect(result.viewer).toBeNull();
    });
  });
});
