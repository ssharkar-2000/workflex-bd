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
      // Held submissions stay in the queue. Holding is a request to look
      // again, so dropping them from the only list reviewers see would lose
      // the applicant entirely — nobody would ever come back to them.
      where: { status: { in: ['PENDING_REVIEW', 'ON_HOLD'] } },
      // Oldest first, and unreviewed ahead of held: someone nobody has looked
      // at yet is waiting on the queue itself, where a held case is already
      // somebody's problem.
      //
      // Sorting on an enum uses the order Postgres holds it in, which is not
      // the order this schema declares. `ALTER TYPE ... ADD VALUE` appends, so
      // an existing database sorts ON_HOLD last while a database created fresh
      // from the schema sorts it third. Checked both: PENDING_REVIEW precedes
      // ON_HOLD either way, so this ordering is stable across the two.
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
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
        status: s.status,
        // `rejectReason` doubles as the hold note in the database; it is only
        // a rejection reason when the status says so, and exposing it under
        // that name here would invite a reviewer to read a hold as a refusal.
        holdNote: s.status === 'ON_HOLD' ? s.rejectReason : null,
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

    /**
     * The level follows the evidence, not a role chosen at signup.
     *
     * NID and selfie prove the person, which is L1 and is what everyone
     * needs. A trade licence additionally proves a business, which is L2 and
     * is what unlocks posting jobs as a company. Reading the uploaded
     * documents means someone who adds a licence months later is upgraded on
     * the same code path, with no account type to change.
     */
    const hasTradeLicence = await this.prisma.document.findUnique({
      where: {
        userId_kind: { userId: submission.userId, kind: 'TRADE_LICENSE' },
      },
      select: { id: true },
    });

    const level = hasTradeLicence
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

  /**
   * Holds a submission for a closer look.
   *
   * Deliberately changes nothing else. The applicant's verification level is
   * untouched and `onboardingSubmittedAt` is left set, so nothing they have
   * already sent is thrown away and they are not asked to resubmit — unlike a
   * rejection, this is not a decision, it is the absence of one.
   *
   * The note is for the next reviewer rather than the applicant, which is why
   * it is optional: "waiting on the licence to be legible" is worth recording
   * even when there is nothing useful to tell the person yet.
   */
  async hold(submissionId: string, adminId: string, note?: string) {
    await this.load(submissionId);

    await this.prisma.kycSubmission.update({
      where: { id: submissionId },
      data: {
        status: 'ON_HOLD',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectReason: note?.trim() ? note.trim() : null,
      },
    });

    this.logger.log(
      `KYC ${submissionId} held by ${adminId}${note ? `: ${note}` : ''}`,
    );
    return { id: submissionId, status: 'ON_HOLD', note: note ?? null };
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

    // Open means "still awaiting a decision", which covers held cases as well
    // as untouched ones. Guarding on PENDING_REVIEW alone made holding a dead
    // end: the submission could be put on hold and then never approved or
    // rejected, because every decision path ran through here and refused it.
    //
    // A decided submission is still refused. Two reviewers reaching a verdict
    // on the same file should not silently overwrite each other.
    const open: typeof submission.status[] = ['PENDING_REVIEW', 'ON_HOLD'];
    if (!open.includes(submission.status)) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        `This submission was already ${submission.status.toLowerCase()}.`,
        HttpStatus.CONFLICT,
      );
    }
    return submission;
  }
}
