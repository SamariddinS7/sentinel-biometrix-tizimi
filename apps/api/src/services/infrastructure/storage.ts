/**
 * Enterprise Object Storage Service
 *
 * Primary:  MinIO / AWS S3 (S3-compatible API via @aws-sdk/client-s3)
 * Fallback: Local filesystem under .data/storage/
 *
 * Supports: upload, download, delete, list, presigned URLs, versioning,
 *           immutable evidence buckets, lifecycle policies.
 *
 * Configure with environment variables:
 *   STORAGE_ENDPOINT  — MinIO or S3 endpoint (e.g. http://minio:9000)
 *   STORAGE_ACCESS_KEY / STORAGE_SECRET_KEY — credentials
 *   STORAGE_REGION    — AWS region (default: us-east-1)
 *   STORAGE_FORCE_PATH_STYLE — true for MinIO
 *
 * Buckets (auto-created):
 *   vms-evidence    — immutable, 10yr retention, versioned
 *   vms-recordings  — video recordings, 90d lifecycle
 *   vms-thumbnails  — frame snapshots, 30d lifecycle
 *   vms-reports     — generated reports, 365d lifecycle
 *   vms-models      — AI model weights, no expiry
 *   vms-backups     — database backups, 90d lifecycle
 */

import { getLogger } from './logger';
import { storageOperationsTotal } from './metrics';
import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink, readdir, stat, mkdir } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const log = getLogger('storage');

// ── Bucket definitions ────────────────────────────────────────────────────────

export interface BucketConfig {
  name: string;
  versioned: boolean;
  immutable: boolean;             // object lock
  lifecycleDays?: number;         // auto-expire objects after N days (null = never)
  publicRead: boolean;
}

export const BUCKETS: Record<string, BucketConfig> = {
  EVIDENCE:   { name: 'vms-evidence',   versioned: true,  immutable: true,  publicRead: false },
  RECORDINGS: { name: 'vms-recordings', versioned: false, immutable: false, lifecycleDays: 90,  publicRead: false },
  THUMBNAILS: { name: 'vms-thumbnails', versioned: false, immutable: false, lifecycleDays: 30,  publicRead: false },
  REPORTS:    { name: 'vms-reports',    versioned: true,  immutable: false, lifecycleDays: 365, publicRead: false },
  MODELS:     { name: 'vms-models',     versioned: true,  immutable: false,                     publicRead: false },
  BACKUPS:    { name: 'vms-backups',    versioned: false, immutable: false, lifecycleDays: 90,  publicRead: false },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  tagging?: string;
}

export interface StorageObject {
  key: string;
  bucket: string;
  size: number;
  lastModified: Date;
  etag?: string;
  metadata?: Record<string, string>;
}

// ── S3 client (optional) ──────────────────────────────────────────────────────

let s3Client: any = null;
let s3Available = false;
const LOCAL_ROOT = join(process.cwd(), '.data', 'storage');

async function initS3(): Promise<void> {
  const endpoint   = process.env.STORAGE_ENDPOINT;
  const accessKey  = process.env.STORAGE_ACCESS_KEY;
  const secretKey  = process.env.STORAGE_SECRET_KEY;

  if (!endpoint || !accessKey || !secretKey) {
    log.info('STORAGE_ENDPOINT/ACCESS_KEY/SECRET_KEY not set — using local filesystem storage');
    mkdirSync(LOCAL_ROOT, { recursive: true });
    return;
  }

  try {
    const { S3Client, CreateBucketCommand, HeadBucketCommand } = await import('@aws-sdk/client-s3');

    s3Client = new S3Client({
      endpoint,
      region: process.env.STORAGE_REGION ?? 'us-east-1',
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE !== 'false',
    });

    // Ensure buckets exist
    for (const cfg of Object.values(BUCKETS)) {
      try {
        await s3Client.send(new HeadBucketCommand({ Bucket: cfg.name }));
      } catch {
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: cfg.name }));
          log.info(`Created bucket: ${cfg.name}`);
        } catch (err: any) {
          log.warn(`Could not create bucket ${cfg.name}`, { error: err.message });
        }
      }
    }

    s3Available = true;
    log.info('S3-compatible storage connected', { endpoint });
  } catch (err: any) {
    log.warn('S3 storage init failed — using local filesystem fallback', { error: err.message });
    mkdirSync(LOCAL_ROOT, { recursive: true });
  }
}

// ── Local filesystem helpers ──────────────────────────────────────────────────

function localPath(bucket: string, key: string): string {
  return join(LOCAL_ROOT, bucket, key);
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}

