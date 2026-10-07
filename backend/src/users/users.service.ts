import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { User, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(email: string, passwordHash: string, fullname: string, role: Role = Role.STUDENT): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new ConflictException('Email already exists');
    }
    return this.prisma.user.create({
      data: { email, password: passwordHash, fullname, role },
    });
  }
}
