import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Authenticated symmetric encryption (AES-256-GCM) for secrets that must be
 * recoverable, such as TOTP shared secrets.
 *
 * Format: `v1:<iv-b64>:<authTag-b64>:<ciphertext-b64>`
 *
 * If APP_ENCRYPTION_KEY is absent the service refuses to encrypt rather than
 * silently storing plaintext.
 */
@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer | null;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('APP_ENCRYPTION_KEY');
    if (raw && raw.trim().length >= 32) {
      // Derive a fixed 32-byte key from the configured secret.
      this.key = createHash('sha256').update(raw, 'utf8').digest();
    } else {
      this.key = null;
      this.logger.warn(
        'APP_ENCRYPTION_KEY is not configured (or too short). Encrypted storage is disabled.',
      );
    }
  }

  get available(): boolean {
    return this.key !== null;
  }

  encrypt(plaintext: string): string {
    if (!this.key) {
      throw new Error('Encryption is not configured: set APP_ENCRYPTION_KEY (min 32 characters)');
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return ['v1', iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
  }

  decrypt(payload: string): string {
    if (!this.key) {
      throw new Error('Encryption is not configured: set APP_ENCRYPTION_KEY (min 32 characters)');
    }
    const [version, ivB64, tagB64, dataB64] = String(payload).split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
      throw new Error('Malformed ciphertext');
    }
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
  }

  /** True when the value looks like a payload produced by `encrypt`. */
  static isEncrypted(value: string): boolean {
    return /^v1:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(value ?? '');
  }
}
