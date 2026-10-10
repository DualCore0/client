import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { JwtService } from '@nestjs/jwt';
import { createJwtMock } from '../testing/test-doubles.js';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    create: ReturnType<typeof vi.fn>;
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  const jwtMock = createJwtMock();

  beforeEach(async () => {
    usersService = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('hashes the password and never returns it', async () => {
      usersService.create.mockImplementation(async (email, passwordHash, fullname, role) => ({
        id: 'user-1',
        email,
        password: passwordHash,
        fullname,
        role,
      }));

      const result = await service.register('new@student.com', 'plaintext123', 'New Student');

      const [, storedHash] = usersService.create.mock.calls[0];
      expect(storedHash).not.toBe('plaintext123');
      expect(await bcrypt.compare('plaintext123', storedHash)).toBe(true);
      expect(result.user).not.toHaveProperty('password');
      expect(result.access_token).toBe('signed.jwt.token');
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(service.login('nobody@x.com', 'pw')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: await bcrypt.hash('correct-password', 4),
        fullname: 'A',
        role: 'STUDENT',
      });

      await expect(service.login('a@b.com', 'wrong-password')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('issues a token for valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        password: await bcrypt.hash('correct-password', 4),
        fullname: 'A Student',
        role: 'STUDENT',
      });

      const result = await service.login('a@b.com', 'correct-password');
      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: 'u1',
        email: 'a@b.com',
        fullname: 'A Student',
        role: 'STUDENT',
      });
    });
  });

  describe('me', () => {
    it('throws when the user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);
      await expect(service.me('missing')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
