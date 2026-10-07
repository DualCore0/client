import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PDFParse } from 'pdf-parse';
import { DocumentStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocumentsService {
  private qdrantClient: QdrantClient;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
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
    // 1. Verify access
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.teacherId !== userId) throw new ForbiddenException('Only the room teacher can upload');
    if (file.mimetype !== 'application/pdf') throw new BadRequestException('Only PDF files are allowed');

    // 2. Save document record as PROCESSING
    const doc = await this.prisma.document.create({
      data: {
        roomId,
        fileName: file.originalname,
        fileUrl: '', // In a real app, upload to S3. For MVP, we just process it directly.
        uploadedBy: userId,
        status: DocumentStatus.PROCESSING,
      }
    });

    // 3. Process PDF asynchronously
    this.processPdfBg(file.buffer, doc.id, roomId).catch(e => {
      console.error(`Failed to process PDF ${doc.id}:`, e);
      this.prisma.document.update({ where: { id: doc.id }, data: { status: DocumentStatus.FAILED } }).catch(console.error);
    });

    return doc;
  }

  private async processPdfBg(buffer: Buffer, docId: string, roomId: string) {
    // Parse PDF using pdf-parse v2 API
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const text = result.text;

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
      await this.qdrantClient.upsert('knowledge_base', {
        wait: true,
        points
      });
    }

    // Mark READY
    await this.prisma.document.update({
      where: { id: docId },
      data: { status: DocumentStatus.READY }
    });
  }
}
