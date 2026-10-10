import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('reports the service as ok with a timestamp', () => {
      const result = appController.health();
      expect(result.status).toBe('ok');
      expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    });
  });
});
