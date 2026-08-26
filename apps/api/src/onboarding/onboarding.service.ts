import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AccountType, DocumentKind } from '@prisma/client';
import {
  ApiErrorCode,
  requiredDocuments,
  type Locale,
  type OnboardingProfileDto,
  type OnboardingStatus,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { StorageService } from '../storage/storage.service';
import { AnalysisService } from '../verification/analysis.service';
import { EmailVerificationService } from '../users/email-verification.service';
import { PasswordService } from '../users/password.service';
import type { Env } from '../config/env.schema';

/** Only still images. Anything else is either a mistake or an attack. */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
]);

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly analysis: AnalysisService,
    private readonly emails: EmailVerificationService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async getStatus(
    userId: string,
    warnings: string[] = [],
  ): Promise<OnboardingStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { company: true, documents: { include: { analysis: true } } },
    });

    const submission = await this.prisma.kycSubmission.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const needed = user.accountType
      ? requiredDocuments(user.accountType)
      : [];
    const have = new Set(user.documents.map((d) => d.kind as string));

    return {
      accountType: user.accountType,
      firstName: user.firstName,
      lastName: user.lastName,
      address: user.address,
      companyName: user.company?.name ?? null,
      companyRegistrationNumber: user.company?.registrationNumber ?? null,
      designation: user.designation,
      email: user.email,
      emailVerified: user.emailVerifiedAt !== null,
      documents: user.documents.map((d) => ({
        kind: d.kind,
        uploadedAt: d.createdAt.toISOString(),
        sizeBytes: d.sizeBytes,
        analysis: d.analysis
          ? {
              status: d.analysis.status,
              sharpness: d.analysis.sharpness,
              glare: d.analysis.glare,
              cardFound: d.analysis.cardFound,
              facesDetected: d.analysis.facesDetected,
              faceMatch: d.analysis.faceMatch,
              extractedNid: d.analysis.extractedNid,
              extractedName: d.analysis.extractedName,
              extractedDob: d.analysis.extractedDob,
              notes: d.analysis.notes,
            }
          : null,
      })),
      missingDocuments: needed.filter((k) => !have.has(k)),
      warnings,
      profileComplete: this.isProfileComplete(user),
      submitted: user.onboardingSubmittedAt !== null,
      kycStatus: submission?.status ?? 'NOT_STARTED',
      rejectReason: submission?.rejectReason ?? null,
    };
  }

  private isProfileComplete(user: {
    accountType: AccountType | null;
    firstName: string | null;
    lastName: string | null;
    address: string | null;
    company: { name: string } | null;
  }): boolean {
    if (!user.accountType || !user.firstName || !user.lastName || !user.address)
      return false;
    if (user.accountType === 'COMPANY' && !user.company?.name) return false;
    return true;
  }

  async saveProfile(
    userId: string,
    dto: OnboardingProfileDto,
    locale: Locale,
  ): Promise<OnboardingStatus> {
    await this.assertNotSubmitted(userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        accountType: dto.accountType,
        firstName: dto.firstName,
        lastName: dto.lastName,
        address: dto.address,
        designation: dto.accountType === 'COMPANY' ? dto.designation : null,
        // Only job seekers are asked; a company account has no answer to store.
        experienceType:
          dto.accountType === 'INDIVIDUAL' ? dto.experienceType : null,
        // Only the hash is ever persisted; the plaintext leaves scope here.
        passwordHash: await this.passwords.hash(dto.password),
      },
    });

    if (dto.accountType === 'COMPANY') {
      await this.prisma.company.upsert({
        where: { ownerId: userId },
        create: {
          ownerId: userId,
          name: dto.companyName,
          registrationNumber: dto.companyRegistrationNumber,
          tin: dto.tin || null,
          tradeLicenseNo: dto.tradeLicenseNo || null,
        },
        update: {
          name: dto.companyName,
          registrationNumber: dto.companyRegistrationNumber,
          tin: dto.tin || null,
          tradeLicenseNo: dto.tradeLicenseNo || null,
        },
      });
    }

    // Email stays optional: supplying one starts a verification, omitting one
    // changes nothing and never blocks registration.
    const warnings: string[] = [];

    if (dto.email) {
      const current = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      if (current.email !== dto.email || !current.emailVerifiedAt) {
        try {
          await this.emails.request(userId, dto.email, locale);
        } catch (err) {
          // A mail outage must not fail the whole registration step — but
          // silently dropping it leaves the applicant waiting for a code that
          // is never coming, so it is reported back as a warning.
          this.logger.warn({ err }, 'Could not start email verification');
          warnings.push(
            'We could not send the verification email. You can add it later from your profile.',
          );
        }
      }
    }

    return this.getStatus(userId, warnings);
  }

  async uploadDocument(
    userId: string,
    kind: DocumentKind,
    file: { buffer: Buffer; mimetype: string; originalname?: string },
  ): Promise<OnboardingStatus> {
    await this.assertNotSubmitted(userId);

    if (!ALLOWED_MIME.has(file.mimetype.toLowerCase())) {
      throw new AppException(
        ApiErrorCode.UPLOAD_INVALID_TYPE,
        'Upload a photo (JPEG, PNG, WEBP or HEIC).',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    const max = this.config.get('MAX_UPLOAD_BYTES', { infer: true });
    if (file.buffer.byteLength > max) {
      throw new AppException(
        ApiErrorCode.UPLOAD_TOO_LARGE,
        `That image is too large. Maximum ${Math.round(max / 1_000_000)} MB.`,
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const key = this.storage.buildKey(userId, kind, file.originalname);
    const stored = await this.storage.save(key, file.buffer);

    // Replacing a document should not leave the old file on disk.
    const previous = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind } },
    });

    const record = await this.prisma.document.upsert({
      where: { userId_kind: { userId, kind } },
      create: {
        userId,
        kind,
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        originalName: file.originalname ?? null,
      },
      update: {
        storageKey: stored.storageKey,
        mimeType: file.mimetype,
        sizeBytes: stored.sizeBytes,
        originalName: file.originalname ?? null,
      },
    });

    if (previous && previous.storageKey !== stored.storageKey) {
      await this.storage.remove(previous.storageKey);
    }

    // Deliberately not awaited: OCR and the face models take seconds on CPU,
    // and the applicant should get their upload confirmed immediately. The
    // result is polled from the status endpoint.
    this.analysis.enqueue(record.id);

    this.logger.log(`Stored ${kind} for user ${userId}`);
    return this.getStatus(userId);
  }

  async readDocument(
    userId: string,
    kind: DocumentKind,
  ): Promise<{ data: Buffer; mimeType: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { userId_kind: { userId, kind } },
    });
    if (!doc) throw AppException.notFound('Document not found');

    return {
      data: await this.storage.read(doc.storageKey),
      mimeType: doc.mimeType,
    };
  }

  /** Hands the application to the human review queue. */
  async submit(userId: string): Promise<OnboardingStatus> {
    await this.assertNotSubmitted(userId);

    const status = await this.getStatus(userId);

    if (!status.profileComplete || status.missingDocuments.length > 0) {
      throw new AppException(
        ApiErrorCode.ONBOARDING_INCOMPLETE,
        'Some required details or documents are still missing.',
        HttpStatus.BAD_REQUEST,
        { missingDocuments: status.missingDocuments },
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { onboardingSubmittedAt: new Date() },
      }),
      this.prisma.kycSubmission.create({
        data: {
          userId,
          accountType: status.accountType as AccountType,
          status: 'PENDING_REVIEW',
        },
      }),
    ]);

    this.logger.log(`KYC submitted by user ${userId}`);
    return this.getStatus(userId);
  }

  private async assertNotSubmitted(userId: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { onboardingSubmittedAt: true },
    });

    if (user.onboardingSubmittedAt) {
      throw new AppException(
        ApiErrorCode.ONBOARDING_ALREADY_SUBMITTED,
        'This number is already registered. Please sign in with your password.',
        HttpStatus.CONFLICT,
      );
    }
  }
}
