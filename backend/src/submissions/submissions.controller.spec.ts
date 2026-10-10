import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionsController } from './submissions.controller.js';
import { SubmissionsService } from './submissions.service.js';

describe('SubmissionsController', () => {
  let controller: SubmissionsController;
  let service: {
    startTest: ReturnType<typeof vi.fn>;
    submitTest: ReturnType<typeof vi.fn>;
    getMySubmissions: ReturnType<typeof vi.fn>;
    getSubmissionDetails: ReturnType<typeof vi.fn>;
    getAttemptState: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    service = {
      startTest: vi.fn(),
      submitTest: vi.fn(),
      getMySubmissions: vi.fn(),
      getSubmissionDetails: vi.fn(),
      getAttemptState: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionsController],
      providers: [{ provide: SubmissionsService, useValue: service }],
    }).compile();

    controller = module.get<SubmissionsController>(SubmissionsController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('scopes start and submit to the authenticated student', async () => {
    const req = { user: { userId: 'student-1' } };
    await controller.startTest('test-1', req);
    expect(service.startTest).toHaveBeenCalledWith('test-1', 'student-1');

    await controller.submitTest('test-1', { answers: [] } as any, req);
    expect(service.submitTest).toHaveBeenCalledWith('test-1', 'student-1', []);
  });

  it('only ever returns the caller own submissions', async () => {
    const req = { user: { userId: 'student-1' } };
    await controller.getMySubmissions(req);
    expect(service.getMySubmissions).toHaveBeenCalledWith('student-1');

    await controller.getSubmissionDetails('sub-1', req);
    expect(service.getSubmissionDetails).toHaveBeenCalledWith('sub-1', 'student-1');
  });
});
