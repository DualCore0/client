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

    // Check timer (grace period of 60 seconds)
    if (test.duration) {
      const timeAllowed = test.duration * 60 * 1000;
      const elapsed = Date.now() - submission.startedAt.getTime();
      if (elapsed > timeAllowed + 60000) { // 1 min grace
        throw new BadRequestException('Time is up. Submission rejected.');
      }
    }

    let score = 0;
    let maxScore = 0;
    let correctAnswersCount = 0;
    let wrongAnswersCount = 0;

    const answerData = answers.map(a => {
      const q = test.questions.find(q => q.id === a.questionId);
      let isCorrect = false;
      if (q) {
        maxScore += q.points;
        if (a.selectedAnswer === q.correctAnswer) {
          isCorrect = true;
          score += q.points;
          correctAnswersCount++;
        } else {
          wrongAnswersCount++;
        }
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
    const timeTaken = Math.floor((Date.now() - submission.startedAt.getTime()) / 1000);

    // Save answers
    await this.prisma.answer.createMany({
      data: answerData,
      skipDuplicates: true,
    });

    // Mark submission as ended and save stats
    return this.prisma.submission.update({
      where: { id: submission.id },
      data: { 
        submittedAt: new Date(),
        score,
        percentage,
        correctAnswers: correctAnswersCount,
        wrongAnswers: wrongAnswersCount,
        timeTaken
      },
      include: { answers: true }
    });
  }

  async getMySubmissions(studentId: string) {
    return this.prisma.submission.findMany({
      where: { studentId },
      include: { test: true },
      orderBy: { startedAt: 'desc' }
    });
  }

  async getSubmissionDetails(submissionId: string, userId: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { 
        test: { include: { questions: true } },
        answers: true
      }
    });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.studentId !== userId) throw new ForbiddenException('Not your submission');

    return submission;
  }
}
