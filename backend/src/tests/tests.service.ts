import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service.js';
import { Test, TestStatus } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';
import {
  fallbackQuestions,
  generateQuestionsWithLlm,
  normalizeQuestions,
} from '../common/question-generator.js';

@Injectable()
export class TestsService {
  private qdrantClient: QdrantClient;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.qdrantClient = new QdrantClient({
      url: this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333',
      apiKey: this.configService.get<string>('QDRANT_API_KEY'),
    });
  }

  async generateTest(topic: string, userId: string, roomId?: string, questionCount: number = 5): Promise<Test> {
    if (!topic || !topic.trim()) throw new BadRequestException('A topic is required');

    // Room-scoped generation must be performed by the room's teacher.
    if (roomId) {
      const room = await this.prisma.room.findUnique({ where: { id: roomId } });
      if (!room) throw new NotFoundException('Room not found');
      if (room.teacherId !== userId) throw new ForbiddenException('Not the teacher of this room');
    }

    let context = '';
    try {
      const queryVector = new Array(768).fill(0.1); // Dummy vector for now without real embeddings
      const searchResult: any = await (this.qdrantClient as any).search('knowledge_base', {
        vector: queryVector,
        limit: 3,
      });
      context = (searchResult?.points || searchResult || [])
        .map((r: any) => r?.payload?.text)
        .filter(Boolean)
        .join('\n');
    } catch {
      console.warn('Qdrant search failed, proceeding without context');
    }

    const prompt = `Generate exactly ${questionCount} multiple-choice questions on the topic of "${topic}".
${context ? `Base the questions on this study material:\n"""\n${context.slice(0, 16000)}\n"""\n` : ''}
Rules:
- Each question must have exactly 4 distinct options and exactly one correct answer.
- "correctAnswer" must be the 0-based index (0-3) of the correct option.
- Do not repeat questions or options.

Respond with raw JSON only: {"questions":[{"question":"...","options":["...","...","...","..."],"correctAnswer":0,"difficulty":"MEDIUM"}]}`;

    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    let questions;
    try {
      questions = apiKey
        ? await generateQuestionsWithLlm({ apiKey, prompt, expected: questionCount })
        : fallbackQuestions(topic, questionCount);
    } catch (error: any) {
      throw new InternalServerErrorException(
        `Could not generate valid questions (${error?.message || error})`,
      );
    }

    if (questions.length === 0) {
      throw new InternalServerErrorException('AI did not return any valid questions');
    }

    return this.prisma.test.create({
      data: {
        title: `Test on ${topic}`,
        topic,
        creatorId: userId,
        roomId: roomId || null,
        // A duration is what drives the server-side timer, so always set one.
        duration: 15,
        questionCount: questions.length,
        status: TestStatus.DRAFT,
        questions: {
          create: questions.map((q) => ({
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            difficulty: q.difficulty,
          }))
        }
      },
      include: { questions: { select: { id: true, questionText: true, options: true, difficulty: true, points: true } } }
    });
  }

  async getTestsByUser(userId: string, role: string): Promise<Test[]> {
    if (role === 'TEACHER') {
      return this.prisma.test.findMany({
        where: { creatorId: userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { submissions: true, questions: true } }, room: { select: { id: true, name: true, code: true } } }
      });
    } else {
      // Students see published tests in rooms they joined, plus their own attempt status
      return this.prisma.test.findMany({
        where: {
          status: TestStatus.PUBLISHED,
          room: { members: { some: { studentId: userId } } }
        },
        orderBy: { publishedAt: 'desc' },
        include: {
          room: { select: { id: true, name: true, code: true } },
          _count: { select: { questions: true } },
          submissions: {
            where: { studentId: userId },
            select: { id: true, score: true, percentage: true, submittedAt: true },
          },
        }
      });
    }
  }

  async getTestsByRoom(roomId: string, userId: string, role: string): Promise<Test[]> {
    if (role === 'STUDENT') {
      const isMember = await this.prisma.roomMember.findUnique({
        where: { roomId_studentId: { roomId, studentId: userId } }
      });
      if (!isMember) throw new ForbiddenException('Not a member of this room');
      return this.prisma.test.findMany({
        where: { roomId, status: TestStatus.PUBLISHED },
        orderBy: { publishedAt: 'desc' },
        include: {
          _count: { select: { questions: true } },
          submissions: {
            where: { studentId: userId },
            select: { id: true, score: true, percentage: true, submittedAt: true },
          },
        },
      });
    } else {
      const room = await this.prisma.room.findUnique({ where: { id: roomId } });
      if (!room || room.teacherId !== userId) throw new ForbiddenException('Not the teacher of this room');
      return this.prisma.test.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { questions: true, submissions: true } },
          submissions: { select: { percentage: true } },
        },
      });
    }
  }

  async getTestById(id: string, userId: string, role: string): Promise<any> {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { 
        questions: {
          select: { id: true, questionText: true, options: true, points: true, difficulty: true, correctAnswer: role === 'TEACHER' }
        },
        room: true,
        ...(role === 'TEACHER' ? { submissions: { include: { student: { select: { id: true, fullname: true, email: true } } } } } : {})
      }
    });

    if (!test) throw new NotFoundException('Test not found');

    if (role === 'STUDENT') {
      if (test.status !== TestStatus.PUBLISHED) throw new ForbiddenException('Test not available');
      if (test.roomId) {
        const isMember = await this.prisma.roomMember.findUnique({
          where: { roomId_studentId: { roomId: test.roomId, studentId: userId } }
        });
        if (!isMember) throw new ForbiddenException('Not a member of this room');
      }
    } else if (role === 'TEACHER') {
      if (test.creatorId !== userId) throw new ForbiddenException('Not your test');
    }

    return test;
  }

  async publishTest(id: string, userId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: { _count: { select: { questions: true } } },
    });
    if (!test) throw new NotFoundException('Test not found');
    if (test.creatorId !== userId) throw new ForbiddenException('Not your test');
    if (test.status === TestStatus.PUBLISHED) throw new BadRequestException('Already published');
    if (test._count.questions === 0) {
      throw new BadRequestException('Add at least one question before publishing');
    }

    return this.prisma.test.update({
      where: { id },
      data: { status: TestStatus.PUBLISHED, publishedAt: new Date(), questionCount: test._count.questions },
    });
  }

  /** Teacher-side results for one test: attempts, average/high/low, student table. */
  async getTestResults(id: string, userId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id },
      include: {
        room: { select: { id: true, name: true, code: true } },
        _count: { select: { questions: true } },
        submissions: {
          where: { submittedAt: { not: null } },
          include: { student: { select: { id: true, fullname: true, email: true } } },
          orderBy: { percentage: 'desc' },
        },
      },
    });
    if (!test) throw new NotFoundException('Test not found');
    if (test.creatorId !== userId) throw new ForbiddenException('Not your test');

    const percentages = test.submissions
      .map((s) => s.percentage)
      .filter((p): p is number => typeof p === 'number');

    const attempts = test.submissions.map((s, index) => ({
      rank: index + 1,
      submissionId: s.id,
      studentId: s.student.id,
      name: s.student.fullname || s.student.email.split('@')[0],
      email: s.student.email,
      score: s.score,
      percentage: s.percentage,
      correctAnswers: s.correctAnswers,
      wrongAnswers: s.wrongAnswers,
      timeTaken: s.timeTaken,
      submittedAt: s.submittedAt,
    }));

    return {
      test: {
        id: test.id,
        title: test.title,
        topic: test.topic,
        status: test.status,
        duration: test.duration,
        difficulty: test.difficulty,
        questionCount: test._count.questions,
        room: test.room,
        publishedAt: test.publishedAt,
      },
      summary: {
        attemptCount: attempts.length,
        averagePercentage: percentages.length
          ? Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(2))
          : null,
        highPercentage: percentages.length ? Math.max(...percentages) : null,
        lowPercentage: percentages.length ? Math.min(...percentages) : null,
        passRate: percentages.length
          ? Number(((percentages.filter((p) => p >= 40).length / percentages.length) * 100).toFixed(2))
          : null,
      },
      attempts,
    };
  }

  async editQuestion(testId: string, questionId: string, data: any, userId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.creatorId !== userId) throw new ForbiddenException('Not your test');
    
    // allow edits even if published for MVP, or restrict to DRAFT
    return this.prisma.question.update({
      where: { id: questionId },
      data: {
        questionText: data.questionText,
        options: data.options,
        correctAnswer: data.correctAnswer,
        difficulty: data.difficulty,
        points: data.points
      }
    });
  }

  async deleteQuestion(testId: string, questionId: string, userId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: testId } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.creatorId !== userId) throw new ForbiddenException('Not your test');
    
    await this.prisma.question.delete({
      where: { id: questionId }
    });
    
    return this.prisma.test.update({
      where: { id: testId },
      data: { questionCount: { decrement: 1 } }
    });
  }
}
