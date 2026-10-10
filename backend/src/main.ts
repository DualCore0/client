import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

/**
 * Application bootstrap with the security middleware stack applied.
 *
 * Order matters: helmet and body limits run before routing, the global
 * validation pipe sanitises DTOs, and the exception filter is the last line of
 * defence for leaked internals.
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Never echo a raw stack trace to the client.
    bufferLogs: false,
  });

  /* ── proxy awareness (correct client IPs for audit + throttling) ── */
  app.set('trust proxy', 1);

  /* ── security headers ──────────────────────────────────────────── */
  app.use(
    helmet({
      // The API serves JSON only, so lock the CSP right down.
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'none'"],
          'form-action': ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: isProduction
        ? { maxAge: 15552000, includeSubDomains: true, preload: true }
        : false,
      noSniff: true,
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      // X-XSS-Protection is obsolete but harmless on older browsers.
      xssFilter: true,
      dnsPrefetchControl: { allow: false },
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    }),
  );

  // Remove the framework fingerprint entirely.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  /* ── cookies (refresh token) ───────────────────────────────────── */
  app.use(cookieParser());

  /* ── request body limits ──────────────────────────────────────── */
  // The PDF upload route needs headroom; everything else is small.
  app.useBodyParser('json', { limit: '256kb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '256kb' });

  /* ── CORS: explicit allow-list, credentials enabled ───────────── */
  const configured = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = isProduction
    ? configured
    : Array.from(new Set([...configured, 'http://localhost:3000', 'http://127.0.0.1:3000']));

  app.enableCors({
    origin: (origin, callback) => {
      // Same-origin/server-to-server requests have no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      logger.warn(`Blocked CORS request from ${origin}`);
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Correlation-Id'],
    maxAge: 600,
  });

  /* ── global validation ────────────────────────────────────────── */
  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties, and reject payloads that try to set them.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      // Required by the DTO selectors on nested objects.
      forbidUnknownValues: true,
      disableErrorMessages: false,
      validationError: { target: false, value: false },
    }),
  );

  /* ── global exception filter ──────────────────────────────────── */
  app.useGlobalFilters(new AllExceptionsFilter());

  /* ── graceful shutdown ────────────────────────────────────────── */
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  logger.log(`ClassRank API listening on http://localhost:${port} (${isProduction ? 'production' : 'development'})`);
  logger.log(`CORS allow-list: ${allowedOrigins.join(', ')}`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
