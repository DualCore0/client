import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client with a boot-time retry.
 *
 * The database is Neon serverless Postgres, which suspends after a period of
 * inactivity. The first connection after a suspend can take a few seconds, so a
 * single failed `$connect()` should not take the whole API down.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    const attempts = Number(process.env.DB_CONNECT_ATTEMPTS) || 6;
    let delay = 1000;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.$connect();
        if (attempt > 1) this.logger.log(`Database connection established on attempt ${attempt}.`);
        return;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const isLast = attempt === attempts;
        this.logger.warn(
          `Database connection attempt ${attempt}/${attempts} failed (${message.split('\n')[0]}).${
            isLast ? '' : ` Retrying in ${delay}ms…`
          }`,
        );
        if (isLast) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 8000);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
