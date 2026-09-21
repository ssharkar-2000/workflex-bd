import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate } from '../common/pagination.dto';
import { PaginationDto } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SecurityService {
  constructor(private readonly prisma: PrismaService) {}

  /// The audit trail every module writes to, made readable.
  async auditLog(query: PaginationDto & { action?: string; entityType?: string }) {
    const where: Prisma.AuditLogWhereInput = {
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.search ? { action: { contains: query.search, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: { admin: { select: { id: true, displayName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  /// Active refresh tokens are effectively the list of live sessions.
  async sessions() {
    const sessions = await this.prisma.refreshToken.findMany({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      include: { admin: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return sessions.map((s) => ({
      id: s.id,
      admin: s.admin,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSession(id: string) {
    await this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return { revoked: true };
  }

  async overview() {
    const dayAgo = new Date(Date.now() - 864e5);
    const [activeSessions, actionsToday, admins, openAlerts] = await this.prisma.$transaction([
      this.prisma.refreshToken.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.adminUser.count(),
      this.prisma.alert.count({ where: { status: 'OPEN' } }),
    ]);

    return { activeSessions, actionsToday, admins, openAlerts };
  }
}
