import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

/** Global weekly score weights — adjustable via env without a code change. */
function weights() {
  const w = (key: string, fallback: number) => {
    const raw = Number(process.env[key]);
    return Number.isFinite(raw) && raw >= 0 ? raw : fallback;
  };
  return {
    average: w('GLOBAL_W_AVERAGE', 0.7),
    accuracy: w('GLOBAL_W_ACCURACY', 0.2),
    participation: w('GLOBAL_W_PARTICIPATION', 0.1),
    minTests: Math.max(1, Number(process.env.GLOBAL_MIN_TESTS) || 3),
    /** Tests completed in the week that count as full participation. */
    fullParticipation: Math.max(1, Number(process.env.GLOBAL_PARTICIPATION_TARGET) || 5),
  };
}

function startOfCurrentWeek(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday),
  );
  return monday;
}

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Room leaderboard: average percentage across a student's completed tests in
   * the room. Ranked best-first, with the viewer's own position included so the
   * UI can highlight the current student.
   */
  async getRoomLeaderboard(roomCode: string, viewerId?: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() },
      include: {
        tests: {
          include: {
            submissions: {
              where: { submittedAt: { not: null } },
              include: { student: { select: { id: true, fullname: true, email: true } } },
            },
          },
        },
      },
    });

    if (!room) throw new NotFoundException('Room not found');

    const studentStats = new Map<
      string,
      { id: string; name: string; totalPercentage: number; testsCompleted: number; timeSpent: number }
    >();

    for (const test of room.tests) {
      for (const sub of test.submissions) {
        if (sub.percentage === null) continue;
        const stats =
          studentStats.get(sub.studentId) ||
          {
            id: sub.student.id,
            name: sub.student.fullname || sub.student.email.split('@')[0],
            totalPercentage: 0,
            testsCompleted: 0,
            timeSpent: 0,
          };
        stats.totalPercentage += sub.percentage;
        stats.testsCompleted += 1;
        stats.timeSpent += sub.timeTaken || 0;
        studentStats.set(sub.studentId, stats);
      }
    }

    const leaderboard = Array.from(studentStats.values())
      .map((stat) => ({
        studentId: stat.id,
        name: stat.name,
        averagePercentage: Number((stat.totalPercentage / stat.testsCompleted).toFixed(2)),
        testsCompleted: stat.testsCompleted,
        averageTimeTaken: Math.round(stat.timeSpent / stat.testsCompleted),
      }))
      .sort((a, b) => b.averagePercentage - a.averagePercentage || b.testsCompleted - a.testsCompleted)
      .map((l, index) => ({ ...l, rank: index + 1 }));

    const viewer = viewerId ? leaderboard.find((l) => l.studentId === viewerId) || null : null;

    return {
      room: {
        id: room.id,
        code: room.code,
        name: room.name,
        subject: room.subject,
      },
      leaderboard,
      viewer,
      totalTests: room.tests.filter((t) => t.status === 'PUBLISHED').length,
      totalParticipants: leaderboard.length,
    };
  }

  /**
   * Global weekly leaderboard.
   * Global Score = 0.70 * AvgPercentage + 0.20 * Accuracy + 0.10 * Participation
   * Students need at least `GLOBAL_MIN_TESTS` (default 3) completed tests this week.
   */
  async getGlobalWeeklyLeaderboard(viewerId?: string) {
    const cfg = weights();
    const weekStart = startOfCurrentWeek();
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const submissions = await this.prisma.submission.findMany({
      where: {
        submittedAt: { gte: weekStart, lt: weekEnd },
        percentage: { not: null },
      },
      include: {
        student: { select: { id: true, fullname: true, email: true } },
      },
    });

    const studentStats = new Map<
      string,
      {
        id: string;
        name: string;
        totalPercentage: number;
        testsCompleted: number;
        totalCorrect: number;
        totalAnswered: number;
      }
    >();

    for (const sub of submissions) {
      const stats =
        studentStats.get(sub.studentId) ||
        {
          id: sub.student.id,
          name: sub.student.fullname || sub.student.email.split('@')[0],
          totalPercentage: 0,
          testsCompleted: 0,
          totalCorrect: 0,
          totalAnswered: 0,
        };
      stats.totalPercentage += sub.percentage ?? 0;
      stats.testsCompleted += 1;
      stats.totalCorrect += sub.correctAnswers || 0;
      stats.totalAnswered += (sub.correctAnswers || 0) + (sub.wrongAnswers || 0);
      studentStats.set(sub.studentId, stats);
    }

    const board = Array.from(studentStats.values())
      .filter((stat) => stat.testsCompleted >= cfg.minTests)
      .map((stat) => {
        const avgPercentage = stat.totalPercentage / stat.testsCompleted;
        const accuracy = stat.totalAnswered > 0 ? (stat.totalCorrect / stat.totalAnswered) * 100 : 0;
        const participation = Math.min(stat.testsCompleted / cfg.fullParticipation, 1) * 100;
        const globalScore =
          cfg.average * avgPercentage + cfg.accuracy * accuracy + cfg.participation * participation;

        return {
          studentId: stat.id,
          name: stat.name,
          globalScore: Number(globalScore.toFixed(2)),
          avgPercentage: Number(avgPercentage.toFixed(2)),
          accuracy: Number(accuracy.toFixed(2)),
          participation: Number(participation.toFixed(2)),
          testsCompleted: stat.testsCompleted,
        };
      })
      .sort((a, b) => b.globalScore - a.globalScore || b.avgPercentage - a.avgPercentage)
      .map((l, index) => ({ ...l, rank: index + 1 }));

    const viewer = viewerId ? board.find((l) => l.studentId === viewerId) || null : null;

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: new Date(weekEnd.getTime() - 1).toISOString(),
      minTestsRequired: cfg.minTests,
      weights: {
        average: cfg.average,
        accuracy: cfg.accuracy,
        participation: cfg.participation,
      },
      leaderboard: board,
      viewer,
    };
  }
}
