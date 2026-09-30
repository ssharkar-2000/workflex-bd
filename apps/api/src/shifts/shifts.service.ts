import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ApiErrorCode,
  type CancelShiftDto,
  type CreateShiftDto,
  type Shift,
  type ShiftCheckInDto,
  type ShiftCheckOutDto,
  type ShiftCounts,
  type ShiftDetail,
  type ShiftFilter,
  type ShiftList,
  type ShiftSide,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/**
 * Shifts: one person, one job, one span of time.
 *
 * The same rows serve both sides of the screen. "My work shifts" are the
 * ones where this account is the worker; "my posted shifts" are the ones on
 * jobs it posted. Nothing is duplicated, because a shift is a single fact
 * that two people see from different ends.
 *
 * Status is stored rather than derived — a shift that was cancelled stays
 * cancelled — except for the one transition a clock makes on its own: a
 * CONFIRMED shift whose end time has passed with nobody checking in is shown
 * as missed rather than eternally upcoming.
 */
@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, side: ShiftSide, filter: ShiftFilter): Promise<ShiftList> {
    const mine: Prisma.ShiftWhereInput =
      side === 'WORK' ? { workerId: userId } : { job: { postedBy: userId } };

    const [rows, counts] = await Promise.all([
      this.prisma.shift.findMany({
        where: { ...mine, ...whereFor(filter) },
        orderBy: filter === 'COMPLETED' ? { startsAt: 'desc' } : { startsAt: 'asc' },
        take: 50,
        include: SHIFT_INCLUDE,
      }),
      this.counts(mine),
    ]);

    const employers = await this.employersOf(rows);
    return { counts, shifts: rows.map((row) => toShift(row, employers)) };
  }

  async one(userId: string, id: string): Promise<ShiftDetail> {
    const row = await this.prisma.shift.findUnique({
      where: { id },
      include: SHIFT_INCLUDE,
    });
    if (!row || (row.workerId !== userId && row.job.postedBy !== userId)) {
      // Same answer either way: a shift someone is not part of should not be
      // distinguishable from one that does not exist.
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such shift', HttpStatus.NOT_FOUND);
    }

    const employers = await this.employersOf([row]);

    return {
      ...toShift(row, employers),
      instructions: row.instructions,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      dressCode: row.dressCode,
      requiredDocuments: row.requiredDocuments,
      cancellationPolicy: row.cancellationPolicy,
      cancelReason: row.cancelReason,
    };
  }

  /**
   * Put someone on a shift.
   *
   * Only the person who posted the job, and only for someone already hired
   * onto it: a shift is the arrangement that follows a hire, not a way to
   * assign work to a stranger.
   */
  async create(userId: string, dto: CreateShiftDto): Promise<ShiftDetail> {
    const job = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      select: { id: true, postedBy: true, location: true },
    });
    if (!job || job.postedBy !== userId) {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'You can only add shifts to your own job',
        HttpStatus.FORBIDDEN,
      );
    }

    const hired = await this.prisma.jobApplication.findUnique({
      where: { jobId_userId: { jobId: job.id, userId: dto.workerId } },
      select: { status: true },
    });
    if (!hired || hired.status !== 'ACCEPTED') {
      throw new AppException(
        ApiErrorCode.FORBIDDEN,
        'That person has not been hired for this job',
        HttpStatus.FORBIDDEN,
      );
    }

    const created = await this.prisma.shift.create({
      data: {
        jobId: job.id,
        workerId: dto.workerId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.endsAt),
        pay: dto.pay,
        location: dto.location ?? job.location,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        instructions: dto.instructions ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        dressCode: dto.dressCode ?? null,
        requiredDocuments: dto.requiredDocuments ?? [],
        cancellationPolicy: dto.cancellationPolicy ?? null,
        attendanceMethod: dto.attendanceMethod,
      },
      include: SHIFT_INCLUDE,
    });

    this.logger.log(`Shift ${created.id} created on job ${job.id} for ${dto.workerId}`);
    return this.one(userId, created.id);
  }

  /**
   * Arriving.
   *
   * The time recorded is this server's, not the phone's: a clock the worker
   * controls is not evidence of anything. GPS shifts keep the coordinates
   * sent, so a disputed check-in can be looked at afterwards.
   */
  async checkIn(userId: string, id: string, dto: ShiftCheckInDto): Promise<ShiftDetail> {
    const shift = await this.mine(userId, id);

    if (shift.status === 'CANCELLED') {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'This shift was cancelled',
        HttpStatus.CONFLICT,
      );
    }

    const open = await this.prisma.attendanceRecord.findFirst({
      where: { shiftId: id, userId, checkOutAt: null },
    });
    if (open) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'You are already checked in',
        HttpStatus.CONFLICT,
      );
    }

    if (shift.attendanceMethod === 'GPS' && (dto.latitude == null || dto.longitude == null)) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'This shift needs your location to check in',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.prisma.$transaction([
      this.prisma.attendanceRecord.create({
        data: {
          userId,
          shiftId: id,
          checkInAt: new Date(),
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
        },
      }),
      this.prisma.shift.update({ where: { id }, data: { status: 'IN_PROGRESS' } }),
    ]);

    this.logger.log(`Shift ${id}: ${userId} checked in`);
    return this.one(userId, id);
  }

  /**
   * Leaving.
   *
   * Pay is worked out here and stored, so what someone is owed is settled at
   * the moment the work ends rather than recomputed later from a rate that
   * may have changed. Overtime is the time beyond the shift's own end, at
   * the same rate — nobody in this market is agreeing time-and-a-half in an
   * app, and quietly paying nothing for the extra hour is worse.
   */
  async checkOut(userId: string, id: string, dto: ShiftCheckOutDto): Promise<ShiftDetail> {
    const shift = await this.mine(userId, id);

    const open = await this.prisma.attendanceRecord.findFirst({
      where: { shiftId: id, userId, checkOutAt: null },
      orderBy: { checkInAt: 'desc' },
    });
    if (!open) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'You are not checked in to this shift',
        HttpStatus.CONFLICT,
      );
    }

    const now = new Date();
    const plannedMinutes = Math.max(
      1,
      Math.round((shift.endsAt.getTime() - shift.startsAt.getTime()) / 60_000),
    );
    const workedMinutes = Math.max(
      0,
      Math.round((now.getTime() - open.checkInAt.getTime()) / 60_000),
    );
    const perMinute = shift.pay / plannedMinutes;
    const overtimeMinutes = Math.max(0, workedMinutes - plannedMinutes);

    await this.prisma.$transaction([
      this.prisma.attendanceRecord.update({
        where: { id: open.id },
        data: {
          checkOutAt: now,
          status: 'CHECKED_OUT',
          note: dto.note && dto.note.trim() ? dto.note.trim() : null,
        },
      }),
      this.prisma.shift.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          basePay: shift.pay,
          overtimePay: Math.round(overtimeMinutes * perMinute),
          bonusPay: shift.bonusPay ?? 0,
        },
      }),
    ]);

    this.logger.log(`Shift ${id}: ${userId} checked out after ${workedMinutes} minutes`);
    return this.one(userId, id);
  }

  /** Called off, by either side, with a reason the other one can read. */
  async cancel(userId: string, id: string, dto: CancelShiftDto): Promise<ShiftDetail> {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { job: { select: { postedBy: true } } },
    });
    if (!shift || (shift.workerId !== userId && shift.job.postedBy !== userId)) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such shift', HttpStatus.NOT_FOUND);
    }
    if (shift.status === 'COMPLETED') {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'That shift has already been worked',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.shift.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: dto.reason.trim() },
    });

    this.logger.log(`Shift ${id} cancelled by ${userId}`);
    return this.one(userId, id);
  }

  /**
   * The people who posted these shifts' jobs, in one query.
   *
   * Job.postedBy holds an id without a foreign key — older rows may point at
   * accounts that no longer exist — so this resolves what it can and leaves
   * the rest blank rather than failing a whole list for one dangling id.
   */
  private async employersOf(rows: { job: { postedBy: string | null } }[]) {
    const ids = [...new Set(rows.map((row) => row.job.postedBy).filter((id): id is string => Boolean(id)))];
    if (ids.length === 0) return new Map<string, Employer>();

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        company: { select: { name: true } },
      },
    });
    return new Map(users.map((user) => [user.id, user]));
  }

  private async mine(userId: string, id: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift || shift.workerId !== userId) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such shift', HttpStatus.NOT_FOUND);
    }
    return shift;
  }

  private async counts(mine: Prisma.ShiftWhereInput): Promise<ShiftCounts> {
    const [upcoming, today, completed, cancelled] = await Promise.all([
      this.prisma.shift.count({ where: { ...mine, ...whereFor('UPCOMING') } }),
      this.prisma.shift.count({ where: { ...mine, ...whereFor('TODAY') } }),
      this.prisma.shift.count({ where: { ...mine, status: 'COMPLETED' } }),
      this.prisma.shift.count({ where: { ...mine, status: 'CANCELLED' } }),
    ]);
    return { upcoming, today, completed, cancelled };
  }
}

