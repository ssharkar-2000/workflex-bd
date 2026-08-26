import { Injectable, Logger } from '@nestjs/common';
import type { AnalysisStatus, DocumentKind } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ImageQualityService } from './image-quality.service';
import { OcrService } from './ocr.service';
import { FaceService } from './face.service';

interface CheckRecord {
  name: string;
  ok: boolean;
  ms: number;
  detail?: string;
}

/**
 * Runs the automated checks over one uploaded document and records the result.
 *
 * Kicked off after the upload response has already been sent. OCR and the face
 * models take seconds on CPU, and making an applicant stare at a spinner while
 * TensorFlow warms up is a good way to lose them at the last step.
 *
 * Nothing here approves anything. Every submission still reaches a human; the
 * checks only tell that human where to look, and tell the applicant
 * immediately when a photo is too blurred to be worth submitting.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  /** Serialises work: the WASM runtimes are single-threaded and CPU-bound. */
  private chain: Promise<void> = Promise.resolve();

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly quality: ImageQualityService,
    private readonly ocr: OcrService,
    private readonly face: FaceService,
  ) {}

  enqueue(documentId: string): void {
    this.chain = this.chain
      .then(() => this.run(documentId))
      .catch((err) => {
        this.logger.error({ err, documentId }, 'Analysis job failed');
      });
  }

  private async run(documentId: string): Promise<void> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document) return;

    await this.prisma.documentAnalysis.upsert({
      where: { documentId },
      create: { documentId, status: 'RUNNING' },
      update: { status: 'RUNNING' },
    });

    const checks: CheckRecord[] = [];
    const notes: string[] = [];
    const started = Date.now();

    try {
      const buffer = await this.storage.read(document.storageKey);
      const kind = document.kind;

      const isCard = kind === 'NID_FRONT' || kind === 'NID_BACK';
      const isSelfie = kind === 'SELFIE';

      let sharpness: number | null = null;
      let glare: number | null = null;
      let cardFound: boolean | null = null;
      let ocrText: string | null = null;
      let extractedNid: string | null = null;
      let extractedName: string | null = null;
      let extractedDob: string | null = null;
      let facesDetected: number | null = null;
      let faceMatch: number | null = null;

      // --- OpenCV quality pass on every image ---
      {
        const t0 = Date.now();
        const result = await this.quality.analyse(buffer);
        sharpness = result.sharpness;
        glare = result.glare;
        cardFound = isCard ? result.cardFound : null;
        notes.push(...result.notes);
        checks.push({
          name: 'opencv/quality',
          ok: result.available,
          ms: Date.now() - t0,
        });
      }

      // --- Tesseract, front of the NID only: the back carries no useful text ---
      if (kind === 'NID_FRONT') {
        const t0 = Date.now();
        const result = await this.ocr.read(buffer);
        ocrText = result.text;
        extractedNid = result.nid;
        extractedName = result.name;
        extractedDob = result.dob;
        notes.push(...result.notes);
        checks.push({
          name: 'tesseract/ocr',
          ok: result.available,
          ms: Date.now() - t0,
          detail: result.confidence ? `confidence ${result.confidence}` : undefined,
        });
      }

      // --- face detection, plus comparison against the card portrait ---
      if (isSelfie || kind === 'NID_FRONT') {
        const t0 = Date.now();
        const detection = await this.face.detect(buffer);
        facesDetected = detection.facesDetected;
        notes.push(...detection.notes);
        checks.push({
          name: `face/${detection.detector}`,
          ok: detection.available,
          ms: Date.now() - t0,
        });

        if (isSelfie && detection.descriptor) {
          const match = await this.compareWithNid(
            document.userId,
            detection.descriptor,
          );
          if (match) {
            faceMatch = match.distance;
            notes.push(
              match.verdict === 'match'
                ? 'Selfie matches the NID portrait'
                : match.verdict === 'review'
                  ? 'Selfie and NID portrait are borderline — check by eye'
                  : 'Selfie does not appear to match the NID portrait',
            );
            checks.push({
              name: 'face-api/compare',
              ok: match.verdict !== 'mismatch',
              ms: 0,
              detail: `distance ${match.distance}`,
            });
          }
        }
      }

      const status = this.verdict({
        checks,
        sharpness,
        glare,
        cardFound,
        facesDetected,
        faceMatch,
        isCard,
        isSelfie,
      });

      await this.prisma.documentAnalysis.update({
        where: { documentId },
        data: {
          status,
          checks: checks as never,
          sharpness,
          glare,
          cardFound,
          ocrText,
          extractedNid,
          extractedName,
          extractedDob,
          facesDetected,
          faceMatch,
          notes: notes.length > 0 ? notes.join(' · ') : null,
        },
      });

      this.logger.log(
        `Analysed ${document.kind} for ${document.userId}: ${status} (${Date.now() - started}ms)`,
      );
    } catch (err) {
      this.logger.error({ err, documentId }, 'Analysis failed');
      await this.prisma.documentAnalysis.update({
        where: { documentId },
        data: {
          status: 'FAILED',
          notes: 'Automated checks could not complete',
          checks: checks as never,
        },
      });
    }
  }

  /** Compares a selfie descriptor against the portrait on the stored NID front. */
  private async compareWithNid(userId: string, selfie: Float32Array) {
    const nidFront = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind: 'NID_FRONT' as DocumentKind } },
    });
    if (!nidFront) return null;

    const nidBuffer = await this.storage.read(nidFront.storageKey);
    const nidFace = await this.face.detect(nidBuffer);
    if (!nidFace.descriptor) return null;

    return await this.face.compare(selfie, nidFace.descriptor);
  }

  private verdict(input: {
    checks: CheckRecord[];
    sharpness: number | null;
    glare: number | null;
    cardFound: boolean | null;
    facesDetected: number | null;
    faceMatch: number | null;
    isCard: boolean;
    isSelfie: boolean;
  }): AnalysisStatus {
    // Nothing ran at all — usually missing model weights.
    if (input.checks.every((c) => !c.ok)) return 'SKIPPED';

    // Unreadable is a hard fail: no reviewer can work with it either.
    if (input.sharpness !== null && input.sharpness < 0.1) return 'FAILED';
    if (input.isSelfie && input.facesDetected === 0) return 'FAILED';

    if (input.faceMatch !== null && input.faceMatch > 0.72) return 'FAILED';
    if (input.faceMatch !== null && input.faceMatch > 0.6) return 'NEEDS_REVIEW';

    if (input.sharpness !== null && input.sharpness < 0.18) return 'NEEDS_REVIEW';
    if (input.glare !== null && input.glare > 0.12) return 'NEEDS_REVIEW';
    if (input.isCard && input.cardFound === false) return 'NEEDS_REVIEW';

    return 'PASSED';
  }
}