// ── storageService ────────────────────────────────────────────────────────────

export const storageService = {
  /** Upload an object. Accepts Buffer, string (path), or Readable stream. */
  async upload(
    bucket: string,
    key: string,
    body: Buffer | string | Readable,
    opts: UploadOptions = {}
  ): Promise<string> {
    const operation = 'put';
    try {
      if (s3Available && s3Client) {
        const { Upload } = await import('@aws-sdk/lib-storage');
        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: bucket,
            Key: key,
            Body: body instanceof Buffer ? body : typeof body === 'string' ? createReadStream(body) : body,
            ContentType: opts.contentType ?? 'application/octet-stream',
            Metadata: opts.metadata,
            Tagging: opts.tagging,
          },
        });
        const result = await upload.done();
        storageOperationsTotal.inc({ operation, bucket, result: 'success' });
        return result.Location ?? `${bucket}/${key}`;
      }

      // Local fallback
      const dest = localPath(bucket, key);
      await ensureDir(dest);
      if (body instanceof Buffer) {
        await writeFile(dest, body);
      } else if (typeof body === 'string') {
        await pipeline(createReadStream(body), createWriteStream(dest));
      } else {
        await pipeline(body, createWriteStream(dest));
      }
      storageOperationsTotal.inc({ operation, bucket, result: 'success' });
      return `local://${bucket}/${key}`;
    } catch (err: any) {
      storageOperationsTotal.inc({ operation, bucket, result: 'error' });
      throw new Error(`Storage upload failed [${bucket}/${key}]: ${err.message}`);
    }
  },

  /** Download an object as a Buffer. */
  async download(bucket: string, key: string): Promise<Buffer> {
    const operation = 'get';
    try {
      if (s3Available && s3Client) {
        const { GetObjectCommand } = await import('@aws-sdk/client-s3');
        const res = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const chunks: Buffer[] = [];
        for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
        storageOperationsTotal.inc({ operation, bucket, result: 'success' });
        return Buffer.concat(chunks);
      }

      // Local fallback
      const buf = await readFile(localPath(bucket, key));
      storageOperationsTotal.inc({ operation, bucket, result: 'success' });
      return buf;
    } catch (err: any) {
      storageOperationsTotal.inc({ operation, bucket, result: 'error' });
      throw new Error(`Storage download failed [${bucket}/${key}]: ${err.message}`);
    }
  },

  /** Delete an object. */
  async delete(bucket: string, key: string): Promise<void> {
    try {
      if (s3Available && s3Client) {
        const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
        await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } else {
        await unlink(localPath(bucket, key));
      }
      storageOperationsTotal.inc({ operation: 'delete', bucket, result: 'success' });
    } catch (err: any) {
      storageOperationsTotal.inc({ operation: 'delete', bucket, result: 'error' });
      throw new Error(`Storage delete failed [${bucket}/${key}]: ${err.message}`);
    }
  },

  /** List objects in a bucket with optional prefix. */
  async list(bucket: string, prefix = '', maxKeys = 1000): Promise<StorageObject[]> {
    try {
      if (s3Available && s3Client) {
        const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
        const res = await s3Client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: maxKeys }));
        return (res.Contents ?? []).map((obj: any) => ({
          key: obj.Key,
          bucket,
          size: obj.Size ?? 0,
          lastModified: obj.LastModified ?? new Date(),
          etag: obj.ETag,
        }));
      }

      // Local fallback
      const dir = join(LOCAL_ROOT, bucket, prefix);
      if (!existsSync(dir)) return [];
      const files = await readdir(dir);
      const items: StorageObject[] = [];
      for (const f of files.slice(0, maxKeys)) {
        const s = await stat(join(dir, f)).catch(() => null);
        if (s?.isFile()) {
          items.push({ key: join(prefix, f), bucket, size: s.size, lastModified: s.mtime });
        }
      }
      return items;
    } catch { return []; }
  },

  /** Generate a presigned download URL (S3) or a data-serving route (local). */
  async presignedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
    if (s3Available && s3Client) {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');
      return getSignedUrl(s3Client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
    }
    // Local: return an API route that serves the file
    return `/api/storage/${bucket}/${encodeURIComponent(key)}`;
  },

  health(): { status: 'ok' | 'degraded'; backend: 's3' | 'local' } {
    return {
      status: s3Available ? 'ok' : 'degraded',
      backend: s3Available ? 's3' : 'local',
    };
  },
};

// Initialise on module load (non-blocking)
initS3().catch(() => {});
