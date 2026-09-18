import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VerificationStatus, VerificationType, WorkerStatus } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListVerificationsDto } from './dto/verification.dto';

@Injectable()
export class VerificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListVerificationsDto) {
    const where: Prisma.VerificationRequestWhereInput = {
      ...(query.status ? { status: query.status } : { status: VerificationStatus.PENDING }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? { subjectName: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.verificationRequest.findMany({
        where,
        orderBy: { submittedAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.verificationRequest.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  /// The six category tiles at the top of the Verification Center, each with
  /// its own pending count, plus the overall total in the subtitle.
  async pendingByType() {
    const rows = await this.prisma.verificationRequest.groupBy({
      by: ['type'],
      where: { status: VerificationStatus.PENDING },
      _count: { _all: true },
      orderBy: { type: 'asc' },
    });

    const counts = Object.fromEntries(rows.map((r) => [r.type, r._count._all]));
    const types = Object.values(VerificationType);

    return {
      total: rows.reduce((sum, r) => sum + r._count._all, 0),
      byType: types.map((type) => ({ type, pending: counts[type] ?? 0 })),
    };
  }

  async findOne(id: string) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
      include: {
        worker: { select: { id: true, fullName: true, code: true, profession: true } },
        employer: { select: { id: true, fullName: true, code: true } },
      },
    });
    if (!request) throw new NotFoundException('That verification request no longer exists.');
    return request;
  }

  async review(id: string, status: VerificationStatus, adminId: string, note?: string) {
    const request = await this.findOne(id);
    if (request.status !== VerificationStatus.PENDING) {
      throw new BadRequestException('This request has already been reviewed.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.verificationRequest.update({
        where: { id },
        data: { status, reviewNote: note ?? null, reviewedAt: new Date() },
      });

      // Approving a worker-facing check promotes the worker out of PENDING.
      if (
        status === VerificationStatus.APPROVED &&
        request.workerId &&
        ([VerificationType.NID, VerificationType.FACE, VerificationType.WORKER] as VerificationType[]).includes(request.type)
      ) {
        await tx.worker.update({
          where: { id: request.workerId },
          data: { status: WorkerStatus.ACTIVE },
        });
      }

      if (status === VerificationStatus.APPROVED && request.employerId) {
        await tx.employer.update({ where: { id: request.employerId }, data: { verified: true } });
      }

      return result;
    });

    await this.audit.record({
      adminId,
      action: `verification.${status.toLowerCase()}`,
      entityType: 'VerificationRequest',
      entityId: id,
      reason: note,
    });
    return updated;
  }
}