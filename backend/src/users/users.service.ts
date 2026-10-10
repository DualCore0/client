import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { User, Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** Active accounts only — soft-deleted rows are never returned. */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), deletedAt: null },
    });
  }

  /** Active accounts only — soft-deleted rows are never returned. */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  async create(email: string, passwordHash: string, fullname: string, role: Role = Role.STUDENT): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      // Same message whether the row is live or soft-deleted: no enumeration.
      throw new ConflictException('Email already exists');
    }
    return this.prisma.user.create({
      data: { email: normalizedEmail, password: passwordHash, fullname, role },
    });
  }

  /**
   * Soft-deletes an account: the row is retained for audit and referential
   * integrity, all sessions are revoked, and every outstanding access token is
   * invalidated by bumping `tokenVersion`.
   */
  async softDelete(id: string, actorId?: string): Promise<{ success: true }> {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'DELETED',
          tokenVersion: { increment: 1 },
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'account_deleted' },
      }),
      this.prisma.auditLog.create({
        data: {
          action: 'user.soft_deleted',
          actorId: actorId ?? null,
          entity: 'User',
          entityId: id,
          actorEmail: user.email,
        },
      }),
    ]);

    return { success: true };
  }

  /**
   * Public profile used by the student profile page and leaderboard links.
   * Deliberately limited to the same data a leaderboard exposes (name, score,
   * rank) plus aggregate counts — never email addresses or raw answers.
   */
  async getPublicProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, fullname: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Student not found');

    const submissions = await this.prisma.submission.findMany({
      where: { studentId: userId, submittedAt: { not: null } },
      select: {
        id: true,
        percentage: true,
        score: true,
        correctAnswers: true,
        wrongAnswers: true,
        submittedAt: true,
        test: { select: { id: true, title: true, topic: true, room: { select: { name: true, code: true } } } },
      },
      orderBy: { submittedAt: 'desc' },
    });

    const percentages = submissions
      .map((s) => s.percentage)
      .filter((p): p is number => typeof p === 'number');
    const totalCorrect = submissions.reduce((a, s) => a + (s.correctAnswers || 0), 0);
    const totalAnswered = submissions.reduce(
      (a, s) => a + (s.correctAnswers || 0) + (s.wrongAnswers || 0),
      0,
    );

    // Room this student is most active in (by completed tests).
    const roomCounts = new Map<string, { name: string; code: string; count: number }>();
    for (const s of submissions) {
      const room = s.test.room;
      if (!room) continue;
      const entry = roomCounts.get(room.code) || { name: room.name, code: room.code, count: 0 };
      entry.count += 1;
      roomCounts.set(room.code, entry);
    }
    const primaryRoom =
      Array.from(roomCounts.values()).sort((a, b) => b.count - a.count)[0] || null;

    return {
      id: user.id,
      name: user.fullname || 'Student',
      role: user.role,
      joinedAt: user.createdAt,
      primaryRoom,
      stats: {
        testsCompleted: submissions.length,
        averagePercentage: percentages.length
          ? Number((percentages.reduce((a, b) => a + b, 0) / percentages.length).toFixed(2))
          : null,
        accuracy: totalAnswered
          ? Number(((totalCorrect / totalAnswered) * 100).toFixed(2))
          : null,
        highPercentage: percentages.length ? Math.max(...percentages) : null,
      },
      recentTests: submissions.slice(0, 10).map((s) => ({
        submissionId: s.id,
        testId: s.test.id,
        title: s.test.title,
        topic: s.test.topic,
        room: s.test.room?.name || null,
        percentage: s.percentage,
        score: s.score,
        submittedAt: s.submittedAt,
      })),
    };
  }
}
