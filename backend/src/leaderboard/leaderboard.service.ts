import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  async getRoomLeaderboard(roomCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        tests: {
          include: {
            submissions: {
              include: { student: true }
            }
          }
        }
      }
    });

    if (!room) throw new NotFoundException('Room not found');

    const studentStats = new Map<string, { student: any, totalPercentage: number, testsCompleted: number }>();

    room.tests.forEach(test => {
      test.submissions.forEach(sub => {
        if (sub.percentage !== null) {
          const stats = studentStats.get(sub.studentId) || { student: sub.student, totalPercentage: 0, testsCompleted: 0 };
          stats.totalPercentage += sub.percentage;
          stats.testsCompleted += 1;
          studentStats.set(sub.studentId, stats);
        }
      });
    });

    const leaderboard = Array.from(studentStats.values()).map(stat => ({
      studentId: stat.student.id,
      name: stat.student.fullname || stat.student.email.split('@')[0],
      averagePercentage: stat.totalPercentage / stat.testsCompleted,
      testsCompleted: stat.testsCompleted
    }));

    leaderboard.sort((a, b) => b.averagePercentage - a.averagePercentage);

    return leaderboard.map((l, index) => ({ ...l, rank: index + 1 }));
  }

  async getGlobalWeeklyLeaderboard() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const submissions = await this.prisma.submission.findMany({
      where: {
        submittedAt: { gte: oneWeekAgo },
        percentage: { not: null }
      },
      include: {
        student: true,
        test: true
      }
    });

    const studentStats = new Map<string, any>();

    submissions.forEach(sub => {
      const stats = studentStats.get(sub.studentId) || {
        student: sub.student,
        totalPercentage: 0,
        testsCompleted: 0,
        totalCorrect: 0,
        totalQuestions: 0
      };

      stats.totalPercentage += sub.percentage;
      stats.testsCompleted += 1;
      stats.totalCorrect += sub.correctAnswers || 0;
      stats.totalQuestions += (sub.correctAnswers || 0) + (sub.wrongAnswers || 0);

      studentStats.set(sub.studentId, stats);
    });

    const globalBoard: any[] = [];

    studentStats.forEach(stat => {
      if (stat.testsCompleted >= 3) {
        const avgPercentage = stat.totalPercentage / stat.testsCompleted;
        const accuracy = stat.totalQuestions > 0 ? (stat.totalCorrect / stat.totalQuestions) * 100 : 0;
        const participation = Math.min(stat.testsCompleted / 5, 1) * 100;
        
        const globalScore = (0.70 * avgPercentage) + (0.20 * accuracy) + (0.10 * participation);

        globalBoard.push({
          studentId: stat.student.id,
          name: stat.student.fullname || stat.student.email.split('@')[0],
          globalScore: Math.round(globalScore * 100) / 100,
          avgPercentage: Math.round(avgPercentage * 100) / 100,
          accuracy: Math.round(accuracy * 100) / 100,
          testsCompleted: stat.testsCompleted
        });
      }
    });

    globalBoard.sort((a, b) => b.globalScore - a.globalScore);

    return globalBoard.map((l, index) => ({ ...l, rank: index + 1 }));
  }
}
