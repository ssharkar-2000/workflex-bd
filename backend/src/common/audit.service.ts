import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(params: {
    adminId: string;
    action: string;
    entityType: string;
    entityId: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        reason: params.reason ?? null,
        metadata: (params.metadata as never) ?? undefined,
      },
    });
  }
}
