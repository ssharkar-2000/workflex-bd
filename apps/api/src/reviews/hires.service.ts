import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import {
  ApiErrorCode,
  type HireCompleted,
  type HireGroup,
  type HireList,
  type ReviewRole,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/** Far past anyone's real number of hires; keeps one bad query bounded. */
const LIMIT = 300;

const PERSON = {
  id: true,
  publicId: true,
  firstName: true,
  lastName: true,
  phone: true,
} as const;

const JOB = {
  id: true,
  title: true,
  companyName: true,
  category: true,
  jobType: true,
  workplaceType: true,
  location: true,
  paymentType: true,
  salaryMin: true,
  salaryMax: true,
  startDate: true,
  postedBy: true,
} as const;

/**
 * The hired lists, grouped by job, and the step that finishes a hire.
 *
 * A hire is an ACCEPTED application. Finishing one sets `completedAt` and
 * leaves the status alone: payments, reviews and trust all count ACCEPTED
 * hires, and none of them should stop counting a job because it ended.
 */
@Injectable()
export class HiresService {
  private readonly logger = new Logger(HiresService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * As RECRUITER: the people this account hired who are still working, under
   * the job each was hired for. As WORKER: the recruiters who hired this
   * account, finished jobs included and listed after the ongoing ones.
   */
  async list(userId: string, as: ReviewRole): Promise<HireList> {
    const rows = await this.prisma.jobApplication.findMany({
      where:
        as === 'RECRUITER'
          ? { status: 'ACCEPTED', completedAt: null, job: { postedBy: userId } }
          : { status: 'ACCEPTED', userId, job: { postedBy: { not: null } } },
      orderBy: { updatedAt: 'desc' },
      take: LIMIT,
      select: {
        jobId: true,
        updatedAt: true,
        completedAt: true,
        user: { select: PERSON },
        job: { select: JOB },
      },
    });
    if (rows.length === 0) return { as, groups: [] };

    // Ongoing first; the sort is stable, so newest-first holds within each.
    rows.sort((a, b) => Number(a.completedAt !== null) - Number(b.completedAt !== null));

    const jobIds = [...new Set(rows.map((row) => row.jobId))];

    // Job has no relation to its poster, only the id, so recruiters are
    // looked up in one query rather than per row.
    const posters =
      as === 'WORKER'
        ? new Map(
            (
              await this.prisma.user.findMany({
                where: { id: { in: [...new Set(rows.map((row) => row.job.postedBy as string))] } },
                select: PERSON,
              })
            ).map((user) => [user.id, user]),
          )
        : null;

    const [payments, reviews] = await Promise.all([
      this.prisma.walletPayment.groupBy({
        by: ['jobId', 'payerId', 'payeeId'],
        where:
          as === 'RECRUITER'
            ? { payerId: userId, jobId: { in: jobIds } }
            : { payeeId: userId, jobId: { in: jobIds } },
        _sum: { amount: true },
      }),
      this.prisma.review.findMany({
        where: {
          authorId: userId,
          jobId: { in: jobIds },
          subjectRole: as === 'RECRUITER' ? 'WORKER' : 'RECRUITER',
        },
        select: { jobId: true, subjectId: true, rating: true, comment: true },
      }),
    ]);

    // Keyed by job and the other person, whichever side they are on.
    const paid = new Map(
      payments.map((row) => [
        `${row.jobId}:${as === 'RECRUITER' ? row.payeeId : row.payerId}`,
        row._sum.amount ?? 0,
      ]),
    );
    const reviewed = new Map(reviews.map((row) => [`${row.jobId}:${row.subjectId}`, row]));

    const groups = new Map<string, HireGroup>();
    for (const row of rows) {
      const other = as === 'RECRUITER' ? row.user : posters?.get(row.job.postedBy as string);
      if (!other) continue;

      let group = groups.get(row.jobId);
      if (!group) {
        const { postedBy: _postedBy, startDate, ...job } = row.job;
        group = { job: { ...job, startDate: startDate?.toISOString() ?? null }, people: [] };
        groups.set(row.jobId, group);
      }

      const review = reviewed.get(`${row.jobId}:${other.id}`);
      group.people.push({
        userId: other.id,
        publicId: other.publicId,
        name: nameOf(other),
        phone: other.phone,
        hiredAt: row.updatedAt.toISOString(),
        completedAt: row.completedAt?.toISOString() ?? null,
        paid: paid.get(`${row.jobId}:${other.id}`) ?? 0,
        myReview: review ? { rating: review.rating, comment: review.comment } : null,
      });
    }

    return { as, groups: [...groups.values()] };
  }

  /**
   * The recruiter confirms the work is finished.
   *
   * Only the account that posted the job can do it, and only for someone it
   * actually hired. A second tap, or a second device, finds it already done
   * and gets the same answer rather than an error.
   */
  async complete(recruiterId: string, jobId: string, workerId: string): Promise<HireCompleted> {
    const hire = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId, userId: workerId } },
      select: { status: true, completedAt: true, job: { select: { postedBy: true, title: true } } },
    });
    if (!hire || hire.job.postedBy !== recruiterId || hire.status !== 'ACCEPTED') {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'Only the recruiter who hired this person can mark the job completed',
        HttpStatus.FORBIDDEN,
      );
    }
    if (hire.completedAt) {
      return { jobId, workerId, completedAt: hire.completedAt.toISOString() };
    }

    // Guarded on completedAt, so two taps at once finish it exactly once.
    const now = new Date();
    const { count } = await this.prisma.jobApplication.updateMany({
      where: { jobId, userId: workerId, status: 'ACCEPTED', completedAt: null },
      data: { completedAt: now },
    });
    if (count === 0) {
      const done = await this.prisma.jobApplication.findUniqueOrThrow({
        where: { jobId_userId: { jobId, userId: workerId } },
        select: { completedAt: true },
      });
      return { jobId, workerId, completedAt: (done.completedAt ?? now).toISOString() };
    }

    this.logger.log(`Job ${jobId}: ${workerId} marked completed by ${recruiterId}`);
    await this.tellTheWorker(recruiterId, workerId, jobId, hire.job.title);
    return { jobId, workerId, completedAt: now.toISOString() };
  }

  /** A line in the job's conversation, so the worker hears it finished. */
  private async tellTheWorker(
    recruiterId: string,
    workerId: string,
    jobId: string,
    title: string,
  ): Promise<void> {
    try {
      const conversation = await this.prisma.conversation.upsert({
        where: { jobId_workerId: { jobId, workerId } },
        create: { jobId, workerId, recruiterId },
        update: {},
        select: { id: true },
      });
      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          authorId: recruiterId,
          kind: 'TEXT',
          body: `✓ Job completed: ${title}. You can rate each other from the hired lists now.`,
        },
      });
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: message.createdAt },
      });
    } catch (err) {
      // The job is finished either way; a missing message is worth a log,
      // not a failed request.
      this.logger.warn(`Job ${jobId}: could not post the completion message — ${(err as Error).message}`);
    }
  }
}

function nameOf(user: { firstName: string | null; lastName: string | null; phone: string }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone;
}
