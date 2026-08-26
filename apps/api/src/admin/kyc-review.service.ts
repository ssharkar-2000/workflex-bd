import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ApiErrorCode, VerificationLevel } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { StorageService } from '../storage/storage.service';

/**
 * Manual review queue.
 *
 * This is not a stopgap. Neither the Election Commission (NID) nor the NBR
 * (TIN) exposes a verification API, and trade licences are issued per city
 * corporation with no central registry — so a human comparing the documents
 * against the claimed details is the verification step, and stays so until a
 * commercial identity provider is contracted.
 */
@Injectable()
export class KycReviewService {
  private readonly logger = new Logger(KycReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async queue(limit = 50) {
    const submissions = await this.prisma.kycSubmission.findMany({
      where: { status: 'PENDING_REVIEW' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            address: true,
            designation: true,
            email: true,
            emailVerifiedAt: true,
            company: {
              select: {
                name: true,
                registrationNumber: true,
                tin: true,
                tradeLicenseNo: true,
              },
            },
            documents: {
              select: {
                kind: true,
                sizeBytes: true,
                createdAt: true,
                analysis: true,
              },
            },
          },
        },
      },
    });

    return {
      count: submissions.length,
      submissions: submissions.map((s) => ({
        id: s.id,
        accountType: s.accountType,
        submittedAt: s.createdAt.toISOString(),
        // Oldest first, so the reviewer sees how long people have waited.
        waitingHours: Math.floor(
          (Date.now() - s.createdAt.getTime()) / 3_600_000,
        ),
        applicant: {
          userId: s.user.id,
          phone: s.user.phone,
          name: [s.user.firstName, s.user.lastName].filter(Boolean).join(' '),
          address: s.user.address,
          designation: s.user.designation,
          email: s.user.email,
          emailVerified: s.user.emailVerifiedAt !== null,
          company: s.user.company,
          // Surfaced per document so the reviewer knows which image to open
          // first — the automated checks rank the work, they do not do it.
          documents: s.user.documents.map((d) => ({
            kind: d.kind,
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
        },
      })),
    };
  }

  /** Reviewer-facing image fetch, separate from the applicant's own endpoint. */
  async document(userId: string, kind: string, adminId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { userId, kind: kind as never },
    });
    if (!doc) throw AppException.notFound('Document not found');

    // Viewing someone's NID is a privileged act and is recorded as one.
    this.logger.warn(
      { adminId, userId, kind },
      'Admin viewed an applicant document',
    );

    return {
      data: await this.storage.read(doc.storageKey),
      mimeType: doc.mimeType,
    };
  }

  async approve(submissionId: string, adminId: string) {
    const submission = await this.load(submissionId);

    // A company application proves the person *and* the business, so it lands
    // at L2; an individual application stops at L1.
    const level =
      submission.accountType === 'COMPANY'
        ? VerificationLevel.L2_BUSINESS
        : VerificationLevel.L1_IDENTITY;

    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'APPROVED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectReason: null,
        },
      }),
      this.prisma.user.update({
        where: { id: submission.userId },
        data: { verificationLevel: level },
      }),
      ...(submission.accountType === 'COMPANY'
        ? [
            this.prisma.company.updateMany({
              where: { ownerId: submission.userId },
              data: { verifiedAt: new Date() },
            }),
          ]
        : []),
    ]);

    this.logger.log(
      `KYC ${submissionId} approved by ${adminId} -> level ${level}`,
    );
    return { id: submissionId, status: 'APPROVED', verificationLevel: level };
  }

  async reject(submissionId: string, adminId: string, reason: string) {
    const submission = await this.load(submissionId);

    await this.prisma.$transaction([
      this.prisma.kycSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'REJECTED',
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectReason: reason,
        },
      }),
      // Clearing the timestamp reopens the form so the applicant can fix the
      // specific problem and resubmit, rather than being permanently stuck.
      this.prisma.user.update({
        where: { id: submission.userId },
        data: { onboardingSubmittedAt: null },
      }),
    ]);

    this.logger.log(`KYC ${submissionId} rejected by ${adminId}: ${reason}`);
    return { id: submissionId, status: 'REJECTED', reason };
  }

  private async load(submissionId: string) {
    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw AppException.notFound('Submission not found');

    if (submission.status !== 'PENDING_REVIEW') {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        `This submission was already ${submission.status.toLowerCase()}.`,
        HttpStatus.CONFLICT,
      );
    }
    return submission;
  }
}
