import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Global Prisma client singleton.
 *
 * A single connection pool is shared across the entire application, which is
 * essential for resource management and for features like transactional
 * queries that span multiple services.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}