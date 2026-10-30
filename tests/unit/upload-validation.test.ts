import { describe, it, expect } from 'vitest';
import { validateReceiptFile } from '@/lib/file-validator';
import {
  makeValidJpegBuffer,
  makeCorruptedJpegBuffer,
  makeValidPngBuffer,
  makeValidWebpBuffer,
  makeValidPdfBuffer,
  makeCorruptedPdfBuffer,
  makeExeBuffer,
  makeFileAtSizeLimit,
  makeFileOverSizeLimit,
} from '../fixtures/buffers';

describe('Upload Validation (TR-6, TR-16, FR-1, FR-2, FR-3)', () => {
  it('rejects 0-byte file with EMPTY_FILE', () => {
    const emptyBuf = Buffer.alloc(0);
    const result = validateReceiptFile(emptyBuf);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('EMPTY_FILE');
  });

  it('rejects corrupted JPEG (cut in half) with UNREADABLE_FILE', () => {
    const corruptedJpeg = makeCorruptedJpegBuffer();
    const result = validateReceiptFile(corruptedJpeg);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('UNREADABLE_FILE');
  });

  it('rejects corrupted PDF (trailer removed) with UNREADABLE_FILE', () => {
    const corruptedPdf = makeCorruptedPdfBuffer();
    const result = validateReceiptFile(corruptedPdf);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('UNREADABLE_FILE');
  });

  it('accepts file exactly at 10 MB limit (10,485,760 bytes)', () => {
    const atLimit = makeFileAtSizeLimit();
    const result = validateReceiptFile(atLimit);
    expect(result.valid).toBe(true);
    expect(result.sizeBytes).toBe(10485760);
  });

  it('rejects file 1 byte over 10 MB limit (10,485,761 bytes) with FILE_TOO_LARGE', () => {
    const overLimit = makeFileOverSizeLimit();
    const result = validateReceiptFile(overLimit);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('FILE_TOO_LARGE');
  });

  it('rejects unsupported file type (.exe magic bytes) with UNSUPPORTED_TYPE', () => {
    const exeBuf = makeExeBuffer();
    const result = validateReceiptFile(exeBuf);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('UNSUPPORTED_TYPE');
  });

  it('accepts valid JPEG, PNG, WebP, and PDF', () => {
    expect(validateReceiptFile(makeValidJpegBuffer()).valid).toBe(true);
    expect(validateReceiptFile(makeValidPngBuffer()).valid).toBe(true);
    expect(validateReceiptFile(makeValidWebpBuffer()).valid).toBe(true);
    expect(validateReceiptFile(makeValidPdfBuffer(1)).valid).toBe(true);
  });

  it('rejects PDF with more than 5 pages (e.g. 6 pages) with FILE_TOO_LARGE', () => {
    const sixPages = makeValidPdfBuffer(6);
    const result = validateReceiptFile(sixPages);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('FILE_TOO_LARGE');
    expect(result.pageCount).toBe(6);
  });
});

