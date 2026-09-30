import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import type { Subscription as SubscriptionRow } from '@prisma/client';
import {
  ApiErrorCode,
  SUBSCRIPTION_PLANS,
  type SubscribeDto,
  type Subscription,
  type SubscriptionState,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { WalletService } from '../wallet/wallet.service';

/**
 * Paid plans, bought from the wallet.
 *
 * The money comes out of the balance the account already holds rather than
 * through a second checkout: the wallet is this system's own ledger, so a
 * subscription is one debit and one row, and it either happens or it does
 * not. A card charge here would mean a payment that can succeed while the
 * subscription fails to record.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
  ) {}

  async state(userId: string): Promise<SubscriptionState> {
    const rows = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    return {
      current: this.currentOf(rows),
      history: rows.map(toSubscription),
      plans: (['MONTHLY', 'YEARLY', 'LIFETIME'] as const).map((plan) => ({
        plan,
        price: SUBSCRIPTION_PLANS[plan].price,
        days: SUBSCRIPTION_PLANS[plan].days,
      })),
    };
  }

  /**
   * Buy a plan.
   *
   * Refuses while one is still running: someone who wants to change plan
   * should not silently pay twice over the same fortnight, and someone whose
   * plan is about to lapse loses nothing by buying on the day it does.
   */
  async subscribe(userId: string, dto: SubscribeDto): Promise<Subscription> {
    const existing = await this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    if (this.currentOf(existing)) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'This account already has a plan running',
        HttpStatus.CONFLICT,
      );
    }

    const { price, days } = SUBSCRIPTION_PLANS[dto.plan];

    // Paid to the platform, so the money leaves the wallet through the same
    // ledger every other payment uses — see WalletService.chargeToPlatform.
    const charge = await this.wallet.chargeToPlatform(userId, {
      amount: price,
      reason: `Subscription: ${dto.plan}`,
    });

    const expiresAt = days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;

    const created = await this.prisma.subscription.create({
      data: {
        userId,
        plan: dto.plan,
        price,
        expiresAt,
        paymentId: charge.id,
      },
    });

    this.logger.log(`Subscription ${created.id}: ${dto.plan} for ${userId}`);
    return toSubscription(created);
  }

  /** Stop a plan renewing. What was paid for still runs to its end date. */
  async cancel(userId: string, id: string): Promise<Subscription> {
    const row = await this.prisma.subscription.findFirst({ where: { id, userId } });
    if (!row) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such subscription', HttpStatus.NOT_FOUND);
    }
    if (row.status !== 'ACTIVE') return toSubscription(row);

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    return toSubscription(updated);
  }

  /**
   * The one in force: active, and either without an end date or with one
   * still ahead. Decided here rather than by a scheduled job, so a lapsed
   * plan reads as lapsed the moment it lapses.
   */
  private currentOf(rows: SubscriptionRow[]): Subscription | null {
    const now = Date.now();
    const live = rows.find(
      (row) =>
        row.status === 'ACTIVE' && (!row.expiresAt || row.expiresAt.getTime() > now),
    );
    return live ? toSubscription(live) : null;
  }
}

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    plan: row.plan,
    status: row.status,
    price: row.price,
    startedAt: row.startedAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
  };
}
