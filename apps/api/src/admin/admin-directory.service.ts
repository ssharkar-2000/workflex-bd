import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  VerificationLevel,
  type AdminDashboard,
  type AdminUserList,
  type AdminUserQuery,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/** Considered "online" if seen within this window. */
const ONLINE_WINDOW_MS = 15 * 60 * 1000;

/**
 * Read models behind the admin dashboard and the people directory.
 *
 * Everything here counts real rows. Figures the schema cannot answer yet
 * (revenue, fraud alerts) are returned as null or zero rather than invented,
 * so the portal never shows a number nobody can trace back to a record.
 */
@Injectable()
export class AdminDirectoryService {
  private readonly logger = new Logger(AdminDirectoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async dashboard(): Promise<AdminDashboard> {
    const since = new Date(Date.now() - ONLINE_WINDOW_MS);

    const [
      totalWorkers,
      employers,
      pendingVerification,
      onlineUsers,
      recent,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { accountType: 'INDIVIDUAL', status: { not: 'DELETED' } },
      }),
      this.prisma.user.count({
        where: { accountType: 'COMPANY', status: { not: 'DELETED' } },
      }),
      this.prisma.kycSubmission.count({ where: { status: 'PENDING_REVIEW' } }),
      // A refresh token minted recently is the closest thing to a session
      // heartbeat the schema currently has.
      this.prisma.refreshToken
        .findMany({
          where: { createdAt: { gte: since }, revokedAt: null },
          distinct: ['userId'],
          select: { userId: true },
        })
        .then((rows) => rows.length),
      this.prisma.user.findMany({
        where: { status: { not: 'DELETED' } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          accountType: true,
          verificationLevel: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalWorkers,
      employers,
      // Jobs, revenue and fraud detection are separate modules that do not
      // exist in the schema yet. Reported honestly rather than faked.
      activeJobs: 0,
      pendingVerification,
      totalRevenue: null,
      monthlyRevenue: null,
      onlineUsers,
      fraudAlerts: 0,
      recentSignups: recent.map((u) => ({
        id: u.id,
        name:
          [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed user',
        phone: u.phone,
        accountType: u.accountType,
        verificationLevel: u.verificationLevel,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  async users(query: AdminUserQuery): Promise<AdminUserList> {
    const where: Prisma.UserWhereInput = {
      status: { not: 'DELETED' },
      ...(query.accountType ? { accountType: query.accountType } : {}),
    };

    switch (query.filter) {
      case 'VERIFIED':
        where.verificationLevel = { gte: VerificationLevel.L1_IDENTITY };
        break;
      case 'PENDING':
        where.kycSubmissions = { some: { status: 'PENDING_REVIEW' } };
        break;
      case 'SUSPENDED':
        where.status = 'SUSPENDED';
        break;
      default:
        break;
    }

    if (query.search) {
      const term = query.search;
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          company: { select: { name: true } },
          kycSubmissions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { status: true },
          },
        },
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      rows: rows.map((u) => ({
        id: u.id,
        name:
          [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Unnamed user',
        phone: u.phone,
        email: u.email,
        accountType: u.accountType,
        verificationLevel: u.verificationLevel,
        status: u.status,
        kycStatus: u.kycSubmissions[0]?.status ?? 'NOT_STARTED',
        companyName: u.company?.name ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Suspending revokes every session as well as flipping the flag — leaving a
   * suspended account with live access tokens would make the suspension
   * cosmetic until they happened to expire.
   */
  async setStatus(
    userId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    adminId: string,
    reason?: string,
  ): Promise<{ id: string; status: string }> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    if (status === 'SUSPENDED') {
      await this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    this.logger.warn(
      { adminId, userId, status, reason },
      `Admin set account status to ${status}`,
    );

    return { id: user.id, status: user.status };
  }
}
