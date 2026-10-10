import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GenerateTestDto } from './ai.dto.js';
import {
  fallbackQuestions,
  generateQuestionsWithLlm,
  normalizeQuestions,
  GeneratedQuestion,
} from '../common/question-generator.js';

const MAX_DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'straightforward recall and definition',
  MEDIUM: 'application and understanding',
  HARD: 'analysis, edge cases and multi-step reasoning',
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
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

  /**
   * Retrieves the study context for a document. Tries Qdrant (RAG retrieval)
   * and falls back to the text extracted from the PDF at upload time so the
   * flow still works if the vector store is unavailable.
   */
  private async retrieveContext(documentId: string, topic?: string): Promise<string> {
    let context = '';

    try {
      const res: any = await this.qdrantClient.scroll('knowledge_base', {
        filter: { must: [{ key: 'docId', match: { value: documentId } }] },
        limit: 30,
        with_payload: true,
      });
      const chunks: string[] = (res?.points || [])
        .map((p: any) => (p?.payload?.text as string) || '')
        .filter((t: string) => t.trim().length > 0);
      if (chunks.length) {
        // Prefer chunks that mention the requested topic.
        if (topic) {
          const needle = topic.toLowerCase();
          chunks.sort((a, b) => Number(b.toLowerCase().includes(needle)) - Number(a.toLowerCase().includes(needle)));
        }
        context = chunks.join('\n\n');
      }
    } catch (error: any) {
      this.logger.warn(`Qdrant retrieval failed for document ${documentId}: ${error?.message || error}`);
    }

    if (!context.trim()) {
      const doc = await this.prisma.document.findUnique({
        where: { id: documentId },
        select: { extractedText: true },
      });
      context = doc?.extractedText || '';
    }

    // Keep the prompt within a sane size.
    return context.slice(0, 24000);
  }

  async generateTest(dto: GenerateTestDto, userId: string) {
    // 1. Authorisation
    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.teacherId !== userId) throw new ForbiddenException('Only the room teacher can generate tests');

    const document = await this.prisma.document.findUnique({ where: { id: dto.documentId } });
    if (!document || document.roomId !== dto.roomId) {
      throw new NotFoundException('Document not found in this room');
    }
    if (document.status === 'PROCESSING') {
      throw new BadRequestException('Document is still being processed. Try again in a moment.');
    }
    if (document.status === 'FAILED') {
      throw new BadRequestException(
        `Text extraction failed for "${document.fileName}". ${document.error || 'Please upload another PDF.'}`,
      );
    }

    // 2. Retrieve study context (RAG)
    const context = await this.retrieveContext(dto.documentId, dto.topic);
    if (!context.trim()) {
      throw new BadRequestException(
        'No readable text was found in this PDF. Scanned documents need OCR, which is out of scope for the MVP.',
      );
    }

    // 3. Prompt the LLM
    const difficultyHint =
      MAX_DIFFICULTY_LABEL[(dto.difficulty || 'MEDIUM').toUpperCase()] || MAX_DIFFICULTY_LABEL.MEDIUM;
    const prompt = `Generate exactly ${dto.questionCount} multiple-choice questions for a class test.

Rules:
- Base every question ONLY on the study material provided below.
- Each question must have exactly 4 distinct options and exactly one correct answer.
- "correctAnswer" must be the 0-based index (0, 1, 2 or 3) of the correct option.
- Questions should test ${difficultyHint}.
- Do not repeat questions or options.

Study material:
"""
${context}
"""

Respond with raw JSON only, in this exact shape:
{"questions":[{"question":"...","options":["...","...","...","..."],"correctAnswer":0,"difficulty":"${(dto.difficulty || 'MEDIUM').toUpperCase()}"}]}`;

    const apiKey = this.configService.get<string>('OPENROUTER_API_KEY');
    let questions: GeneratedQuestion[];

    if (!apiKey) {
      this.logger.warn('OPENROUTER_API_KEY is not set — using offline fallback questions.');
      questions = fallbackQuestions(dto.topic || document.fileName, dto.questionCount, dto.difficulty);
    } else {
      try {
        questions = await generateQuestionsWithLlm({
          apiKey,
          prompt,
          expected: dto.questionCount,
        });
      } catch (error: any) {
        this.logger.error(`AI generation failed: ${error?.message || error}`);
        throw new InternalServerErrorException(
          'The AI could not produce valid questions for this document. Please try again.',
        );
      }
    }

    // 4. Save as DRAFT — a teacher must review before publishing.
    return this.prisma.test.create({
      data: {
        title: dto.title,
        topic: dto.topic || null,
        duration: dto.duration,
        questionCount: questions.length,
        difficulty: dto.difficulty || 'MEDIUM',
        status: 'DRAFT',
        roomId: dto.roomId,
        documentId: dto.documentId,
        creatorId: userId,
        questions: {
          create: questions.map((q) => ({
            questionText: q.questionText,
            options: q.options,
            correctAnswer: q.correctAnswer,
            difficulty: q.difficulty,
          })),
        },
      },
      include: { questions: true, document: { select: { id: true, fileName: true } } },
    });
  }

  /** Validates a raw question array (exposed for tests). */
  validate(raw: unknown): GeneratedQuestion[] {
    return normalizeQuestions(raw);
  }
}
