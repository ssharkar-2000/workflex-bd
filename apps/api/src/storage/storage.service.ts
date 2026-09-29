import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, posix, resolve, sep } from 'node:path';
import type { Env } from '../config/env.schema';

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
}

/**
 * Private file storage: local disk in development, object storage in
 * production.
 *
 * These are NID cards, TIN certificates, selfies, CVs and intro videos — the
 * most sensitive data the product handles. Nothing here is web-served in
 * either mode: files are read back only through an authenticated controller,
 * so every access can be attributed, and the bucket is never public.
 *
 * Which backend is used is decided once, at boot, from the environment. When
 * S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY are all set, uploads go to the
 * bucket; otherwise to STORAGE_DIR. Production refuses the second unless the
 * directory is declared persistent — see validateEnv — because a container's
 * own disk is wiped on every deploy, and losing everybody's documents on the
 * next push is not a failure anyone would notice until it had happened.
 *
 * Every caller uses save, read and remove and nothing else, so the choice of
 * backend is invisible to the rest of the API.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;
  private readonly s3: S3Client | null;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(config.get('STORAGE_DIR', { infer: true }));
    this.bucket = config.get('S3_BUCKET_DOCUMENTS', { infer: true });

    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    const accessKeyId = config.get('S3_ACCESS_KEY', { infer: true });
    const secretAccessKey = config.get('S3_SECRET_KEY', { infer: true });

    // Disk by default outside production, even with S3 variables present —
    // see STORAGE_DRIVER in env.schema.ts for why.
    const driver =
      config.get('STORAGE_DRIVER', { infer: true }) ??
      (config.get('NODE_ENV', { infer: true }) === 'production' ? 's3' : 'disk');

    this.s3 =
      driver === 's3' && endpoint && accessKeyId && secretAccessKey
        ? new S3Client({
            endpoint,
            region: config.get('S3_REGION', { infer: true }),
            credentials: { accessKeyId, secretAccessKey },
            // Path-style addressing: required by MinIO and some regional
            // providers, and accepted by R2 and S3, so one setting works for
            // every store this might be pointed at.
            forcePathStyle: true,
          })
        : null;

    this.logger.log(
      this.s3
        ? `Storing uploads in bucket "${this.bucket}"`
        : `Storing uploads on disk at ${this.root}`,
    );
  }

  /**
   * Keyed by user so one person's documents cannot collide with another's.
   *
   * Always forward slashes. The first version used the platform's own join,
   * which on a Windows development machine writes "userId\cv-….pdf" into the
   * database — a key that works on that disk and nowhere else, and that an
   * object store would treat as a single oddly-named file.
   */
  buildKey(userId: string, kind: string, originalName?: string): string {
    const ext = originalName ? extname(originalName).slice(0, 10) : '.jpg';
    return posix.join(userId, `${kind}-${randomUUID()}${ext || '.jpg'}`);
  }

  async save(storageKey: string, data: Buffer): Promise<StoredFile> {
    if (this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.objectKey(storageKey),
          Body: data,
          ContentLength: data.byteLength,
        }),
      );
    } else {
      const full = this.absolute(storageKey);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, data);
    }

    return {
      storageKey,
      sizeBytes: data.byteLength,
      sha256: createHash('sha256').update(data).digest('hex'),
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    if (this.s3) {
      const out = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storageKey) }),
      );
      if (!out.Body) throw new Error('Stored file has no body');
      return Buffer.from(await out.Body.transformToByteArray());
    }
    return readFile(this.absolute(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    try {
      if (this.s3) {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: this.bucket, Key: this.objectKey(storageKey) }),
        );
      } else {
        await rm(this.absolute(storageKey), { force: true });
      }
    } catch (err) {
      // A missing file is not worth failing a replacement upload over.
      this.logger.warn({ err, storageKey }, 'Could not remove stored file');
    }
  }

  // --- key safety, one rule per backend ---

  private absolute(storageKey: string): string {
    const full = resolve(this.root, storageKey);
    // Refuse anything that escapes the storage root: a crafted key such as
    // "../../.env" must never resolve outside it.
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  /**
   * The same guarantee for the bucket.
   *
   * Keys are generated here and never taken from a request, but a key that
   * climbs out of its prefix is refused anyway: the rule costs nothing, and
   * the day somebody wires a key through from user input it is already in
   * place. Legacy keys written on Windows are normalised to forward slashes
   * so they map to the same object on every machine.
   */
  private objectKey(storageKey: string): string {
    const key = storageKey.replace(/\\/g, '/');
    if (key.startsWith('/') || key.split('/').some((part) => part === '..' || part === '')) {
      throw new Error('Invalid storage key');
    }
    return key;
  }
}
