import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Terminal exception filter.
 *
 * Guarantees that:
 *  - 5xx responses never leak stack traces, driver errors or SQL fragments.
 *  - Every response carries a correlation id that matches the server log line.
 *  - Security-relevant 401/403s are logged with the request context.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = randomUUID();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    /* ── build a client-safe message ──────────────────────────── */
    let message: string | string[] = 'Internal server error';
    if (isHttp) {
      const payload = exception.getResponse();
      if (typeof payload === 'string') {
        message = payload;
      } else if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        message = (record.message as string | string[]) ?? exception.message;
      }
    }

    /* ── log ──────────────────────────────────────────────────── */
    const route = `${request.method} ${request.originalUrl ?? request.url}`;
    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${route} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else if (status === 401 || status === 403 || status === 429) {
      this.logger.warn(
        `[${correlationId}] ${route} -> ${status} ip=${request.ip ?? 'unknown'} ua=${String(
          request.headers['user-agent'] ?? '',
        ).slice(0, 120)}`,
      );
    }

    /* ── respond ──────────────────────────────────────────────── */
    const body: Record<string, unknown> = {
      statusCode: status,
      // Only echo messages we generated ourselves; never a driver/internal error.
      message: status >= 500 ? 'Internal server error' : message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl ?? request.url,
      correlationId,
    };

    if (status >= 500 && process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      // Helpful locally, never in production.
      body.detail = exception.message;
    }

    response.status(status).json(body);
  }
}
