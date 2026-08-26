import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  VerificationLevel,
  type AdminAnalytics,
  type AdminCompanyList,
  type AiMonitoring,
  type FraudReport,
  type FraudSignal,
  type ReportSummary,
  type SecurityOverview,
  type SystemStatus,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { SmsService } from '../sms/sms.service';
import type { Env } from '../config/env.schema';

const DAY_MS = 86_400_000;

/**
 * Everything the console *reports on*, as opposed to acts on.
 *
 * All of it reads existing tables. The AI-monitoring and fraud sections in
 * particular are not new machinery: the KYC pipeline already scores every
 * uploaded document, and these two views are that data asked different
 * questions — "did the checks run" versus "does this person look risky".
 */
@Injectable()
export class AdminInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly sms: SmsService,
  ) {}

  // --- company management ---

  async companies(search?: string): Promise<AdminCompanyList> {
    const where = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [total, rows] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, phone: true } },
        },
      }),
    ]);

    return {
      total,
      rows: rows.map((c) => ({
        id: c.id,
        name: c.name,
        registrationNumber: c.registrationNumber,
        tin: c.tin,
        tradeLicenseNo: c.tradeLicenseNo,
        verified: c.verifiedAt !== null,
        ownerId: c.owner.id,
        ownerName:
          [c.owner.firstName, c.owner.lastName].filter(Boolean).join(' ') ||
          'Unnamed',
        ownerPhone: c.owner.phone,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  // --- analytics ---

  async analytics(): Promise<AdminAnalytics> {
    const since = new Date(Date.now() - 13 * DAY_MS);
    since.setHours(0, 0, 0, 0);

    const [users, individual, company, unset, submissions, emails] =
      await Promise.all([
        this.prisma.user.findMany({
          where: { createdAt: { gte: since }, status: { not: 'DELETED' } },
          select: { createdAt: true },
        }),
        this.prisma.user.count({ where: { accountType: 'INDIVIDUAL' } }),
        this.prisma.user.count({ where: { accountType: 'COMPANY' } }),
        this.prisma.user.count({ where: { accountType: null } }),
        this.prisma.kycSubmission.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        this.prisma.user.aggregate({
          _count: { email: true, emailVerifiedAt: true },
        }),
      ]);

    // Bucket into 14 dated slots so a quiet day shows as zero rather than
    // vanishing from the series and distorting the shape of the chart.
    const buckets = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY_MS);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const u of users) {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    const statusCount = (s: string) =>
      submissions.find((x) => x.status === s)?._count._all ?? 0;

    const [registered, profileComplete, documentsUploaded, approvedLevel] =
      await Promise.all([
        this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
        this.prisma.user.count({
          where: { firstName: { not: null }, address: { not: null } },
        }),
        this.prisma.user
          .findMany({
            where: { documents: { some: {} } },
            select: { id: true },
          })
          .then((r) => r.length),
        this.prisma.user.count({
          where: { verificationLevel: { gte: VerificationLevel.L1_IDENTITY } },
        }),
      ]);

    return {
      signupsByDay: [...buckets].map(([date, count]) => ({ date, count })),
      accountTypeSplit: { individual, company, unset },
      verificationFunnel: {
        registered,
        profileComplete,
        documentsUploaded,
        submitted:
          statusCount('PENDING_REVIEW') +
          statusCount('APPROVED') +
          statusCount('REJECTED'),
        approved: approvedLevel,
      },
      emailAdoption: {
        withEmail: emails._count.email,
        verified: emails._count.emailVerifiedAt,
      },
    };
  }

  // --- AI monitoring ---

  async aiMonitoring(): Promise<AiMonitoring> {
    const [grouped, recent] = await Promise.all([
      this.prisma.documentAnalysis.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.documentAnalysis.findMany({
        orderBy: { createdAt: 'desc' },
        take: 40,
        include: {
          document: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, phone: true },
              },
            },
          },
        },
      }),
    ]);

    const count = (s: string) =>
      grouped.find((g) => g.status === s)?._count._all ?? 0;

    return {
      counts: {
        passed: count('PASSED'),
        needsReview: count('NEEDS_REVIEW'),
        failed: count('FAILED'),
        skipped: count('SKIPPED'),
        queued: count('QUEUED') + count('RUNNING'),
      },
      alerts: recent.map((a) => ({
        id: a.id,
        userId: a.document.user.id,
        userName:
          [a.document.user.firstName, a.document.user.lastName]
            .filter(Boolean)
            .join(' ') || 'Unnamed',
        userPhone: a.document.user.phone,
        kind: a.document.kind,
        status: a.status,
        sharpness: a.sharpness,
        glare: a.glare,
        cardFound: a.cardFound,
        facesDetected: a.facesDetected,
        faceMatch: a.faceMatch,
        extractedNid: a.extractedNid,
        extractedName: a.extractedName,
        notes: a.notes,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  // --- fraud detection ---

  /**
   * Rule-based scoring over the document analyses. Deliberately explainable:
   * every point added carries a sentence, because a reviewer acting on this
   * needs to justify a suspension to the person it affects.
   */
  async fraud(): Promise<FraudReport> {
    const analyses = await this.prisma.documentAnalysis.findMany({
      include: {
        document: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
          },
        },
      },
    });

    const byUser = new Map<string, FraudSignal>();

    for (const a of analyses) {
      const u = a.document.user;
      const signal = byUser.get(u.id) ?? {
        userId: u.id,
        userName:
          [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed',
        userPhone: u.phone,
        riskScore: 0,
        reasons: [] as string[],
      };

      if (a.status === 'FAILED') {
        signal.riskScore += 30;
        signal.reasons.push(`${a.document.kind}: automated check failed`);
      }
      if (a.status === 'NEEDS_REVIEW') {
        signal.riskScore += 15;
        signal.reasons.push(`${a.document.kind}: flagged for a closer look`);
      }
      // A selfie that matches the NID portrait poorly is the strongest single
      // signal of someone using another person's documents.
      if (a.faceMatch !== null && a.faceMatch > 0.6) {
        signal.riskScore += 35;
        signal.reasons.push('Selfie does not closely match the NID portrait');
      }
      if (a.cardFound === false) {
        signal.riskScore += 20;
        signal.reasons.push(`${a.document.kind}: no ID card detected`);
      }
      if (a.facesDetected === 0 && a.document.kind === 'SELFIE') {
        signal.riskScore += 25;
        signal.reasons.push('No face found in the selfie');
      }

      byUser.set(u.id, signal);
    }

    const signals = [...byUser.values()]
      .filter((s) => s.riskScore > 0)
      .sort((a, b) => b.riskScore - a.riskScore);

    return { flagged: signals.length, signals: signals.slice(0, 50) };
  }

  // --- security ---

  async security(): Promise<SecurityOverview> {
    const now = new Date();

    const [activeSessions, suspendedAccounts, admins, sessions] =
      await Promise.all([
        this.prisma.refreshToken.count({
          where: { revokedAt: null, expiresAt: { gt: now } },
        }),
        this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
        this.prisma.admin.findMany({
          orderBy: { createdAt: 'asc' },
          select: { id: true, email: true, name: true, lastLoginAt: true },
        }),
        this.prisma.refreshToken.findMany({
          where: { revokedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        }),
      ]);

    return {
      activeSessions,
      suspendedAccounts,
      adminAccounts: admins.length,
      admins: admins.map((a) => ({
        id: a.id,
        email: a.email,
        name: a.name,
        lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
      })),
      recentSessions: sessions.map((s) => ({
        id: s.id,
        userId: s.user.id,
        userName:
          [s.user.firstName, s.user.lastName].filter(Boolean).join(' ') ||
          'Unnamed',
        userPhone: s.user.phone,
        deviceId: s.deviceId,
        ip: s.ip,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    };
  }

  /** Signs one person out everywhere. Used from the Security screen. */
  async revokeUserSessions(userId: string): Promise<{ revoked: number }> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  // --- system management ---

  async system(): Promise<SystemStatus> {
    const dbUp = await this.prisma.ping();

    const [users, documents, tickets, notifications] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.document.count(),
      this.prisma.supportTicket.count(),
      this.prisma.notification.count(),
    ]);

    return {
      database: dbUp ? 'up' : 'down',
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      environment: this.config.get('NODE_ENV', { infer: true }),
      smsProvider: this.config.get('SMS_PROVIDER', { infer: true }),
      mailProvider: this.config.get('MAIL_PROVIDER', { infer: true }),
      smsIsDevProvider: this.sms.isDevProvider,
      counts: { users, documents, tickets, notifications },
    };
  }

  // --- reports ---

  async report(): Promise<ReportSummary> {
    const weekAgo = new Date(Date.now() - 7 * DAY_MS);

    const [
      total,
      workers,
      employers,
      suspended,
      newThisWeek,
      approved,
      pending,
      rejected,
      openTickets,
      resolvedTickets,
    ] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.user.count({ where: { accountType: 'INDIVIDUAL' } }),
      this.prisma.user.count({ where: { accountType: 'COMPANY' } }),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.kycSubmission.count({ where: { status: 'APPROVED' } }),
      this.prisma.kycSubmission.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.kycSubmission.count({ where: { status: 'REJECTED' } }),
      this.prisma.supportTicket.count({
        where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      this.prisma.supportTicket.count({ where: { status: 'RESOLVED' } }),
    ]);

    const rows: [string, number][] = [
      ['Total accounts', total],
      ['Workers', workers],
      ['Employers', employers],
      ['Suspended', suspended],
      ['New this week', newThisWeek],
      ['KYC approved', approved],
      ['KYC pending', pending],
      ['KYC rejected', rejected],
      ['Support open', openTickets],
      ['Support resolved', resolvedTickets],
    ];

    return {
      generatedAt: new Date().toISOString(),
      users: { total, workers, employers, suspended, newThisWeek },
      verification: { approved, pending, rejected },
      support: { open: openTickets, resolved: resolvedTickets },
      csv: ['Metric,Value', ...rows.map(([k, v]) => `${k},${v}`)].join('\n'),
    };
  }
}
