import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker } from 'tesseract.js';
import { toOcrInput } from './image.util';

export interface OcrResult {
  available: boolean;
  text: string | null;
  nid: string | null;
  name: string | null;
  dob: string | null;
  confidence: number | null;
  notes: string[];
}

/**
 * Bangladeshi NID numbers are 10, 13 or 17 digits. The 13 and 17 digit forms
 * embed the birth year, which is why they are matched before the short one.
 */
const NID_PATTERNS = [
  /\b(\d{17})\b/,
  /\b(\d{13})\b/,
  /\b(\d{10})\b/,
];

const NAME_LABELS = /(?:name|নাম)\s*[:\-]?\s*([A-Z][A-Za-z.\s]{2,40})/i;
const DOB_LABELS =
  /(?:date of birth|birth|জন্ম)\s*[:\-]?\s*(\d{1,2}\s*[a-zA-Z]{3,9}\s*\d{4}|\d{2}[-/]\d{2}[-/]\d{4})/i;

/**
 * Tesseract OCR over the NID.
 *
 * The extracted number is not treated as proof of anything — it is fed to the
 * reviewer alongside the image so they are comparing rather than transcribing,
 * and it lets us reject a card that has already been used on another account.
 */
@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private worker: Promise<Worker> | null = null;

  /**
   * One worker for the whole process, created on first use. Tesseract fetches
   * and caches its language data on that first run, so startup is not delayed
   * for a deployment that may never OCR anything.
   */
  private getWorker(): Promise<Worker> {
    this.worker ??= createWorker('eng').then((worker) => {
      this.logger.log('Tesseract worker ready');
      return worker;
    });
    return this.worker;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.worker) return;
    try {
      const worker = await this.worker;
      await worker.terminate();
    } catch {
      // Shutting down anyway.
    }
  }

  async read(buffer: Buffer): Promise<OcrResult> {
    const notes: string[] = [];

    try {
      const worker = await this.getWorker();
      const prepared = await toOcrInput(buffer);
      const { data } = await worker.recognize(prepared);

      const text = data.text ?? '';
      const compact = text.replace(/\s+/g, ' ').trim();

      const nid = this.extractNid(text);
      const name = NAME_LABELS.exec(compact)?.[1]?.trim() ?? null;
      const dob = DOB_LABELS.exec(compact)?.[1]?.trim() ?? null;

      if (!nid) notes.push('No NID number found in the text');
      if (data.confidence != null && data.confidence < 55) {
        notes.push('Low OCR confidence — text may be misread');
      }

      return {
        available: true,
        text: compact.slice(0, 4000),
        nid,
        name,
        dob,
        confidence: data.confidence ?? null,
        notes,
      };
    } catch (err) {
      // OCR is an assist. If it cannot run, the reviewer still has the image.
      this.logger.warn({ err }, 'OCR failed');
      return {
        available: false,
        text: null,
        nid: null,
        name: null,
        dob: null,
        confidence: null,
        notes: ['OCR unavailable'],
      };
    }
  }

  private extractNid(text: string): string | null {
    // Strip spaces the scanner often inserts between digit groups.
    const digitsOnly = text.replace(/(?<=\d)[ .-](?=\d)/g, '');
    for (const pattern of NID_PATTERNS) {
      const match = pattern.exec(digitsOnly);
      if (match?.[1]) return match[1];
    }
    return null;
  }
}
