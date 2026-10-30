import { appConfig } from '../../config/app.config';

export function makeValidJpegBuffer(): Buffer {
  // Starts with FF D8 FF E0, ends with FF D9
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9]);
}

export function makeCorruptedJpegBuffer(): Buffer {
  // Truncated JPEG cut in half: starts with FF D8 FF E0, missing FF D9 trailer
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

export function makeValidPngBuffer(): Buffer {
  // PNG signature (8 bytes) + chunk with IEND
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

export function makeValidWebpBuffer(): Buffer {
  // RIFF at 0..3, WEBP at 8..11
  const buf = Buffer.alloc(16);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(8, 4); // size
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8 ', 12, 'ascii');
  return buf;
}

export function makeValidPdfBuffer(pageCount = 1): Buffer {
  let pages = '';
  for (let i = 0; i < pageCount; i++) {
    pages += `/Type /Page\n`;
  }
  return Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${pages}%%EOF`);
}

export function makeCorruptedPdfBuffer(): Buffer {
  // PDF with trailer removed (missing %%EOF)
  return Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n/Type /Page');
}

export function makeExeBuffer(): Buffer {
  // Starts with 'MZ' (DOS/Windows executable header)
  return Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
}

export function makeFileAtSizeLimit(): Buffer {
  const buf = Buffer.alloc(appConfig.upload.maxFileBytes);
  // Give it valid JPEG markers so size check alone is tested
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[buf.length - 2] = 0xff;
  buf[buf.length - 1] = 0xd9;
  return buf;
}

export function makeFileOverSizeLimit(): Buffer {
  const buf = Buffer.alloc(appConfig.upload.maxFileBytes + 1);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[buf.length - 2] = 0xff;
  buf[buf.length - 1] = 0xd9;
  return buf;
}

