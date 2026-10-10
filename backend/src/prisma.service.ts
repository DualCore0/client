import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Prisma error codes that indicate a *connection* problem rather than a data
 * problem. These are the errors worth retrying: the statement never reached the
 * database, so replaying it cannot duplicate work.
 */
const TRANSIENT_PRISMA_CODES = new Set([
  'P1001', // Can't reach the database server
  'P1002', // Connection timed out
  'P1008', // Operation timed out
  'P1010', // User was denied access (transient auth/permission blip)
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching a connection from the pool
]);

const TRANSIENT_MESSAGE_PATTERNS = [
  /can't reach database server/i,
  /connection (closed|reset|terminated)/i,
  /server has closed the connection/i,
  /timed out fetching a new connection/i,
  /terminating connection due to administrator command/i,
  /ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND/,
];

function isTransient(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_PRISMA_CODES.has(error.code);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Prisma client with resilience for serverless Postgres.
 *
 * Neon suspends an idle database; the next statement then fails with a
 * connection error instead of returning data. Two protections are applied:
 *
 *  1. Boot retry — a failed `$connect()` does not take the API down.
 *  2. Statement retry — connection-level failures are replayed with exponential
 *     backoff, so a cold start surfaces as latency rather than a 500.
 *
 * Only connection errors are retried. Uniqueness and foreign-key violations
 * fail immediately, and because a failed connection means the statement never
 * ran, replaying a write cannot double-apply it.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();

    const maxAttempts = Math.max(1, Number(process.env.DB_STATEMENT_RETRIES) || 4);

    this.$use(async (params, next) => {
      let delay = 250;

      for (let attempt = 1; ; attempt++) {
        try {
          return await next(params);
        } catch (error: unknown) {
          const lastAttempt = attempt >= maxAttempts;
          if (!isTransient(error) || lastAttempt) throw error;

          this.logger.warn(
            `Transient database error on ${params.model ?? 'raw'}.${params.action} ` +
              `(attempt ${attempt}/${maxAttempts}); retrying in ${delay}ms.`,
          );
          await sleep(delay);
          delay = Math.min(delay * 2, 4000);
        }
      }
    });
  }

  async onModuleInit() {
    const attempts = Math.max(1, Number(process.env.DB_CONNECT_ATTEMPTS) || 6);
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
        await sleep(delay);
        delay = Math.min(delay * 2, 8000);
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
