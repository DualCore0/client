import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SubmissionsService } from './submissions.service.js';
import { PrismaService } from '../prisma.service.js';
import { createPrismaMock, PrismaMock } from '../testing/test-doubles.js';

function buildTest(overrides: Partial<any> = {}) {
  return {
    id: 'test-1',
    title: 'DBMS Basics',
    duration: 10,
    status: 'PUBLISHED',
    questions: [
      { id: 'q1', correctAnswer: 0, points: 1 },
      { id: 'q2', correctAnswer: 2, points: 1 },
      { id: 'q3', correctAnswer: 1, points: 1 },
    ],
    ...overrides,
  };
}

describe('SubmissionsService', () => {
  let service: SubmissionsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SubmissionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SubmissionsService>(SubmissionsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('startTest', () => {
    it('rejects tests that are not published', async () => {
      prisma.test.findUnique.mockResolvedValue(buildTest({ status: 'DRAFT' }));
      await expect(service.startTest('test-1', 'student-1')).rejects.toThrow(/not published/i);
    });

    it('refuses to restart an already submitted attempt', async () => {
      prisma.test.findUnique.mockResolvedValue(buildTest());
      prisma.submission.findUnique.mockResolvedValue({ id: 's1', submittedAt: new Date() });
      await expect(service.startTest('test-1', 'student-1')).rejects.toThrow(/already submitted/i);
    });

    it('returns the in-progress attempt instead of creating a duplicate', async () => {
      prisma.test.findUnique.mockResolvedValue(buildTest());
      prisma.submission.findUnique.mockResolvedValue({ id: 's1', submittedAt: null });

      const result = await service.startTest('test-1', 'student-1');

      expect(result).toEqual({ id: 's1', submittedAt: null });
      expect(prisma.submission.create).not.toHaveBeenCalled();
    });

    it('creates a new attempt and records the start time', async () => {
      prisma.test.findUnique.mockResolvedValue(buildTest());
      prisma.submission.findUnique.mockResolvedValue(null);
      prisma.submission.create.mockImplementation(async ({ data }: any) => ({ id: 'new', ...data }));

      const result = await service.startTest('test-1', 'student-1');

      expect(result.id).toBe('new');
      expect(result.startedAt).toBeInstanceOf(Date);
    });

    it('throws when the test does not exist', async () => {
      prisma.test.findUnique.mockResolvedValue(null);
      await expect(service.startTest('nope', 'student-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('submitTest', () => {
    function primeSubmission(overrides: Partial<any> = {}) {
      prisma.submission.findUnique.mockResolvedValue({
        id: 'attempt-1',
        testId: 'test-1',
        studentId: 'student-1',
        startedAt: new Date(Date.now() - 60_000),
        submittedAt: null,
        test: buildTest(),
        ...overrides,
      });
      prisma.answer.createMany.mockResolvedValue({ count: 3 });
      prisma.submission.update.mockImplementation(async ({ data }: any) => ({
        id: 'attempt-1',
        ...data,
      }));
    }

    it('requires an attempt to have been started', async () => {
      prisma.submission.findUnique.mockResolvedValue(null);
      await expect(service.submitTest('test-1', 'student-1', [])).rejects.toThrow(/not started/i);
    });

    it('blocks a second submission', async () => {
      primeSubmission({ submittedAt: new Date() });
      await expect(service.submitTest('test-1', 'student-1', [])).rejects.toThrow(/already submitted/i);
    });

    it('scores on the server, ignoring anything the client claims', async () => {
      primeSubmission();

      const result: any = await service.submitTest('test-1', 'student-1', [
        { questionId: 'q1', selectedAnswer: 0 }, // correct
        { questionId: 'q2', selectedAnswer: 2 }, // correct
        { questionId: 'q3', selectedAnswer: 0 }, // wrong (correct is 1)
      ]);

      expect(result.score).toBe(2);
      expect(result.correctAnswers).toBe(2);
      expect(result.wrongAnswers).toBe(1);
      expect(result.percentage).toBeCloseTo(66.67, 1);
    });

    it('counts unanswered questions as wrong', async () => {
      primeSubmission();

      const result: any = await service.submitTest('test-1', 'student-1', [
        { questionId: 'q1', selectedAnswer: 0 },
      ]);

      expect(result.correctAnswers).toBe(1);
      expect(result.wrongAnswers).toBe(2);
      expect(result.percentage).toBeCloseTo(33.33, 1);
    });

    it('ignores answers for questions that are not part of the test', async () => {
      primeSubmission();

      const result: any = await service.submitTest('test-1', 'student-1', [
        { questionId: 'q1', selectedAnswer: 0 },
        { questionId: 'q2', selectedAnswer: 2 },
        { questionId: 'q3', selectedAnswer: 1 },
        { questionId: 'not-in-test', selectedAnswer: 3 },
      ]);

      expect(result.score).toBe(3);
      expect(result.percentage).toBe(100);
      const saved = prisma.answer.createMany.mock.calls[0][0].data as any[];
      expect(saved).toHaveLength(3);
    });

    it('still grades a late submission rather than losing it', async () => {
      primeSubmission({ startedAt: new Date(Date.now() - 60 * 60 * 1000) });

      const result: any = await service.submitTest('test-1', 'student-1', [
        { questionId: 'q1', selectedAnswer: 0 },
      ]);

      expect(result.score).toBe(1);
      expect(result.wasLate).toBe(true);
      // timeTaken is capped at the allowed duration (10 minutes)
      expect(result.timeTaken).toBe(600);
    });

    it('does not flag an on-time submission as late', async () => {
      primeSubmission({ startedAt: new Date(Date.now() - 30_000) });
      const result: any = await service.submitTest('test-1', 'student-1', []);
      expect(result.wasLate).toBe(false);
    });

    it('records the time taken in seconds', async () => {
      primeSubmission({ startedAt: new Date(Date.now() - 90_000) });
      const result: any = await service.submitTest('test-1', 'student-1', []);
      expect(result.timeTaken).toBeGreaterThanOrEqual(89);
      expect(result.timeTaken).toBeLessThanOrEqual(91);
    });
  });

  describe('getSubmissionDetails', () => {
    it('refuses to show another student their own submission', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's1',
        studentId: 'owner',
        submittedAt: new Date(),
        answers: [],
        test: { questions: [], room: null },
      });

      await expect(service.getSubmissionDetails('s1', 'someone-else')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('hides correct answers until the attempt is submitted', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's1',
        testId: 'test-1',
        studentId: 'student-1',
        submittedAt: null,
        score: null,
        percentage: null,
        answers: [],
        test: {
          id: 'test-1',
          title: 'T',
          topic: null,
          duration: 10,
          questionCount: 1,
          status: 'PUBLISHED',
          room: { id: 'r1', name: 'Room', code: 'ABC123' },
          questions: [{ id: 'q1', questionText: 'Q?', options: ['a', 'b', 'c', 'd'], points: 1, difficulty: 'EASY', correctAnswer: 2 }],
        },
      });

      const result = await service.getSubmissionDetails('s1', 'student-1');
      expect(result.questions[0].correctAnswer).toBeUndefined();
    });

    it('reveals correct answers after submission', async () => {
      prisma.submission.findUnique.mockResolvedValue({
        id: 's1',
        testId: 'test-1',
        studentId: 'student-1',
        submittedAt: new Date(),
        score: 1,
        percentage: 100,
        answers: [{ questionId: 'q1', selectedAnswer: 2, isCorrect: true }],
        test: {
          id: 'test-1',
          title: 'T',
          topic: null,
          duration: 10,
          questionCount: 1,
          status: 'PUBLISHED',
          room: { id: 'r1', name: 'Room', code: 'ABC123' },
          questions: [{ id: 'q1', questionText: 'Q?', options: ['a', 'b', 'c', 'd'], points: 1, difficulty: 'EASY', correctAnswer: 2 }],
        },
      });

      const result = await service.getSubmissionDetails('s1', 'student-1');
      expect(result.questions[0].correctAnswer).toBe(2);
      expect(result.questions[0].isCorrect).toBe(true);
    });
  });

  describe('getAttemptState', () => {
    it('computes the server deadline from the test duration', async () => {
      const startedAt = new Date('2026-01-01T10:00:00.000Z');
      prisma.test.findUnique.mockResolvedValue({ id: 'test-1', title: 'T', duration: 15, status: 'PUBLISHED' });
      prisma.submission.findUnique.mockResolvedValue({ id: 's1', startedAt, submittedAt: null, score: null, percentage: null });

      const state = await service.getAttemptState('test-1', 'student-1');

      expect(state.deadline).toBe('2026-01-01T10:15:00.000Z');
    });

    it('returns no deadline for an untimed test', async () => {
      prisma.test.findUnique.mockResolvedValue({ id: 'test-1', title: 'T', duration: null, status: 'PUBLISHED' });
      prisma.submission.findUnique.mockResolvedValue({ id: 's1', startedAt: new Date(), submittedAt: null, score: null, percentage: null });

      const state = await service.getAttemptState('test-1', 'student-1');
      expect(state.deadline).toBeNull();
    });
  });
});
