import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { EncryptionService } from './encryption.service.js';

/**
 * Cross-cutting security providers. Global so any module can inject the audit
 * trail or the encryption helper without re-importing.
 *
 * PrismaService comes from the global PrismaModule.
 */
@Global()
@Module({
  providers: [AuditService, EncryptionService],
  exports: [AuditService, EncryptionService],
})
export class SecurityModule {}
