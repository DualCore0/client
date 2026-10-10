import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TestsService } from './tests.service.js';
import { PrismaService } from '../prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { createPrismaMock, PrismaMock, createConfigMock } from '../testing/test-doubles.js';

describe('TestsService', () => {
  let service: TestsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: createConfigMock({ OPENROUTER_API_KEY: undefined }) },
      ],
    }).compile();

    service = module.get<TestsService>(TestsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTestById', () => {
    it('does not send correct answers to students', async () => {
      prisma.test.findUnique.mockImplementation(async ({ include }: any) => ({
        id: 'test-1',
        status: 'PUBLISHED',
        roomId: 'room-1',
        creatorId: 'teacher-1',
        questions: [{ id: 'q1', questionText: 'Q?', options: ['a', 'b'], points: 1, difficulty: 'EASY' }],
        // Emulate Prisma omitting correctAnswer when the select is false
        __select: include?.questions?.select,
      }));
      prisma.roomMember.findUnique.mockResolvedValue({ id: 'm1' });

      await service.getTestById('test-1', 'student-1', 'STUDENT');

      const include = prisma.test.findUnique.mock.calls[0][0].include;
      expect(include.questions.select.correctAnswer).toBe(false);
    });

    it('sends correct answers to the owning teacher', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        status: 'DRAFT',
        roomId: 'room-1',
        creatorId: 'teacher-1',
        questions: [],
      });

      await service.getTestById('test-1', 'teacher-1', 'TEACHER');

      const include = prisma.test.findUnique.mock.calls[0][0].include;
      expect(include.questions.select.correctAnswer).toBe(true);
    });

    it('hides unpublished tests from students', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        status: 'DRAFT',
        roomId: 'room-1',
        creatorId: 'teacher-1',
        questions: [],
      });

      await expect(service.getTestById('test-1', 'student-1', 'STUDENT')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('blocks students who are not room members', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        status: 'PUBLISHED',
        roomId: 'room-1',
        creatorId: 'teacher-1',
        questions: [],
      });
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.getTestById('test-1', 'outsider', 'STUDENT')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('blocks a teacher from another teacher test', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        status: 'DRAFT',
        roomId: 'room-1',
        creatorId: 'owner',
        questions: [],
      });

      await expect(service.getTestById('test-1', 'intruder', 'TEACHER')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws for a missing test', async () => {
      prisma.test.findUnique.mockResolvedValue(null);
      await expect(service.getTestById('nope', 'teacher-1', 'TEACHER')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('publishTest', () => {
    it('refuses to publish a test with no questions', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        creatorId: 'teacher-1',
        status: 'DRAFT',
        _count: { questions: 0 },
      });

      await expect(service.publishTest('test-1', 'teacher-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('publishes and stamps publishedAt', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        creatorId: 'teacher-1',
        status: 'DRAFT',
        _count: { questions: 5 },
      });
      prisma.test.update.mockImplementation(async ({ data }: any) => ({ id: 'test-1', ...data }));

      const result: any = await service.publishTest('test-1', 'teacher-1');

      expect(result.status).toBe('PUBLISHED');
      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.questionCount).toBe(5);
    });

    it('will not publish someone else test', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        creatorId: 'owner',
        status: 'DRAFT',
        _count: { questions: 1 },
      });

      await expect(service.publishTest('test-1', 'intruder')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('reports an already published test', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        creatorId: 'teacher-1',
        status: 'PUBLISHED',
        _count: { questions: 1 },
      });

      await expect(service.publishTest('test-1', 'teacher-1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getTestResults', () => {
    it('aggregates attempts and ranks them by percentage', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        title: 'DBMS',
        topic: 'Databases',
        status: 'PUBLISHED',
        duration: 10,
        difficulty: 'MEDIUM',
        publishedAt: new Date(),
        creatorId: 'teacher-1',
        room: { id: 'room-1', name: 'DBMS', code: 'K7M4P2' },
        _count: { questions: 5 },
        submissions: [
          { id: 's1', student: { id: 'st1', fullname: 'Alice', email: 'a@x.com' }, score: 5, percentage: 100, correctAnswers: 5, wrongAnswers: 0, timeTaken: 120, submittedAt: new Date() },
          { id: 's2', student: { id: 'st2', fullname: null, email: 'b@x.com' }, score: 2, percentage: 40, correctAnswers: 2, wrongAnswers: 3, timeTaken: 300, submittedAt: new Date() },
        ],
      });

      const result = await service.getTestResults('test-1', 'teacher-1');

      expect(result.summary.attemptCount).toBe(2);
      expect(result.summary.averagePercentage).toBe(70);
      expect(result.summary.highPercentage).toBe(100);
      expect(result.summary.lowPercentage).toBe(40);
      expect(result.attempts[0].rank).toBe(1);
      // Falls back to the email prefix when fullname is absent
      expect(result.attempts[1].name).toBe('b');
    });

    it('returns nulls when nobody has attempted the test', async () => {
      prisma.test.findUnique.mockResolvedValue({
        id: 'test-1',
        title: 'DBMS',
        status: 'DRAFT',
        creatorId: 'teacher-1',
        room: null,
        _count: { questions: 0 },
        submissions: [],
      });

      const result = await service.getTestResults('test-1', 'teacher-1');
      expect(result.summary.averagePercentage).toBeNull();
      expect(result.attempts).toEqual([]);
    });
  });

  describe('generateTest', () => {
    it('requires a topic', async () => {
      await expect(service.generateTest('  ', 'teacher-1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('will not generate into a room owned by another teacher', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'owner' });
      await expect(service.generateTest('DBMS', 'intruder', 'room-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('falls back to offline questions when no LLM key is configured', async () => {
      prisma.test.create.mockImplementation(async ({ data }: any) => ({ id: 'test-1', ...data }));

      const result: any = await service.generateTest('DBMS', 'teacher-1', undefined, 4);

      const created = prisma.test.create.mock.calls[0][0].data;
      expect(created.questions.create).toHaveLength(4);
      for (const q of created.questions.create) {
        expect(q.options).toHaveLength(4);
        expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
        expect(q.correctAnswer).toBeLessThanOrEqual(3);
      }
      expect(created.status).toBe('DRAFT');
      expect(result.id).toBe('test-1');
    });
  });

  describe('editQuestion / deleteQuestion', () => {
    it('only lets the test owner edit questions', async () => {
      prisma.test.findUnique.mockResolvedValue({ id: 'test-1', creatorId: 'owner' });
      await expect(
        service.editQuestion('test-1', 'q1', { questionText: 'x' }, 'intruder'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('decrements the question count when a question is deleted', async () => {
      prisma.test.findUnique.mockResolvedValue({ id: 'test-1', creatorId: 'teacher-1' });
      prisma.question.delete.mockResolvedValue({ id: 'q1' });
      prisma.test.update.mockResolvedValue({ id: 'test-1', questionCount: 4 });

      await service.deleteQuestion('test-1', 'q1', 'teacher-1');

      expect(prisma.test.update).toHaveBeenCalledWith({
        where: { id: 'test-1' },
        data: { questionCount: { decrement: 1 } },
      });
    });
  });
});
