import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    service = {
      uploadAndProcess: vi.fn(),
      getDocument: vi.fn(),
      listDocuments: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentsService, useValue: service }],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('passes the file, room and uploader to the service', async () => {
    const file = { originalname: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('x') };
    await controller.uploadFile(file, 'room-1', { user: { userId: 'teacher-1' } });

    expect(service.uploadAndProcess).toHaveBeenCalledWith(file, 'room-1', 'teacher-1');
  });

  it('returns the processing status for polling', async () => {
    await controller.getDocument('doc-1', { user: { userId: 'teacher-1' } });
    expect(service.getDocument).toHaveBeenCalledWith('doc-1', 'teacher-1');
  });

  it('lists the room documents', async () => {
    await controller.listDocuments('room-1', { user: { userId: 'teacher-1' } });
    expect(service.listDocuments).toHaveBeenCalledWith('room-1', 'teacher-1');
  });
});
