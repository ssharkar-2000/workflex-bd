import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import type { Env } from '../config/env.schema';

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
  sha256: string;
}

/**
 * Private file storage on local disk.
 *
 * These are NID cards, TIN certificates and selfies — the most sensitive data
 * the product handles. Nothing here is web-served: files live outside any
 * static route and are read back only through an authenticated controller, so
 * every access can be attributed.
 *
 * The same interface fronts S3/R2 later; only this class changes.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root: string;

  constructor(config: ConfigService<Env, true>) {
    this.root = resolve(config.get('STORAGE_DIR', { infer: true }));
  }

  /** Keyed by user so one person's documents cannot collide with another's. */
  buildKey(userId: string, kind: string, originalName?: string): string {
    const ext = originalName ? extname(originalName).slice(0, 10) : '.jpg';
    return join(userId, `${kind}-${randomUUID()}${ext || '.jpg'}`);
  }

  private absolute(storageKey: string): string {
    const full = resolve(this.root, storageKey);
    // Refuse anything that escapes the storage root: a crafted key such as
    // "../../.env" must never resolve outside it.
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async save(storageKey: string, data: Buffer): Promise<StoredFile> {
    const full = this.absolute(storageKey);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, data);

    return {
      storageKey,
      sizeBytes: data.byteLength,
      sha256: createHash('sha256').update(data).digest('hex'),
    };
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(this.absolute(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await rm(this.absolute(storageKey), { force: true });
    } catch (err) {
      // A missing file is not worth failing a replacement upload over.
      this.logger.warn({ err, storageKey }, 'Could not remove stored file');
    }
  }
}