const SHIFT_INCLUDE = {
  job: {
    select: {
      id: true,
      title: true,
      category: true,
      location: true,
      postedBy: true,
    },
  },
  worker: {
    select: { id: true, publicId: true, firstName: true, lastName: true, phone: true },
  },
  attendance: {
    orderBy: { checkInAt: 'desc' },
    take: 1,
    select: { checkInAt: true, checkOutAt: true },
  },
} satisfies Prisma.ShiftInclude;

type ShiftRow = Prisma.ShiftGetPayload<{ include: typeof SHIFT_INCLUDE }>;

type Employer = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  company: { name: string } | null;
};

function toShift(row: ShiftRow, employers: Map<string, Employer>): Shift {
  const attendance = row.attendance[0] ?? null;
  const poster = row.job.postedBy ? (employers.get(row.job.postedBy) ?? null) : null;

  return {
    id: row.id,
    status: row.status,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    location: row.location ?? row.job.location,
    latitude: row.latitude,
    longitude: row.longitude,
    pay: row.pay,
    attendanceMethod: row.attendanceMethod,
    job: { id: row.job.id, title: row.job.title, category: row.job.category },
    employer: {
      id: poster?.id ?? '',
      name: poster
        ? [poster.firstName, poster.lastName].filter(Boolean).join(' ') || poster.phone
        : '',
      company: poster?.company?.name ?? null,
    },
    worker: {
      id: row.worker.id,
      publicId: row.worker.publicId,
      name:
        [row.worker.firstName, row.worker.lastName].filter(Boolean).join(' ') ||
        row.worker.phone,
      phone: row.worker.phone,
    },
    attendance: attendance
      ? {
          checkInAt: attendance.checkInAt.toISOString(),
          checkOutAt: attendance.checkOutAt ? attendance.checkOutAt.toISOString() : null,
          workedMinutes: Math.max(
            0,
            Math.round(
              ((attendance.checkOutAt ?? new Date()).getTime() -
                attendance.checkInAt.getTime()) /
                60_000,
            ),
          ),
        }
      : null,
    earnings:
      row.basePay === null
        ? null
        : {
            basePay: row.basePay,
            overtimePay: row.overtimePay ?? 0,
            bonusPay: row.bonusPay ?? 0,
            total: row.basePay + (row.overtimePay ?? 0) + (row.bonusPay ?? 0),
          },
  };
}

/** Each tab, in dates. "Today" is the local day this server runs in. */
function whereFor(filter: ShiftFilter): Prisma.ShiftWhereInput {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  switch (filter) {
    case 'TODAY':
      return {
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        startsAt: { gte: dayStart, lt: dayEnd },
      };
    case 'UPCOMING':
      return { status: { in: ['CONFIRMED', 'IN_PROGRESS'] }, startsAt: { gte: dayEnd } };
    case 'COMPLETED':
      return { status: 'COMPLETED' };
    case 'CANCELLED':
      return { status: { in: ['CANCELLED', 'NO_SHOW'] } };
    default:
      return {};
  }
}
