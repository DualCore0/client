import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    me: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authService = { register: vi.fn(), login: vi.fn(), me: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('forwards register payloads to the service', async () => {
    authService.register.mockResolvedValue({ access_token: 't' });
    const dto = { email: 'a@b.com', password: 'password123', fullname: 'A', role: 'STUDENT' as any };

    await controller.register(dto as any);

    expect(authService.register).toHaveBeenCalledWith('a@b.com', 'password123', 'A', 'STUDENT');
  });

  it('exposes /auth/signup as an alias of register', async () => {
    authService.register.mockResolvedValue({ access_token: 't' });
    const dto = { email: 'a@b.com', password: 'password123', fullname: 'A', role: 'TEACHER' as any };

    await controller.signup(dto as any);

    expect(authService.register).toHaveBeenCalledWith('a@b.com', 'password123', 'A', 'TEACHER');
  });

  it('resolves the current user from the JWT subject', async () => {
    authService.me.mockResolvedValue({ id: 'u1' });
    await controller.me({ user: { userId: 'u1' } });
    expect(authService.me).toHaveBeenCalledWith('u1');
  });
});
