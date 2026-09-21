import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BanStatus,
  Prisma,
  TransactionStatus,
  TransactionType,
  UserNotificationKind,
  WorkerStatus,
} from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { paginate } from '../common/pagination.dto';
import { UserNotificationsService } from '../common/user-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelBanDto, ListBansDto, ScheduleBanDto } from './dto/ban.dto';

/// How long a user gets between being told and actually losing access.
export const BAN_NOTICE_HOURS = 24;

/// Thresholds for the irregular-transaction sweep. Deliberately conservative:
/// this list is a review queue for a human, not an automatic punishment, so
/// it is better to surface a few extra rows than to miss a real one.
const IRREGULAR = {
  /// A single transfer this large (paisa — ৳2,00,000) is worth a look.
  largeAmount: 20_000_000n,
  /// More than this many transactions from one worker in the window.
  burstCount: 8,
  /// More than this many failures from one worker in the window — repeated
  /// failures are the usual signature of card/wallet testing.
  failureCount: 3,
  windowHours: 24,
};

type Flag = { code: string; detail: string };

@Injectable()
export class BansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly userNotifications: UserNotificationsService,
  ) {}

  // -------------------------------------------------------------------------
  // Detection
  // -------------------------------------------------------------------------

  /**
   * Item 8, first half — "transaction irregular dekhle".
   *
   * Groups the last `windowHours` of transactions by worker and flags three
   * patterns an admin should look at: one unusually large transfer, an
   * unusual burst of activity, and repeated failures. Returns one row per
   * worker with every flag that fired, newest activity first, so the admin
   * screen can go straight from a flagged worker to raising a ban notice.
   */
  async irregularTransactions() {
    const since = new Date(Date.now() - IRREGULAR.windowHours * 3600_000);

    const rows = await this.prisma.transaction.findMany({
      where: { occurredAt: { gte: since }, workerId: { not: null } },
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        code: true,
        amount: true,
        status: true,
        type: true,
        occurredAt: true,
        workerId: true,
        fromLabel: true,
        toLabel: true,
      },
    });

    const byWorker = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byWorker.get(row.workerId!) ?? [];
      list.push(row);
      byWorker.set(row.workerId!, list);
    }

    const workerIds = [...byWorker.keys()];
    const workers = await this.prisma.worker.findMany({
      where: { id: { in: workerIds } },
      select: { id: true, code: true, fullName: true, initials: true, status: true },
    });
    const workerById = new Map(workers.map((w) => [w.id, w]));

    // A worker already inside a notice window shouldn't show up as a fresh
    // find — the admin has acted on them already.
    const openBans = await this.prisma.scheduledBan.findMany({
      where: { workerId: { in: workerIds }, status: BanStatus.SCHEDULED },
      select: { workerId: true, effectiveAt: true, id: true },
    });
    const banByWorker = new Map(openBans.map((b) => [b.workerId, b]));

    const items = workerIds
      .map((workerId) => {
        const txns = byWorker.get(workerId)!;
        const flags: Flag[] = [];

        const largest = txns.reduce((max, t) => (t.amount > max.amount ? t : max), txns[0]);
        if (largest.amount >= IRREGULAR.largeAmount) {
          flags.push({
            code: 'LARGE_AMOUNT',
            detail: `${largest.code} moved ৳${Math.round(Number(largest.amount) / 100).toLocaleString('en-IN')}`,
          });
        }

        if (txns.length > IRREGULAR.burstCount) {
          flags.push({
            code: 'BURST',
            detail: `${txns.length} transactions in ${IRREGULAR.windowHours} hours`,
          });
        }

        const failures = txns.filter((t) => t.status === TransactionStatus.FAILED);
        if (failures.length > IRREGULAR.failureCount) {
          flags.push({
            code: 'REPEATED_FAILURES',
            detail: `${failures.length} failed attempts in ${IRREGULAR.windowHours} hours`,
          });
        }

        // Withdrawing more than everything that came in over the same window
        // is the classic pass-through pattern.
        const cashIn = txns
          .filter((t) => t.type === TransactionType.SALARY_PAYMENT || t.type === TransactionType.REFUND)
          .reduce((sum, t) => sum + t.amount, 0n);
        const cashOut = txns
          .filter((t) => t.type === TransactionType.WITHDRAWAL)
          .reduce((sum, t) => sum + t.amount, 0n);
        if (cashOut > 0n && cashOut > cashIn) {
          flags.push({
            code: 'OUTFLOW_EXCEEDS_INFLOW',
            detail: 'Withdrawals exceed everything received in the same window',
          });
        }

        if (flags.length === 0) return null;

        const worker = workerById.get(workerId);
        const existingBan = banByWorker.get(workerId);
        return {
          workerId,
          worker: worker ?? null,
          flags,
          transactionCount: txns.length,
          totalAmount: Number(txns.reduce((sum, t) => sum + t.amount, 0n)),
          lastActivityAt: txns[0].occurredAt,
          sampleTransaction: { id: txns[0].id, code: txns[0].code },
          /// Already under notice — the screen greys out "Raise ban" for these.
          openBan: existingBan ? { id: existingBan.id, effectiveAt: existingBan.effectiveAt } : null,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    return {
      items,
      windowHours: IRREGULAR.windowHours,
      thresholds: {
        largeAmount: Number(IRREGULAR.largeAmount),
        burstCount: IRREGULAR.burstCount,
        failureCount: IRREGULAR.failureCount,
      },
    };
  }

  // -------------------------------------------------------------------------
  // The 24-hour notice window
  // -------------------------------------------------------------------------

  async list(query: ListBansDto) {
    const where: Prisma.ScheduledBanWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.workerId ? { workerId: query.workerId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.scheduledBan.findMany({
        where,
        orderBy: [{ status: 'asc' }, { effectiveAt: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          worker: {
            select: { id: true, code: true, fullName: true, initials: true, status: true },
          },
        },
      }),
      this.prisma.scheduledBan.count({ where }),
    ]);

    return paginate(items, total, query.page, query.limit);
  }

  async findOne(id: string) {
    const ban = await this.prisma.scheduledBan.findUnique({
      where: { id },
      include: {
        worker: {
          select: {
            id: true,
            code: true,
            fullName: true,
            initials: true,
            status: true,
            phone: true,
            email: true,
          },
        },
      },
    });
    if (!ban) throw new NotFoundException('That ban notice no longer exists.');
    return ban;
  }

  /**
   * Item 8, second half — "ban korar 24h age akta notification with text".
   *
   * Nothing is suspended here. The row is written with `effectiveAt` a full
   * 24 hours out and the user is told immediately, with the notice text, so
   * they have the whole window to respond or appeal. `BansCronService` is
   * what actually suspends the account when the window runs out — which also
   * means cancelling inside the window genuinely stops the ban rather than
   * having to undo one.
   */
  async schedule(dto: ScheduleBanDto, adminId: string) {
    const worker = await this.prisma.worker.findUnique({
      where: { id: dto.workerId },
      select: { id: true, fullName: true, code: true, status: true },
    });
    if (!worker) throw new NotFoundException('That worker no longer exists.');
    if (worker.status === WorkerStatus.SUSPENDED) {
      throw new BadRequestException('This account is already suspended.');
    }

    const open = await this.prisma.scheduledBan.findFirst({
      where: { workerId: dto.workerId, status: BanStatus.SCHEDULED },
    });
    if (open) {
      throw new BadRequestException(
        'This worker already has a ban notice running. Cancel it first if the details have changed.',
      );
    }

    const effectiveAt = new Date(Date.now() + BAN_NOTICE_HOURS * 3600_000);
    const noticeText =
      dto.noticeText?.trim() ||
      `We found irregular activity on your account and it will be suspended on ` +
        `${effectiveAt.toISOString()}. Reason recorded by our review team: ${dto.reason.trim()} ` +
        `If you believe this is a mistake, reply to this message from the Help section before then.`;

    const ban = await this.prisma.scheduledBan.create({
      data: {
        workerId: dto.workerId,
        reason: dto.reason.trim(),
        noticeText,
        effectiveAt,
        triggerTransactionId: dto.triggerTransactionId ?? null,
        createdByAdminId: adminId,
      },
      include: {
        worker: { select: { id: true, code: true, fullName: true, initials: true, status: true } },
      },
    });

    await this.userNotifications.send({
      kind: UserNotificationKind.BAN_WARNING,
      workerId: dto.workerId,
      title: 'Your account will be suspended in 24 hours',
      body: noticeText,
      reason: dto.reason.trim(),
      entityType: 'ScheduledBan',
      entityId: ban.id,
      email: true,
    });

    // The admin feed gets its own copy so the window is visible to whoever is
    // on shift when it expires, not just the admin who raised it.
    await this.prisma.notification.create({
      data: {
        kind: 'FRAUD',
        title: `Ban notice raised for ${worker.fullName}`,
        body: `Takes effect ${effectiveAt.toISOString()} unless cancelled. Reason: ${dto.reason.trim()}`,
      },
    });

    await this.audit.record({
      adminId,
      action: 'worker.ban_scheduled',
      entityType: 'Worker',
      entityId: dto.workerId,
      reason: dto.reason.trim(),
      metadata: { banId: ban.id, effectiveAt: effectiveAt.toISOString() },
    });

    return ban;
  }

  async cancel(id: string, dto: CancelBanDto, adminId: string) {
    const ban = await this.findOne(id);
    if (ban.status !== BanStatus.SCHEDULED) {
      throw new BadRequestException('Only a notice that has not taken effect yet can be cancelled.');
    }

    const updated = await this.prisma.scheduledBan.update({
      where: { id },
      data: {
        status: BanStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: dto.reason?.trim() ?? null,
      },
      include: {
        worker: { select: { id: true, code: true, fullName: true, initials: true, status: true } },
      },
    });

    await this.userNotifications.send({
      kind: UserNotificationKind.BAN_CANCELLED,
      workerId: ban.workerId,
      title: 'Your account will not be suspended',
      body:
        'We reviewed the activity again and the suspension notice sent to you has been withdrawn. ' +
        'Your account stays active and no further action is needed.',
      reason: dto.reason?.trim() ?? null,
      entityType: 'ScheduledBan',
      entityId: id,
      email: true,
    });

    await this.audit.record({
      adminId,
      action: 'worker.ban_cancelled',
      entityType: 'Worker',
      entityId: ban.workerId,
      reason: dto.reason,
      metadata: { banId: id },
    });

    return updated;
  }

  /**
   * Apply a notice ahead of its window. Used by the "Ban now" action for the
   * cases where waiting is not appropriate — still goes through the same row
   * and still tells the user, so the history stays in one place.
   */
  async executeNow(id: string, adminId: string) {
    const ban = await this.findOne(id);
    if (ban.status !== BanStatus.SCHEDULED) {
      throw new BadRequestException('This notice has already been applied or cancelled.');
    }
    const updated = await this.apply(id);
    await this.audit.record({
      adminId,
      action: 'worker.ban_executed_early',
      entityType: 'Worker',
      entityId: ban.workerId,
      reason: ban.reason,
      metadata: { banId: id },
    });
    return updated;
  }

  /**
   * Shared by `executeNow` and the cron. Suspending the worker and stamping
   * the ban row happen in one transaction so a crash between them can't leave
   * a suspended worker with a notice still reading SCHEDULED (which would let
   * the cron fire the user-facing message a second time).
   */
  async apply(id: string) {
    const ban = await this.prisma.scheduledBan.findUnique({ where: { id } });
    if (!ban || ban.status !== BanStatus.SCHEDULED) return null;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.worker.update({
        where: { id: ban.workerId },
        data: { status: WorkerStatus.SUSPENDED },
      });
      return tx.scheduledBan.update({
        where: { id },
        data: { status: BanStatus.EXECUTED, executedAt: new Date() },
        include: {
          worker: { select: { id: true, code: true, fullName: true, initials: true, status: true } },
        },
      });
    });

    await this.userNotifications.send({
      kind: UserNotificationKind.BAN_APPLIED,
      workerId: ban.workerId,
      title: 'Your account has been suspended',
      body:
        'The 24-hour notice period has ended and your account is now suspended. ' +
        'You can ask for a review by replying from the Help section.',
      reason: ban.reason,
      entityType: 'ScheduledBan',
      entityId: id,
      email: true,
    });

    return updated;
  }

  /// Everything a worker has been sent about a ban — shown on their profile
  /// so an admin can see the history without hunting through the queue.
  async forWorker(workerId: string) {
    return this.prisma.scheduledBan.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
