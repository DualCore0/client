import { Test, TestingModule } from '@nestjs/testing';
import { RoomsController, PublicRoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

describe('RoomsController', () => {
  let controller: RoomsController;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    service = {
      createRoom: vi.fn(),
      getRoomsForUser: vi.fn(),
      joinRoom: vi.fn(),
      getRoomDetails: vi.fn(),
      getRoomPreview: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RoomsController, PublicRoomsController],
      providers: [{ provide: RoomsService, useValue: service }],
    }).compile();

    controller = module.get<RoomsController>(RoomsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('attributes a new room to the authenticated teacher', async () => {
    const req = { user: { userId: 'teacher-1', role: 'TEACHER' } };
    await controller.createRoom({ name: 'DBMS', subject: 'CS' } as any, req);
    expect(service.createRoom).toHaveBeenCalledWith('DBMS', 'teacher-1', 'CS', undefined);
  });

  it('joins a room as the authenticated student', async () => {
    const req = { user: { userId: 'student-1', role: 'STUDENT' } };
    await controller.joinRoom({ code: 'K7M4P2' } as any, req);
    expect(service.joinRoom).toHaveBeenCalledWith('K7M4P2', 'student-1');
  });

  it('looks a room up by code for the join link', async () => {
    await controller.getRoomByCode('K7M4P2');
    expect(service.getRoomPreview).toHaveBeenCalledWith('K7M4P2');
  });
});

describe('PublicRoomsController', () => {
  it('delegates the public preview without needing a user', async () => {
    const service = { getRoomPreview: vi.fn().mockResolvedValue({ code: 'K7M4P2' }) };
    const controller = new PublicRoomsController(service as any);

    await expect(controller.getRoomPreview('K7M4P2')).resolves.toEqual({ code: 'K7M4P2' });
    expect(service.getRoomPreview).toHaveBeenCalledWith('K7M4P2');
  });
});
