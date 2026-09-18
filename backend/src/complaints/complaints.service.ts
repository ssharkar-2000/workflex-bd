import { Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListComplaintsDto, ReplyComplaintDto, UpdateComplaintDto } from './dto/complaint.dto';

@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /// "Onek din dhore jome ache" — complaints still unresolved (OPEN,
  /// IN_PROGRESS, or ESCALATED) after `thresholdDays`. Drives the red dot
  /// next to "Complaints & Support" in the menu.
  async backlog(thresholdDays = 3) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - thresholdDays);
    const count = await this.prisma.complaint.count({
      where: {
        status: { in: [ComplaintStatus.OPEN, ComplaintStatus.IN_PROGRESS, ComplaintStatus.ESCALATED] },
        createdAt: { lte: cutoff },
      },
    });
    return { count, thresholdDays };
  }

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
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        assignedAdmin: { select: { id: true, displayName: true, email: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { admin: { select: { id: true, displayName: true } } },
        },
      },
    });
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
    return this.findOne(id);
  }

  async reply(id: string, dto: ReplyComplaintDto, adminId: string) {
    await this.findOne(id);
    await this.prisma.complaintReply.create({
      data: { complaintId: id, adminId, message: dto.message },
    });
    await this.audit.record({
      adminId,
      action: 'complaint.reply',
      entityType: 'Complaint',
      entityId: id,
      reason: dto.message,
    });
    return this.findOne(id);
  }

  async assign(id: string, adminId: string) {
    await this.findOne(id);
    await this.prisma.complaint.update({
      where: { id },
      data: { assignedAdminId: adminId, status: ComplaintStatus.IN_PROGRESS },
    });
    await this.audit.record({
      adminId,
      action: 'complaint.assign',
      entityType: 'Complaint',
      entityId: id,
    });
    return this.findOne(id);
  }

  async escalate(id: string, adminId: string) {
    await this.findOne(id);
    await this.prisma.complaint.update({
      where: { id },
      data: { status: ComplaintStatus.ESCALATED },
    });
    await this.audit.record({
      adminId,
      action: 'complaint.escalate',
      entityType: 'Complaint',
      entityId: id,
    });
    return this.findOne(id);
  }

  async resolve(id: string, resolution: string | undefined, adminId: string) {
    await this.findOne(id);
    await this.prisma.complaint.update({
      where: { id },
      data: {
        status: ComplaintStatus.RESOLVED,
        resolution: resolution ?? 'Resolved by support team',
        resolvedAt: new Date(),
      },
    });
    await this.audit.record({
      adminId,
      action: 'complaint.resolve',
      entityType: 'Complaint',
      entityId: id,
      reason: resolution,
    });
    return this.findOne(id);
  }

  async reopen(id: string, adminId: string) {
    await this.findOne(id);
    await this.prisma.complaint.update({
      where: { id },
      data: { status: ComplaintStatus.OPEN, resolvedAt: null },
    });
    await this.audit.record({
      adminId,
      action: 'complaint.reopen',
      entityType: 'Complaint',
      entityId: id,
    });
    return this.findOne(id);
  }

  async close(id: string, adminId: string) {
    await this.findOne(id);
    await this.prisma.complaint.update({
      where: { id },
      data: { status: ComplaintStatus.CLOSED, resolvedAt: new Date() },
    });
    await this.audit.record({
      adminId,
      action: 'complaint.close',
      entityType: 'Complaint',
      entityId: id,
    });
    return this.findOne(id);
  }
}
