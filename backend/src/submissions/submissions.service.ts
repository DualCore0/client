import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { TestStatus } from '@prisma/client';

@Injectable()
export class SubmissionsService {
  constructor(private prisma: PrismaService) {}

  async startTest(testId: string, studentId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.status !== TestStatus.PUBLISHED) throw new BadRequestException('Test is not published');

    const existing = await this.prisma.submission.findUnique({
      where: { testId_studentId: { testId, studentId } }
    });

    if (existing) {
      if (existing.submittedAt) throw new BadRequestException('Test already submitted');
      return existing; // Return in-progress attempt
    }

    return this.prisma.submission.create({
      data: { testId, studentId, startedAt: new Date() }
    });
  }

  /**
   * Current attempt state for a test, including the server-computed deadline so
   * the client timer survives a page refresh.
   */
  async getAttemptState(testId: string, studentId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      select: { id: true, title: true, duration: true, status: true },
    });
    if (!test) throw new NotFoundException('Test not found');

    const submission = await this.prisma.submission.findUnique({
      where: { testId_studentId: { testId, studentId } },
    });

    const deadline =
      submission && test.duration
        ? new Date(submission.startedAt.getTime() + test.duration * 60 * 1000).toISOString()
        : null;

    return {
      test,
      submissionId: submission?.id ?? null,
      startedAt: submission?.startedAt ?? null,
      submittedAt: submission?.submittedAt ?? null,
      deadline,
      score: submission?.score ?? null,
      percentage: submission?.percentage ?? null,
    };
  }

  async submitTest(testId: string, studentId: string, answers: { questionId: string, selectedAnswer: number }[]) {
    const submission = await this.prisma.submission.findUnique({
      where: { testId_studentId: { testId, studentId } },
      include: { 
        test: { include: { questions: true } }
      }
    });

    if (!submission) throw new NotFoundException('Attempt not started');
    if (submission.submittedAt) throw new BadRequestException('Already submitted');

    const test = submission.test;

    // Enforce the timer server-side. A late submission is still graded (with
    // whatever was answered) rather than lost, matching the "auto-close" rule.
    const timeAllowed = test.duration ? test.duration * 60 * 1000 : null;
    const elapsed = Date.now() - submission.startedAt.getTime();
    const isLate = timeAllowed !== null && elapsed > timeAllowed + 60000;

    let score = 0;
    let maxScore = 0;
    let correctAnswersCount = 0;
    let wrongAnswersCount = 0;

    const answerData = answers
      .filter((a) => test.questions.some((q) => q.id === a.questionId))
      .map(a => {
        const q = test.questions.find(q => q.id === a.questionId)!;
        let isCorrect = false;
        maxScore += q.points;
        if (a.selectedAnswer === q.correctAnswer) {
          isCorrect = true;
          score += q.points;
          correctAnswersCount++;
        } else {
          wrongAnswersCount++;
        }
        return {
          submissionId: submission.id,
          questionId: a.questionId,
          selectedAnswer: a.selectedAnswer,
          isCorrect
        };
      });

    // Handle skipped questions
    const answeredQuestionIds = new Set(answerData.map(a => a.questionId));
    for (const q of test.questions) {
      if (!answeredQuestionIds.has(q.id)) {
        maxScore += q.points;
        wrongAnswersCount++;
      }
    }

    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const timeTaken = Math.min(Math.floor(elapsed / 1000), test.duration ? test.duration * 60 : Math.floor(elapsed / 1000));

    // Save answers
    if (answerData.length > 0) {
      await this.prisma.answer.createMany({
        data: answerData,
        skipDuplicates: true,
      });
    }

    // Mark submission as ended and save stats
    const updated = await this.prisma.submission.update({
      where: { id: submission.id },
      data: {
        submittedAt: new Date(),
        score,
        percentage,
        correctAnswers: correctAnswersCount,
        wrongAnswers: wrongAnswersCount,
        timeTaken
      },
      include: {
        answers: true,
        test: { include: { room: { select: { id: true, name: true, code: true } } } },
      }
    });

    return { ...updated, wasLate: isLate };
  }

  async getMySubmissions(studentId: string) {
    return this.prisma.submission.findMany({
      where: { studentId },
      include: {
        test: {
          select: {
            id: true, title: true, topic: true, duration: true, questionCount: true,
            room: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { startedAt: 'desc' }
    });
  }

  async getSubmissionDetails(submissionId: string, userId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        test: {
          include: {
            questions: true,
            room: { select: { id: true, name: true, code: true } },
          },
        },
        answers: true,
      }
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.studentId !== userId) throw new ForbiddenException('Not your submission');

    // Answer review: correct answers are only revealed after submission.
    const isSubmitted = !!submission.submittedAt;
    const questions = submission.test.questions.map((q) => {
      const answer = submission.answers.find((a) => a.questionId === q.id);
      return {
        id: q.id,
        questionText: q.questionText,
        options: q.options,
        points: q.points,
        difficulty: q.difficulty,
        selectedAnswer: answer?.selectedAnswer ?? null,
        isCorrect: answer?.isCorrect ?? false,
        correctAnswer: isSubmitted ? q.correctAnswer : undefined,
      };
    });

    return {
      id: submission.id,
      testId: submission.testId,
      score: submission.score,
      percentage: submission.percentage,
      correctAnswers: submission.correctAnswers,
      wrongAnswers: submission.wrongAnswers,
      timeTaken: submission.timeTaken,
      startedAt: submission.startedAt,
      submittedAt: submission.submittedAt,
      test: {
        id: submission.test.id,
        title: submission.test.title,
        topic: submission.test.topic,
        duration: submission.test.duration,
        questionCount: submission.test.questionCount,
        status: submission.test.status,
        room: submission.test.room,
      },
      questions,
    };
  }
}
