import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentsService } from './documents.service.js';
import { PrismaService } from '../prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../common/security/audit.service.js';
import { createPrismaMock, PrismaMock, createConfigMock } from '../testing/test-doubles.js';

/** Builds a byte-valid minimal PDF that clears the content checks. */
function pdfBuffer(extra = ''): Buffer {
  const body = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${extra}${'% padding to exceed the minimum size\n'.repeat(3)}trailer\n<< /Size 1 >>\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

describe('DocumentsService', () => {
  let service: DocumentsService;
  let prisma: PrismaMock;
  let audit: { record: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: vi.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: createConfigMock({ QDRANT_URL: 'http://localhost:6333' }),
        },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadAndProcess', () => {
    const validFile = () => ({
      originalname: 'DBMS Unit 1.pdf',
      mimetype: 'application/pdf',
      size: pdfBuffer().length,
      buffer: pdfBuffer(),
    });

    it('rejects a file whose bytes are not a PDF', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });

      const fake = {
        originalname: 'notes.pdf',
        // A lying mimetype: this is the attack the check exists to stop.
        mimetype: 'application/pdf',
        size: Buffer.from('%PDF-1.4').length,
        buffer: Buffer.from('%PDF-1.4'),
      };

      await expect(service.uploadAndProcess(fake, 'room-1', 'teacher-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects a plain text file renamed to .pdf', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });

      const body = Buffer.from('This is definitely not a PDF, just some text. '.repeat(5));
      const textFile = {
        originalname: 'notes.pdf',
        mimetype: 'application/pdf',
        size: body.length,
        buffer: body,
      };

      await expect(service.uploadAndProcess(textFile, 'room-1', 'teacher-1')).rejects.toThrow(
        /not a valid pdf/i,
      );
    });

    it('rejects a file whose declared size does not match its bytes', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });

      const file = validFile();
      await expect(
        service.uploadAndProcess({ ...file, size: file.size + 5000 }, 'room-1', 'teacher-1'),
      ).rejects.toThrow(/size does not match/i);
    });

    it('rejects a PDF containing embedded JavaScript', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });

      const malicious = {
        originalname: 'evil.pdf',
        mimetype: 'application/pdf',
        size: pdfBuffer('/JavaScript (alert(1))').length,
        buffer: pdfBuffer('/JavaScript (alert(1))'),
      };

      await expect(service.uploadAndProcess(malicious, 'room-1', 'teacher-1')).rejects.toThrow(
        /active content/i,
      );
    });

    it('rejects a PDF that is missing the %%EOF trailer', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });
      const truncated = pdfBuffer().subarray(0, pdfBuffer().length - 10);

      await expect(
        service.uploadAndProcess(
          { originalname: 't.pdf', mimetype: 'application/pdf', size: truncated.length, buffer: truncated },
          'room-1',
          'teacher-1',
        ),
      ).rejects.toThrow(/eof/i);
    });

    it('rejects uploads to a room the teacher does not own', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'owner' });

      await expect(service.uploadAndProcess(validFile(), 'room-1', 'intruder')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      // No document row is created for an unauthorised upload.
      expect(prisma.document.create).not.toHaveBeenCalled();
    });

    it('throws for an unknown room', async () => {
      prisma.room.findUnique.mockResolvedValue(null);
      await expect(service.uploadAndProcess(validFile(), 'nope', 'teacher-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('records the document with integrity metadata and sanitises the filename', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });
      prisma.document.create.mockResolvedValue({ id: 'doc-1', status: 'PROCESSING' });

      const result: any = await service.uploadAndProcess(
        { ...validFile(), originalname: '..\\..\\evil name!.pdf' },
        'room-1',
        'teacher-1',
      );

      expect(result.status).toBe('PROCESSING');

      const created = prisma.document.create.mock.calls[0][0].data;
      expect(created.status).toBe('PROCESSING');
      expect(created.uploadedBy).toBe('teacher-1');
      expect(created.mimeType).toBe('application/pdf');
      expect(created.fileSize).toBeGreaterThan(0);
      // A sha-256 integrity hash is stored, not the raw bytes.
      expect(created.fileHash).toMatch(/^[a-f0-9]{64}$/);
      // Path components must be stripped.
      expect(created.fileName).not.toContain('..');
      expect(created.fileName).not.toContain('\\');
    });

    it('writes an audit entry for the upload', async () => {
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', teacherId: 'teacher-1' });
      prisma.document.create.mockResolvedValue({ id: 'doc-1', status: 'PROCESSING' });

      await service.uploadAndProcess(validFile(), 'room-1', 'teacher-1');

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'document.uploaded', entityId: 'doc-1' }),
      );
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
      prisma.document.findUnique.mockResolvedValue({ id: 'doc-1', room: { teacherId: 'owner' } });

      await expect(service.getDocument('doc-1', 'intruder')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
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
      await expect(service.listDocuments('room-1', 'intruder')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
