import { Injectable } from '@nestjs/common';
import type {
  ActivityEvent,
  ActivityEventKind,
  ActivityFeed,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * How many events the feed returns.
 *
 * Twenty. The dashboard shows three and the notifications screen shows the
 * rest; beyond twenty an event is history rather than news, and this is a
 * feed, not an audit log.
 */
const LIMIT = 20;

/**
 * Statuses worth telling someone about, and what each is called.
 *
 * SUBMITTED and WITHDRAWN are absent on purpose: the first is the person's own
 * action a second ago, and the second is something they did themselves. A
 * notification that tells you what you just did is noise.
 */
const APPLICATION_EVENTS: Partial<Record<string, ActivityEventKind>> = {
  VIEWED: 'APPLICATION_VIEWED',
  SHORTLISTED: 'APPLICATION_SHORTLISTED',
  ACCEPTED: 'APPLICATION_ACCEPTED',
  REJECTED: 'APPLICATION_REJECTED',
};

const KYC_EVENTS: Partial<Record<string, ActivityEventKind>> = {
  APPROVED: 'VERIFICATION_APPROVED',
  ON_HOLD: 'VERIFICATION_ON_HOLD',
  REJECTED: 'VERIFICATION_REJECTED',
};

@Injectable()
export class ActivityFeedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * What has happened to this account lately.
   *
   * Assembled from four sources and merged by time. Each source is capped
   * before merging so one very busy posting cannot crowd out everything else —
   * a person with forty applicants should still see that their own application
   * was shortlisted.
   */
  async feed(userId: string): Promise<ActivityFeed> {
    const [applications, applicants, kyc, announcements] =
      await Promise.all([
        // Status changes on this person's own applications.
        this.prisma.jobApplication.findMany({
          where: {
            userId,
            status: { in: ['VIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED'] },
          },
          orderBy: { updatedAt: 'desc' },
          take: LIMIT,
          include: { job: { select: { id: true, title: true, companyName: true } } },
        }),

        // People applying to postings this account owns.
        this.prisma.jobApplication.findMany({
          where: { job: { postedBy: userId }, status: { not: 'WITHDRAWN' } },
          orderBy: { appliedAt: 'desc' },
          take: LIMIT,
          include: { job: { select: { id: true, title: true } } },
        }),

        // Verification decisions. Only reviewed ones — a submission still in
        // the queue has not happened to anyone yet.
        this.prisma.kycSubmission.findMany({
          where: { userId, reviewedAt: { not: null } },
          orderBy: { reviewedAt: 'desc' },
          take: 5,
        }),

        this.prisma.notification.findMany({
          where: { sentAt: { not: null } },
          orderBy: { sentAt: 'desc' },
          take: LIMIT,
        }),
      ]);

    const events: ActivityEvent[] = [];

    for (const row of applications) {
      const kind = APPLICATION_EVENTS[row.status];
      if (!kind) continue;
      events.push({
        id: `app:${row.jobId}:${row.status}`,
        kind,
        subject: row.job.title,
        detail: row.job.companyName,
        at: row.updatedAt.toISOString(),
        href: `/(app)/job/${row.job.id}`,
      });
    }

    for (const row of applicants) {
      events.push({
        id: `applicant:${row.jobId}:${row.userId}`,
        kind: 'NEW_APPLICANT',
        subject: row.job.title,
        detail: null,
        at: row.appliedAt.toISOString(),
        href: `/(app)/job/${row.job.id}`,
      });
    }

    for (const row of kyc) {
      const kind = KYC_EVENTS[row.status];
      if (!kind) continue;
      events.push({
        id: `kyc:${row.id}`,
        kind,
        subject: null,
        // The reviewer's reason, which is the whole point of telling someone
        // their documents were refused.
        detail: row.rejectReason,
        at: row.reviewedAt!.toISOString(),
        href: '/(onboarding)/documents',
      });
    }

    for (const row of announcements) {
      events.push({
        id: `notice:${row.id}`,
        kind: 'ANNOUNCEMENT',
        subject: row.title,
        detail: row.body,
        at: row.sentAt!.toISOString(),
        href: '/(app)/notifications',
      });
    }

    return {
      events: events
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, LIMIT),
    };
  }
}
