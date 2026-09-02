import { Injectable } from '@nestjs/common';
import type { DashboardSummary, ProfileGap } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Everything the dashboard counts, in one query round.
 *
 * The figures are deliberately the ones a person can act on: applications they
 * are waiting to hear about, people waiting to hear from them, and how far
 * from complete their profile is. Vanity totals were left out — "8 jobs
 * completed" reads well on a mockup and means nothing until the product can
 * actually tell when work finished.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Profile completeness, from five checks that each unlock something real.
   *
   * Weighted rather than counted: an unverified account cannot apply for work
   * at all, so identity is worth more than an email address that only makes
   * account recovery easier. The percentage is the share of weight earned, so
   * it cannot drift out of step with the list of gaps beside it.
   */
  private async profileStrength(userId: string) {
    const [user, cv] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          emailVerifiedAt: true,
          verificationLevel: true,
          documents: { where: { kind: 'SELFIE' }, select: { id: true } },
        },
      }),
      this.prisma.cvProfile.findUnique({
        where: { userId },
        select: { id: true },
      }),
    ]);

    const checks: { gap: ProfileGap; weight: number; done: boolean }[] = [
      {
        gap: 'NAME',
        weight: 10,
        done: Boolean(user.firstName?.trim()),
      },
      {
        gap: 'NID_VERIFIED',
        weight: 40,
        done: user.verificationLevel >= 1,
      },
      { gap: 'PHOTO', weight: 20, done: user.documents.length > 0 },
      { gap: 'CV', weight: 20, done: cv !== null },
      {
        gap: 'EMAIL',
        weight: 10,
        done: Boolean(user.email) && user.emailVerifiedAt !== null,
      },
    ];

    const total = checks.reduce((sum, c) => sum + c.weight, 0);
    const earned = checks
      .filter((c) => c.done)
      .reduce((sum, c) => sum + c.weight, 0);

    return {
      percent: Math.round((earned / total) * 100),
      missing: checks.filter((c) => !c.done).map((c) => c.gap),
    };
  }

  async summary(userId: string): Promise<DashboardSummary> {
    const now = new Date();

    const [
      profileStrength,
      applications,
      activeApplications,
      shortlisted,
      savedJobs,
      jobsPosted,
      openJobs,
      applicants,
      notifications,
      reads,
    ] = await Promise.all([
      this.profileStrength(userId),

      this.prisma.jobApplication.count({ where: { userId } }),
      this.prisma.jobApplication.count({
        where: {
          userId,
          status: { in: ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'ACCEPTED'] },
        },
      }),
      this.prisma.jobApplication.count({
        where: { userId, status: 'SHORTLISTED' },
      }),
      this.prisma.savedJob.count({ where: { userId } }),

      this.prisma.job.count({ where: { postedBy: userId } }),
      this.prisma.job.count({
        where: {
          postedBy: userId,
          isOpen: true,
          OR: [{ deadline: null }, { deadline: { gte: now } }],
        },
      }),
      // Across every posting this account owns, and excluding withdrawals —
      // the count is what the poster still has to act on.
      this.prisma.jobApplication.count({
        where: { job: { postedBy: userId }, status: { not: 'WITHDRAWN' } },
      }),

      this.prisma.notification.count({ where: { sentAt: { not: null } } }),
      this.prisma.notificationRead.count({ where: { userId } }),
    ]);

    return {
      profileStrength,
      seeking: { applications, activeApplications, shortlisted, savedJobs },
      hiring: { jobsPosted, openJobs, applicants },
      // Clamped: a read row can outlive the notice it referred to, and a
      // negative badge is worse than a stale zero.
      unreadNotifications: Math.max(0, notifications - reads),
    };
  }
}
