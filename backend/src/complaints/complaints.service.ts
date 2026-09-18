import { Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListComplaintsDto, UpdateComplaintDto } from './dto/complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListComplaintsDto) {
    const where: Prisma.ComplaintWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { subject: { contains: query.search, mode: 'insensitive' } },
              { reporterName: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.complaint.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.complaint.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const complaint = await this.prisma.complaint.findUnique({ where: { id } });
    if (!complaint) throw new NotFoundException('That ticket no longer exists.');
    return complaint;
  }

  async update(id: string, dto: UpdateComplaintDto, adminId: string) {
    await this.findOne(id);
    const resolved =
      dto.status === ComplaintStatus.RESOLVED || dto.status === ComplaintStatus.CLOSED;

    const complaint = await this.prisma.complaint.update({
      where: { id },
      data: { ...dto, ...(resolved ? { resolvedAt: new Date() } : {}) },
    });

    await this.audit.record({
      adminId,
      action: 'complaint.update',
      entityType: 'Complaint',
      entityId: id,
      reason: dto.resolution,
    });
    return complaint;
  }
}
