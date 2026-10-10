import { BadRequestException } from '@nestjs/common';

/**
 * Content-based upload validation.
 *
 * The browser-supplied `Content-Type` and filename extension are attacker
 * controlled, so a claim of "application/pdf" is not evidence. These helpers
 * inspect the actual bytes instead.
 */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const MIN_UPLOAD_BYTES = 64;

/** Every valid PDF starts with `%PDF-` (25 50 44 46 2D). */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]);

/**
 * Active content that must never be accepted, even inside a file that starts
 * with a valid PDF header (polyglot / embedded-script attacks).
 */
const FORBIDDEN_MARKERS = [
  '/JavaScript',
  '/JS',
  '/Launch',
  '/EmbeddedFile',
  '/OpenAction',
  '/AA',
  '/RichMedia',
  '/XFA',
];

export type UploadLike = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

export type ValidatedUpload = {
  originalname: string;
  mimetype: 'application/pdf';
  size: number;
  buffer: Buffer;
};

/** Strips directory components and control characters from a filename. */
export function sanitizeFileName(name: string | undefined): string {
  const base = (name ?? 'upload.pdf').split(/[\\/]/).pop() ?? 'upload.pdf';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^\w.\- ()]/g, '_');
  return cleaned.slice(0, 180) || 'upload.pdf';
}

/**
 * Validates an uploaded file and returns the normalised, safe descriptor.
 * Throws BadRequestException with a specific reason when anything is off.
 */
export function validatePdfUpload(file: UploadLike | undefined): ValidatedUpload {
  if (!file) {
    throw new BadRequestException('No file was uploaded');
  }

  const buffer = file.buffer;
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new BadRequestException('Uploaded file could not be read');
  }

  const size = buffer.length;

  if (size < MIN_UPLOAD_BYTES) {
    throw new BadRequestException('File is too small to be a valid PDF');
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw new BadRequestException(`File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB limit`);
  }
  if (typeof file.size === 'number' && file.size !== size) {
    throw new BadRequestException('Uploaded file size does not match its contents');
  }

  // 1. Magic bytes — the real content type.
  if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
    throw new BadRequestException('File is not a valid PDF (missing %PDF- header)');
  }

  // 2. Trailer marker, to catch truncated or padded files.
  if (buffer.lastIndexOf('%%EOF') === -1) {
    throw new BadRequestException('File is not a valid PDF (missing %%EOF trailer)');
  }

  // 3. Reject embedded active content.
  const head = buffer.toString('latin1');
  for (const marker of FORBIDDEN_MARKERS) {
    if (head.includes(marker)) {
      throw new BadRequestException(
        `PDF contains unsupported active content (${marker}) and was rejected for security reasons`,
      );
    }
  }

  return {
    originalname: sanitizeFileName(file.originalname),
    mimetype: 'application/pdf',
    size,
    buffer,
  };
}
