import { Test, TestingModule } from '@nestjs/testing';
import { TestsController } from './tests.controller.js';
import { TestsService } from './tests.service.js';

describe('TestsController', () => {
  let controller: TestsController;
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    service = {
      generateTest: vi.fn(),
      publishTest: vi.fn(),
      editQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
      getTestsByUser: vi.fn(),
      getTestsByRoom: vi.fn(),
      getTestById: vi.fn(),
      getTestResults: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestsController],
      providers: [{ provide: TestsService, useValue: service }],
    }).compile();

    controller = module.get<TestsController>(TestsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('scopes listing and fetching to the caller', async () => {
    const req = { user: { userId: 'teacher-1', role: 'TEACHER' } };

    await controller.getTests(req);
    expect(service.getTestsByUser).toHaveBeenCalledWith('teacher-1', 'TEACHER');

    await controller.getTestById('test-1', req);
    expect(service.getTestById).toHaveBeenCalledWith('test-1', 'teacher-1', 'TEACHER');

    await controller.getTestsByRoom('room-1', req);
    expect(service.getTestsByRoom).toHaveBeenCalledWith('room-1', 'teacher-1', 'TEACHER');
  });

  it('passes the owner through when publishing', async () => {
    const req = { user: { userId: 'teacher-1', role: 'TEACHER' } };
    await controller.publishTest('test-1', req);
    expect(service.publishTest).toHaveBeenCalledWith('test-1', 'teacher-1');
  });

  it('exposes per-test results to teachers', async () => {
    const req = { user: { userId: 'teacher-1', role: 'TEACHER' } };
    await controller.getTestResults('test-1', req);
    expect(service.getTestResults).toHaveBeenCalledWith('test-1', 'teacher-1');
  });
});
