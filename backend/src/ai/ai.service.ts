import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GenerateTestDto } from './ai.dto.js';

@Injectable()
export class AiService {
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

  async generateTest(dto: GenerateTestDto, userId: string) {
    // 1. Verify access
    const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.teacherId !== userId) throw new ForbiddenException('Only the room teacher can generate tests');

    const document = await this.prisma.document.findUnique({ where: { id: dto.documentId } });
    if (!document || document.roomId !== dto.roomId) {
      throw new NotFoundException('Document not found in this room');
    }
    if (document.status !== 'READY') {
      throw new InternalServerErrorException('Document is not ready for processing');
    }

    // 2. Fetch chunks from Qdrant
    let context = '';
    try {
      const res = await this.qdrantClient.scroll('knowledge_base', {
        filter: {
          must: [{ key: 'docId', match: { value: dto.documentId } }]
        },
        limit: 20, // get up to 20 chunks for context
      });
      const chunks = res.points.map(p => (p.payload?.text as string) || '');
      context = chunks.join('\n\n');
    } catch (e) {
      console.error('Qdrant error:', e);
      // Fallback if Qdrant is not set up correctly
      context = "No context retrieved. Fallback mode.";
    }

    // 3. Prompt LLM
    const prompt = `You are a test generator. Based on the following document context, generate exactly ${dto.questionCount} multiple-choice questions.
The difficulty should be ${dto.difficulty || 'mixed'}.
Context:
${context}

Return ONLY valid JSON in this exact structure, nothing else:
{
  "questions": [
    {
      "question": "Question text here",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": 0, // index (0-3) of correct option
      "difficulty": "EASY" // or MEDIUM or HARD
    }
  ]
}
`;

    let generatedQuestions = [];
    const openrouterKey = this.configService.get<string>('OPENROUTER_API_KEY');
    
    if (!openrouterKey) {
      // Mock generation for testing if no key provided
      generatedQuestions = Array.from({ length: dto.questionCount }).map((_, i) => ({
        question: `Mock Question ${i + 1} based on document?`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: 0,
        difficulty: "MEDIUM"
      }));
    } else {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openrouterKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'google/gemini-pro',
            messages: [{ role: 'user', content: prompt }]
          })
        });
        
        if (!response.ok) {
          throw new Error('LLM API error');
        }
        
        const data = await response.json();
        const text = data.choices[0].message.content;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        generatedQuestions = parsed.questions || [];
      } catch (e) {
        console.error('LLM parsing error:', e);
        throw new InternalServerErrorException('Failed to generate valid questions from AI');
      }
    }

    // Validate generated output
    if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
      throw new InternalServerErrorException('AI did not return any questions');
    }

    // 4. Save Test as DRAFT
    const test = await this.prisma.test.create({
      data: {
        title: dto.title,
        duration: dto.duration,
        questionCount: generatedQuestions.length,
        difficulty: dto.difficulty,
        status: 'DRAFT',
        roomId: dto.roomId,
        documentId: dto.documentId,
        creatorId: userId,
        questions: {
          create: generatedQuestions.map(q => ({
            questionText: q.question,
            options: q.options,
            correctAnswer: q.correctAnswer,
            difficulty: q.difficulty || 'MEDIUM',
          }))
        }
      },
      include: {
        questions: true,
      }
    });

    return test;
  }
}
