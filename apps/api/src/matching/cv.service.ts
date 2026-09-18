import { Injectable, Logger } from '@nestjs/common';
import type { JobCategory } from '@prisma/client';
import type { CvStatus } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { PDFParse } from 'pdf-parse';
import { OcrService } from '../verification/ocr.service';
import { CvParserService } from './cv-parser.service';
import { extractFromKeywords } from './cv-keywords';

/**
 * Storing a CV, reading it, and keeping the parsed profile in step with it.
 *
 * Text extraction is split by file type because the two cases have nothing in
 * common: a PDF carries its text and only needs unpacking, while a photograph
 * of a printed CV — which is what most people in this market will upload from
 * a phone — needs the OCR the NID pipeline already runs.
 */
@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ocr: OcrService,
    private readonly parser: CvParserService,
  ) {}

  async status(userId: string): Promise<CvStatus> {
    const [doc, profile] = await Promise.all([
      this.prisma.document.findUnique({
        where: { userId_kind: { userId, kind: 'CV' } },
        select: { id: true },
      }),
      this.prisma.cvProfile.findUnique({ where: { userId } }),
    ]);

    return {
      hasCv: doc !== null,
      parsingEnabled: this.parser.enabled,
      profile: profile
        ? {
            skills: profile.skills,
            yearsExperience: profile.yearsExperience,
            categories: profile.categories,
            titles: profile.titles,
            summary: profile.summary,
            parsedAt: profile.parsedAt.toISOString(),
          }
        : null,
    };
  }

  private async extractText(
    buffer: Buffer,
    mimeType: string,
  ): Promise<string | null> {
    if (mimeType === 'application/pdf') {
      let parser: PDFParse | null = null;
      try {
        parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        return result.text;
      } catch (err) {
        this.logger.warn(
          `PDF text extraction failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return null;
      } finally {
        // pdf.js holds a worker per document; without this a few uploads
        // leak one each and the process slowly grows.
        await parser?.destroy().catch(() => undefined);
      }
    }

    // A photo of a CV. The same Tesseract worker the NID pipeline uses.
    const result = await this.ocr.read(buffer);
    return result.text;
  }

  /**
   * Reads whatever was uploaded and replaces the stored profile.
   *
   * Failure here is never fatal to the upload: the document is already saved,
   * and a profile that could not be extracted is better recorded as absent
   * than as empty — an empty profile would score every job as a poor fit.
   */
  async parseStoredCv(userId: string): Promise<CvStatus> {
    const doc = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind: 'CV' } },
    });
    if (!doc) return this.status(userId);

    const buffer = await this.storage.read(doc.storageKey);
    const text = await this.extractText(buffer, doc.mimeType);

    if (!text || text.trim().length < 40) {
      this.logger.warn(`No usable text in CV for user ${userId}`);
      return this.status(userId);
    }

    // The model first, keywords if it could not answer. Falling back keeps a
    // CV useful when the provider is unreachable or unfunded, which otherwise
    // left the whole feature — profile, match scores, recommendations — dead
    // from an upload that had worked perfectly.
    const modelled = await this.parser.parse(text);
    const extracted = modelled ?? extractFromKeywords(text);

    if (!extracted) return this.status(userId);

    if (!modelled) {
      this.logger.warn(
        `CV for ${userId} read by keyword match, not by model — ` +
          `${extracted.skills.length} roles recognised`,
      );
    }

    await this.prisma.cvProfile.upsert({
      where: { userId },
      create: {
        userId,
        documentId: doc.id,
        skills: extracted.skills,
        yearsExperience: extracted.yearsExperience,
        categories: extracted.categories as JobCategory[],
        titles: extracted.titles,
        summary: extracted.summary,
        rawText: text.slice(0, 40_000),
        parsedAt: new Date(),
      },
      update: {
        documentId: doc.id,
        skills: extracted.skills,
        yearsExperience: extracted.yearsExperience,
        categories: extracted.categories as JobCategory[],
        titles: extracted.titles,
        summary: extracted.summary,
        rawText: text.slice(0, 40_000),
        parsedAt: new Date(),
      },
    });

    this.logger.log(
      `Parsed CV for ${userId}: ${extracted.skills.length} skills, ` +
        `${extracted.categories.length} categories`,
    );
    return this.status(userId);
  }

  /** Removes both the profile and the file — one without the other is a lie. */
  async remove(userId: string): Promise<CvStatus> {
    const doc = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind: 'CV' } },
    });

    await this.prisma.cvProfile.deleteMany({ where: { userId } });

    if (doc) {
      await this.prisma.document.delete({ where: { id: doc.id } });
      await this.storage.remove(doc.storageKey).catch(() => undefined);
    }

    return this.status(userId);
  }
}
