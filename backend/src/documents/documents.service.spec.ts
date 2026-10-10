import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { PrismaService } from '../prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { createPrismaMock, PrismaMock, createConfigMock } from '../testing/test-doubles.js';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: createConfigMock({ QDRANT_URL: 'http://localhost:6333' }),
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadAndProcess', () => {
    const pdfFile = {
      originalname: 'DBMS Unit 1.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4'),
    };

    it('rejects a non-PDF upload', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });

      await expect(
        service.uploadAndProcess({ ...pdfFile, mimetype: 'text/plain' }, 'room-1', 'teacher-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects uploads to a room the teacher does not own', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'owner' });

      await expect(service.uploadAndProcess(pdfFile, 'room-1', 'intruder')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws for an unknown room', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      await expect(service.uploadAndProcess(pdfFile, 'nope', 'teacher-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('records the document as PROCESSING before returning', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });
      prisma.document.create.mockResolvedValue({ id: 'doc-1', status: 'PROCESSING' });

      const result: any = await service.uploadAndProcess(pdfFile, 'room-1', 'teacher-1');

      expect(result.status).toBe('PROCESSING');
      expect(prisma.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          roomId: 'room-1',
          fileName: 'DBMS Unit 1.pdf',
          status: 'PROCESSING',
          uploadedBy: 'teacher-1',
        }),
      });
    });
  });

  describe('getDocument', () => {
    it('returns processing status for polling', async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        roomId: 'room-1',
        fileName: 'x.pdf',
        status: 'READY',
        chunkCount: 12,
        error: null,
        uploadedBy: 'teacher-1',
        createdAt: new Date(),
        room: { id: 'room-1', name: 'DBMS', code: 'K7M4P2', teacherId: 'teacher-1' },
      });

      const result: any = await service.getDocument('doc-1', 'teacher-1');
      expect(result.status).toBe('READY');
      expect(result.chunkCount).toBe(12);
    });

    it("will not expose another teacher's document", async () => {
      prisma.document.findUnique.mockResolvedValue({
        id: 'doc-1',
        room: { teacherId: 'owner' },
      });

      await expect(service.getDocument('doc-1', 'intruder')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws for a missing document', async () => {
      prisma.document.findUnique.mockResolvedValue(null);
      await expect(service.getDocument('nope', 'teacher-1')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listDocuments', () => {
    it('lists only the owner documents, newest first', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });
      prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);

      await service.listDocuments('room-1', 'teacher-1');

      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { roomId: 'room-1' }, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('blocks non-owners', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'owner' });
      await expect(service.listDocuments('room-1', 'intruder')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
