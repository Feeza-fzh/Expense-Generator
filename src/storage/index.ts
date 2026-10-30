import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appConfig } from '../../config/app.config';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';

export interface StorageAdapter {
  uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  getFileBuffer(key: string): Promise<Buffer>;
  getSignedDownloadUrl(key: string, ttlSeconds?: number): Promise<string>;
  deleteFile(key: string): Promise<void>;
}

class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT || 'http://localhost:9000';
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || 'minioadmin';
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || 'minioadmin';
    this.bucket = process.env.R2_BUCKET || 'receipts-dev';

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO and R2 compatibility
    });
  }

  async uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      });
      await this.client.send(command);
    } catch (err) {
      logger.error('Failed to upload file to object storage', {
        key,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new AppError('INTERNAL_ERROR', 500);
    }
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      const response = await this.client.send(command);
      if (!response.Body) {
        throw new Error('Empty response body from storage');
      }
      const byteArray = await response.Body.transformToByteArray();
      return Buffer.from(byteArray);
    } catch (err) {
      logger.error('Failed to get file from object storage', {
        key,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new AppError('INTERNAL_ERROR', 500);
    }
  }

  async getSignedDownloadUrl(
    key: string,
    ttlSeconds = appConfig.storage.signedUrlTtlSeconds
  ): Promise<string> {
    // N-21: Signed URLs expiring in 5 minutes, never longer
    const effectiveTtl = Math.min(ttlSeconds, 300);
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      return await getSignedUrl(this.client, command, { expiresIn: effectiveTtl });
    } catch (err) {
      logger.error('Failed to create signed URL', {
        key,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new AppError('INTERNAL_ERROR', 500);
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
    } catch (err) {
      logger.error('Failed to delete file from object storage', {
        key,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new AppError('INTERNAL_ERROR', 500);
    }
  }
}

// In-memory mock storage adapter for tests (N-34)
export class MockStorageAdapter implements StorageAdapter {
  private files = new Map<string, { buffer: Buffer; contentType: string }>();

  async uploadFile(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
    this.files.set(key, { buffer: Buffer.from(body), contentType });
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const item = this.files.get(key);
    if (!item) {
      throw new AppError('INTERNAL_ERROR', 500);
    }
    return item.buffer;
  }

  async getSignedDownloadUrl(key: string, _ttlSeconds = 300): Promise<string> {
    if (!this.files.has(key)) {
      throw new AppError('INTERNAL_ERROR', 500);
    }
    return `https://storage.local/signed/${encodeURIComponent(key)}?expires=300`;
  }

  async deleteFile(key: string): Promise<void> {
    this.files.delete(key);
  }

  clear(): void {
    this.files.clear();
  }
}

let activeStorage: StorageAdapter =
  process.env.NODE_ENV === 'test' ? new MockStorageAdapter() : new S3StorageAdapter();

export function getStorage(): StorageAdapter {
  return activeStorage;
}

export function setStorageForTest(adapter: StorageAdapter): void {
  activeStorage = adapter;
}

export function buildStorageKey(
  userId: string,
  batchId: string,
  receiptId: string,
  extension: string
): string {
  // Pattern: receipts/{userId}/{batchId}/{receiptId}.{ext} (TR-5)
  const cleanExt = extension.replace(/^\./, '');
  return `receipts/${userId}/${batchId}/${receiptId}.${cleanExt}`;
}

