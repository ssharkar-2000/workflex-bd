import { Injectable } from '@nestjs/common';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ListAttendanceDto, MarkAttendanceDto } from './dto/attendance.dto';

/// Postgres `date` columns compare by midnight UTC, so a plain `new Date()`
/// carrying a time component would never match. Normalise before querying.
function atMidnight(value?: string): Date {
  const date = value ? new Date(value) : new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListAttendanceDto) {
    const where: Prisma.AttendanceRecordWhereInput = {
      date: atMidnight(query.date),
      ...(query.status ? { status: query.status } : {}),
      ...(query.workerId ? { workerId: query.workerId } : {}),
      ...(query.search
        ? { worker: { fullName: { contains: query.search, mode: 'insensitive' } } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          worker: { select: { id: true, fullName: true, initials: true, profession: true } },
          job: { select: { id: true, title: true } },
        },
        orderBy: { checkInAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  /// The summary strip: how today splits across present / late / absent / leave.
  async summary(dateInput?: string) {
    const date = atMidnight(dateInput);
    const rows = await this.prisma.attendanceRecord.groupBy({
      by: ['status'],
      where: { date },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    const total = rows.reduce((sum, r) => sum + r._count._all, 0);
    const present = counts[AttendanceStatus.PRESENT] ?? 0;

    const flagged = await this.prisma.attendanceRecord.count({
      where: { date, gpsFlagged: true },
    });

    return {
      date: date.toISOString().slice(0, 10),
      total,
      present,
      late: counts[AttendanceStatus.LATE] ?? 0,
      absent: counts[AttendanceStatus.ABSENT] ?? 0,
      onLeave: counts[AttendanceStatus.ON_LEAVE] ?? 0,
      gpsFlagged: flagged,
      attendanceRate: total === 0 ? 0 : Math.round((present / total) * 1000) / 10,
    };
  }

  /// Upsert, because a day can only hold one record per worker and an admin may
  /// correct a status more than once.
  async mark(dto: MarkAttendanceDto, adminId: string) {
    const date = atMidnight(dto.date);
    const record = await this.prisma.attendanceRecord.upsert({
      where: { workerId_date: { workerId: dto.workerId, date } },
      create: {
        workerId: dto.workerId,
        jobId: dto.jobId ?? null,
        date,
        status: dto.status,
        note: dto.note ?? null,
        checkInAt: dto.status === AttendanceStatus.ABSENT ? null : new Date(),
      },
      update: { status: dto.status, note: dto.note ?? null },
    });

    await this.audit.record({
      adminId,
      action: 'attendance.mark',
      entityType: 'AttendanceRecord',
      entityId: record.id,
      metadata: { status: dto.status, date: dto.date },
    });
    return record;
  }
}
