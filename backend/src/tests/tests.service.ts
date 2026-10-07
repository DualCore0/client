import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service.js';
import { Test, TestStatus } from '@prisma/client';
import { QdrantClient } from '@qdrant/js-client-rest';

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
    try {
      let context = '';
      try {
        const queryVector = new Array(768).fill(0.1); // Dummy vector for now without real embeddings
        const searchResult = await (this.qdrantClient as any).search('knowledge_base', {
          vector: queryVector,
          limit: 3,
        });
        context = searchResult.map((r: any) => r.payload?.text).join('\n');
      } catch (e) {
        console.warn('Qdrant search failed, proceeding without context');
      }

      const prompt = `Generate a ${questionCount}-question multiple choice test on the topic of "${topic}". 
Context: ${context}
Output STRICTLY as JSON in this format and nothing else: { "questions": [{ "question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "difficulty": "MEDIUM" }] }`;
      
      const openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY');
      if (!openRouterApiKey) {
        throw new Error("OPENROUTER_API_KEY is not set.");
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000", 
          "X-Title": "Hackathon App", 
        },
        body: JSON.stringify({
          model: "nvidia/llama-3.1-nemotron-70b-instruct",
          messages: [
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        throw new InternalServerErrorException('Failed to generate test questions');
      }

      const data = await response.json();
      const textResponse = data.choices[0]?.message?.content || "{}";

      let parsedData: any = { questions: [] };
      try {
        const match = textResponse.match(/```json\n([\s\S]*?)\n```/);
        const jsonString = match ? match[1] : textResponse;
        parsedData = JSON.parse(jsonString);
        if (!parsedData.questions && Array.isArray(parsedData)) {
           parsedData = { questions: parsedData };
        }
      } catch (parseError) {
        console.error('Failed to parse LLM response', parseError, textResponse);
        throw new InternalServerErrorException('Failed to parse LLM response');
      }

      const questions = parsedData.questions;
      if (!Array.isArray(questions) || questions.length === 0) {
         throw new InternalServerErrorException('LLM returned invalid format');
      }

      return await this.prisma.test.create({
        data: {
          title: `Test on ${topic}`,
          topic,
          creatorId: userId,
          roomId: roomId || null,
          questionCount: questions.length,
          status: TestStatus.DRAFT,
          questions: {
            create: questions.map((q: any) => ({
              questionText: q.question || q.text,
              options: q.options.slice(0, 4),
              correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
              difficulty: q.difficulty || 'MEDIUM',
            }))
          }
        },
        include: { questions: { select: { id: true, questionText: true, options: true, difficulty: true, points: true } } }
      });

    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Error generating test');
    }
  }

  async getTestsByUser(userId: string, role: string): Promise<Test[]> {
    if (role === 'TEACHER') {
      return this.prisma.test.findMany({
        where: { creatorId: userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { submissions: true } }, room: { select: { name: true } } }
      });
    } else {
      // Students see published tests in rooms they joined
      return this.prisma.test.findMany({
        where: { 
          status: TestStatus.PUBLISHED,
          room: { members: { some: { studentId: userId } } }
        },
        orderBy: { publishedAt: 'desc' },
        include: { room: { select: { name: true } }, _count: { select: { questions: true } } }
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
      });
    } else {
      const room = await this.prisma.room.findUnique({ where: { id: roomId } });
      if (!room || room.teacherId !== userId) throw new ForbiddenException('Not the teacher of this room');
      return this.prisma.test.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
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
    const test = await this.prisma.test.findUnique({ where: { id } });
    if (!test) throw new NotFoundException('Test not found');
    if (test.creatorId !== userId) throw new ForbiddenException('Not your test');
    if (test.status === TestStatus.PUBLISHED) throw new BadRequestException('Already published');

    return this.prisma.test.update({
      where: { id },
      data: { status: TestStatus.PUBLISHED, publishedAt: new Date() }
    });
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
