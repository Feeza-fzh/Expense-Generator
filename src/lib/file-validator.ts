import crypto from 'crypto';
import { appConfig } from '../../config/app.config';
import { ReceiptErrorCode } from './errors';

export interface FileValidationResult {
  valid: boolean;
  errorCode?: ReceiptErrorCode;
  mimeType?: string;
  sizeBytes?: number;
  pageCount?: number;
  fileSha256?: string;
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validates a file according to TR-6 and FR-1, FR-2, FR-3.
 * Server-side checks: magic bytes, size, emptiness, image header, PDF pages and structure.
 */
export function validateReceiptFile(buffer: Buffer): FileValidationResult {
  const sizeBytes = buffer.length;

  // 1. Check EMPTY_FILE (FR-3)
  if (sizeBytes === 0) {
    return { valid: false, errorCode: 'EMPTY_FILE', sizeBytes: 0 };
  }

  // 2. Check FILE_TOO_LARGE (FR-2: 10,485,760 bytes)
  if (sizeBytes > appConfig.upload.maxFileBytes) {
    return { valid: false, errorCode: 'FILE_TOO_LARGE', sizeBytes };
  }

  // 3. Check magic bytes (FR-1, TR-6)
  // JPEG: FF D8 FF
  // PNG: 89 50 4E 47
  // WebP: RIFF at 0..3, WEBP at 8..11
  // PDF: %PDF-
  let detectedType: 'jpeg' | 'png' | 'webp' | 'pdf' | null = null;
  let mimeType: string | null = null;

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedType = 'jpeg';
    mimeType = 'image/jpeg';
  } else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedType = 'png';
    mimeType = 'image/png';
  } else if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    detectedType = 'webp';
    mimeType = 'image/webp';
  } else if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') {
    detectedType = 'pdf';
    mimeType = 'application/pdf';
  }

  if (!detectedType || !mimeType) {
    return { valid: false, errorCode: 'UNSUPPORTED_TYPE', sizeBytes };
  }

  // 4. File integrity & structure checks (FR-3, TR-6)
  if (detectedType === 'jpeg') {
    // Check for corrupted / truncated JPEG (e.g. cut in half, missing EOI marker FF D9)
    // A valid JPEG ends with FF D9 (allowing trailing whitespace/zeroes)
    let hasEoi = false;
    for (let i = buffer.length - 1; i >= Math.max(0, buffer.length - 100); i--) {
      if (buffer[i - 1] === 0xff && buffer[i] === 0xd9) {
        hasEoi = true;
        break;
      }
    }
    if (!hasEoi) {
      return { valid: false, errorCode: 'UNREADABLE_FILE', sizeBytes, mimeType };
    }
  } else if (detectedType === 'png') {
    // Valid PNG must contain IEND chunk: 49 45 4E 44
    const iendIndex = buffer.indexOf(Buffer.from([0x49, 0x45, 0x4e, 0x44]));
    if (iendIndex === -1) {
      return { valid: false, errorCode: 'UNREADABLE_FILE', sizeBytes, mimeType };
    }
  } else if (detectedType === 'pdf') {
    // Must contain %%EOF
    const contentStr = buffer.toString('latin1');
    if (!contentStr.includes('%%EOF')) {
      return { valid: false, errorCode: 'UNREADABLE_FILE', sizeBytes, mimeType };
    }

    // Count pages in PDF
    const pageCount = countPdfPages(contentStr);
    if (pageCount === 0) {
      return { valid: false, errorCode: 'UNREADABLE_FILE', sizeBytes, mimeType };
    }

    if (pageCount > appConfig.upload.maxPdfPages) {
      return {
        valid: false,
        errorCode: 'FILE_TOO_LARGE',
        sizeBytes,
        pageCount,
        mimeType,
      };
    }

    const sha256 = computeSha256(buffer);
    return {
      valid: true,
      mimeType,
      sizeBytes,
      pageCount,
      fileSha256: sha256,
    };
  }

  const sha256 = computeSha256(buffer);
  return {
    valid: true,
    mimeType,
    sizeBytes,
    pageCount: 1,
    fileSha256: sha256,
  };
}

/**
 * Counts PDF pages by inspecting /Type /Page objects in the PDF text.
 */
function countPdfPages(pdfStr: string): number {
  // First attempt: check for /Count in the /Pages root object
  const countMatches = [...pdfStr.matchAll(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/g)];
  if (countMatches.length > 0) {
    let maxCount = 0;
    for (const match of countMatches) {
      const num = parseInt(match[1] ?? '0', 10);
      if (num > maxCount) maxCount = num;
    }
    if (maxCount > 0) return maxCount;
  }

  // Second attempt: count /Type /Page (excluding /Type /Pages)
  const pageMatches = pdfStr.match(/\/Type\s*\/Page\b(?!\s*s)/g);
  return pageMatches ? pageMatches.length : 1;
}

