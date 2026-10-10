import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PDFParse } from 'pdf-parse';
import { DocumentStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../common/security/audit.service.js';
import { validatePdfUpload } from '../common/security/file-validation.js';

@Injectable()
export class DocumentsService {
  private qdrantClient: QdrantClient;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private audit: AuditService,
  ) {
    this.qdrantClient = new QdrantClient({
      url: this.configService.get<string>('QDRANT_URL') || 'http://localhost:6333',
      apiKey: this.configService.get<string>('QDRANT_API_KEY'),
    });
    
    // Ensure qdrant collection exists (fire and forget for this MVP)
    this.qdrantClient.getCollections().then(res => {
      const exists = res.collections.some(c => c.name === 'knowledge_base');
      if (!exists) {
        this.qdrantClient.createCollection('knowledge_base', {
          vectors: { size: 768, distance: 'Cosine' }
        }).catch(e => console.error("Error creating qdrant collection:", e));
      }
    }).catch(e => console.error("Error checking qdrant collections:", e));
  }

  async uploadAndProcess(file: any, roomId: string, userId: string) {
    // 1. Verify access before touching the file.
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.teacherId !== userId) throw new ForbiddenException('Only the room teacher can upload');

    // 2. Content-based validation (magic bytes, size, no active content).
    const safe = validatePdfUpload(file);
    const fileHash = createHash('sha256').update(safe.buffer).digest('hex');

    // 3. Save document record as PROCESSING.
    const doc = await this.prisma.document.create({
      data: {
        roomId,
        fileName: safe.originalname,
        fileUrl: '', // In a real app, upload to S3. For MVP, we just process it directly.
        fileHash,
        fileSize: safe.size,
        mimeType: safe.mimetype,
        uploadedBy: userId,
        status: DocumentStatus.PROCESSING,
      },
    });

    await this.audit.record({
      action: 'document.uploaded',
      actorId: userId,
      entity: 'Document',
      entityId: doc.id,
      metadata: { roomId, fileName: safe.originalname, size: safe.size, sha256: fileHash },
    });

    // 4. Process PDF asynchronously.
    this.processPdfBg(safe.buffer, doc.id, roomId).catch(async (e) => {
      console.error(`Failed to process PDF ${doc.id}:`, e);
      await this.prisma.document
        .update({ where: { id: doc.id }, data: { status: DocumentStatus.FAILED } })
        .catch(console.error);
    });

    return doc;
  }

  /** Document + processing status, used by the teacher UI to poll until READY. */
  async getDocument(id: string, userId: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        roomId: true,
        fileName: true,
        status: true,
        chunkCount: true,
        error: true,
        uploadedBy: true,
        createdAt: true,
        room: { select: { id: true, name: true, code: true, teacherId: true } },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.room.teacherId !== userId) throw new ForbiddenException('Not your document');
    return doc;
  }

  async listDocuments(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.teacherId !== userId) throw new ForbiddenException('Only the room teacher can list documents');

    return this.prisma.document.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        status: true,
        chunkCount: true,
        error: true,
        createdAt: true,
        _count: { select: { tests: true } },
      },
    });
  }

  private async processPdfBg(buffer: Buffer, docId: string, roomId: string) {
    // Parse PDF using pdf-parse v2 API
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    let text = '';
    try {
      const result = await parser.getText();
      text = (result.text || '').trim();
    } finally {
      await parser.destroy?.().catch(() => {});
    }

    if (text.length < 40) {
      throw new Error(
        'No selectable text found in this PDF. Scanned documents require OCR, which is not part of the MVP.',
      );
    }

    // Chunk text (simple approach: split by newlines, group into ~500 chars)
    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';

    for (const p of paragraphs) {
      if (currentChunk.length + p.length > 500) {
        if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
        currentChunk = p;
      } else {
        currentChunk += '\n' + p;
      }
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());

    // Generate embeddings (Mocking with random vector for MVP since we don't have an embedding API configured)
    // In reality, you'd call OpenAI/Nomic embeddings API here.
    const points = chunks.map((chunk, index) => {
      return {
        id: crypto.randomUUID(),
        vector: new Array(768).fill(0).map(() => Math.random()),
        payload: {
          docId,
          roomId,
          text: chunk,
          chunkIndex: index
        }
      };
    });

    if (points.length > 0) {
      try {
        await this.qdrantClient.upsert('knowledge_base', {
          wait: true,
          points
        });
      } catch (error: any) {
        // Vector storage is an optimisation: the extracted text below keeps
        // generation working when Qdrant is unavailable.
        console.error('Qdrant upsert failed, continuing with stored text:', error?.message || error);
      }
    }

    // Store the extracted text so retrieval works even without Qdrant,
    // then mark READY.
    await this.prisma.document.update({
      where: { id: docId },
      data: {
        status: DocumentStatus.READY,
        extractedText: text.slice(0, 200000),
        chunkCount: chunks.length,
        error: null,
      }
    });
  }
}
