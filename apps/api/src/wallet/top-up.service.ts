import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TopUp } from '@prisma/client';
import {
  ApiErrorCode,
  resolvePlace,
  type CreateTopUpDto,
  type TopUp as TopUpDto,
  type TopUpSession,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import type { Env } from '../config/env.schema';
import { PAYMENT_GATEWAY, type PaymentGateway } from './gateway/payment-gateway';
import { isAllowedReturnUrl, parseWebOrigins } from './return-url';
import { displayName, WalletService } from './wallet.service';

/** Statuses a confirmed payment may still settle from. See `settle`. */
const SETTLEABLE = ['PENDING', 'FAILED', 'CANCELLED'] as const;

/** How often one top-up may ask the gateway about itself. */
const RECHECK_MS = 5_000;

/** How long a failed or cancelled top-up is still worth re-checking. */
const RECHECK_UNPAID_MS = 60 * 60_000;

/**
 * Adding money through the payment gateway.
 *
 * The rule the whole flow is built around: nothing the payer's browser or
 * the gateway's callback says is believed on its own. Both can be forged —
 * the success URL is public, anyone can post "status=VALID" to it — so a
 * callback only ever *prompts* a check, and the check is the gateway's
 * Validation API answering with its own record of the payment, which must
 * name this top-up's reference, amount and currency before a taka is
 * credited.
 */
@Injectable()
export class TopUpService {
  private readonly logger = new Logger(TopUpService.name);
  private readonly lastChecked = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway | null,
  ) {}

  /**
   * Opens a payment and returns the gateway page to send the person to.
   *
   * `requestBase` is this request's own /api/v1 address, used for the
   * gateway's callbacks when API_PUBLIC_URL is not set (development only —
   * production requires it).
   */
  async create(
    userId: string,
    dto: CreateTopUpDto,
    requestBase: string,
  ): Promise<TopUpSession> {
    const gateway = this.gateway;
    if (!gateway) {
      throw new AppException(
        ApiErrorCode.PAYMENT_GATEWAY_UNAVAILABLE,
        'Adding money is switched off on this server (PAYMENT_PROVIDER=off)',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const rules = {
      production: this.config.get('NODE_ENV', { infer: true }) === 'production',
      webOrigins: parseWebOrigins(this.config.get('APP_WEB_ORIGINS', { infer: true })),
    };
    if (!isAllowedReturnUrl(dto.returnUrl, rules)) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That return address is not one this app uses',
        HttpStatus.UNPROCESSABLE_ENTITY,
        { fieldErrors: { returnUrl: ['That return address is not one this app uses'] } },
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        address: true,
      },
    });
    if (!user) throw AppException.notFound('No such account');

    const topUp = await this.prisma.topUp.create({
      data: {
        userId,
        amount: dto.amount,
        gateway: gateway.name,
        tranId: newTranId(),
        returnUrl: dto.returnUrl,
      },
    });

    const base = this.publicBase(requestBase);
    try {
      const session = await gateway.createSession({
        tranId: topUp.tranId,
        amount: topUp.amount,
        customer: {
          name: displayName(user),
          // The gateway insists on an email and most people here have none.
          // The platform's own sending address stands in: receipts then reach
          // an inbox we control instead of bouncing off an invented one.
          email: user.email ?? this.fallbackEmail(),
          phone: user.phone,
          address: user.address?.trim() || 'Bangladesh',
          city: resolvePlace(user.address)?.name ?? 'Bangladesh',
        },
        callbacks: {
          success: `${base}/payments/sslcommerz/success`,
          fail: `${base}/payments/sslcommerz/fail`,
          cancel: `${base}/payments/sslcommerz/cancel`,
          ipn: `${base}/payments/sslcommerz/ipn`,
        },
        publicBaseUrl: base,
      });

      this.logger.log(`Top-up ${topUp.id}: ${topUp.amount} BDT opened at ${gateway.name}`);
      return { id: topUp.id, gatewayUrl: session.gatewayUrl };
    } catch (err) {
      this.logger.error(
        { err: (err as Error).message, topUpId: topUp.id },
        'Gateway would not open a payment',
      );
      await this.prisma.topUp.update({
        where: { id: topUp.id },
        data: { status: 'FAILED', completedAt: new Date() },
      });
      throw new AppException(
        ApiErrorCode.PAYMENT_GATEWAY_UNAVAILABLE,
        'The payment gateway could not be reached',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * One of the person's own top-ups. Still-pending ones ask the gateway
   * first, which is how a payment settles when its callback never arrived.
   */
  async get(userId: string, id: string): Promise<TopUpDto> {
    const topUp = await this.prisma.topUp.findFirst({ where: { id, userId } });
    if (!topUp) throw AppException.notFound('No such top-up');

    // Recent failures are asked about too. FAILED and CANCELLED come from
    // callbacks, which can be forged; if the real payment went through and
    // its IPN was lost, this is the only other way it gets credited.
    const recentlyUnpaid =
      (topUp.status === 'FAILED' || topUp.status === 'CANCELLED') &&
      Date.now() - topUp.createdAt.getTime() < RECHECK_UNPAID_MS;

    if (topUp.status === 'PENDING' || recentlyUnpaid) {
      await this.reconcile(topUp);
      return this.toDto(await this.prisma.topUp.findUniqueOrThrow({ where: { id } }));
    }
    return this.toDto(topUp);
  }

  /**
   * The payer's browser, back from the gateway.
   *
   * Returns the top-up it concerns, re-read after settling, or null when the
   * callback names a reference this API never issued.
   */
  async handleReturn(
    kind: 'success' | 'fail' | 'cancel',
    body: Record<string, unknown>,
  ): Promise<TopUp | null> {
    const tranId = field(body, 'tran_id');
    const topUp = tranId
      ? await this.prisma.topUp.findUnique({ where: { tranId } })
      : null;
    if (!topUp) {
      this.logger.warn(`Gateway return (${kind}) for unknown reference ${tranId ?? '-'}`);
      return null;
    }

    const valId = field(body, 'val_id');
    if (kind === 'success' && valId) {
      await this.settle(topUp, valId);
    } else if (kind === 'success') {
      // A success without a val_id is not something the gateway sends. Ask
      // it directly rather than guess.
      await this.reconcile(topUp, true);
    } else {
      await this.markUnpaid(topUp, kind === 'fail' ? 'FAILED' : 'CANCELLED');
    }

    return this.prisma.topUp.findUnique({ where: { id: topUp.id } });
  }

  /**
   * The gateway's server-to-server notice (IPN). The payer's browser may
   * never make it back — a closed tab, a dead battery — and this is what
   * credits the wallet anyway.
   */
  async handleIpn(body: Record<string, unknown>): Promise<void> {
    const tranId = field(body, 'tran_id');
    const topUp = tranId
      ? await this.prisma.topUp.findUnique({ where: { tranId } })
      : null;
    if (!topUp) {
      this.logger.warn(`IPN for unknown reference ${tranId ?? '-'}`);
      return;
    }

    const status = field(body, 'status')?.toUpperCase();
    const valId = field(body, 'val_id');
    if ((status === 'VALID' || status === 'VALIDATED') && valId) {
      await this.settle(topUp, valId);
    } else if (status === 'FAILED' || status === 'CANCELLED') {
      await this.markUnpaid(topUp, status);
    }
  }

  // --- settling ---

  /**
   * Credits the wallet if — and only if — the gateway itself confirms a
   * payment for this top-up's reference, amount and currency.
   *
   * A confirmed payment settles even from FAILED or CANCELLED: those two
   * statuses come from callbacks, which anyone can forge, so they must never
   * be able to cancel money the gateway says was paid.
   */
  private async settle(topUp: TopUp, valId: string): Promise<void> {
    const gateway = this.gatewayFor(topUp);
    if (!gateway) return;

    let payment;
    try {
      payment = await gateway.validate(valId);
    } catch (err) {
      // Left pending. The next look at it — the app polling, or the IPN —
      // asks again.
      this.logger.error(
        { err: (err as Error).message, topUpId: topUp.id },
        'Could not validate a payment with the gateway',
      );
      return;
    }

    if (!payment || payment.status !== 'VALID') {
      this.logger.warn(`Top-up ${topUp.id}: gateway does not confirm val_id ${valId}`);
      return;
    }
    // A real val_id from some other payment, posted against this reference.
    if (payment.tranId !== topUp.tranId) {
      this.logger.error(
        `Top-up ${topUp.id}: val_id ${valId} belongs to ${payment.tranId}, not ${topUp.tranId}`,
      );
      return;
    }

    const details = {
      valId: payment.valId,
      bankTranId: payment.bankTranId,
      method: payment.cardType,
      riskLevel: payment.riskLevel,
      riskTitle: payment.riskTitle,
    };

    const amountMatches =
      payment.currency?.toUpperCase() === 'BDT' &&
      payment.amount !== null &&
      Math.abs(payment.amount - topUp.amount) < 0.005;

    if (!amountMatches || payment.riskLevel === 1) {
      // Paid, but not creditable as it stands. A person decides.
      const held = await this.prisma.topUp.updateMany({
        where: { id: topUp.id, status: { in: [...SETTLEABLE] } },
        data: {
          ...details,
          status: 'HELD',
          completedAt: new Date(),
          reviewNote: amountMatches
            ? null
            : `Gateway reported ${payment.amount ?? '?'} ${payment.currency ?? '?'}; expected ${topUp.amount} BDT`,
        },
      });
      if (held.count > 0) {
        this.logger.warn(
          `Top-up ${topUp.id} held for review: ${amountMatches ? 'flagged risky' : 'amount mismatch'}`,
        );
      }
      return;
    }

    await this.wallet.creditTopUp(topUp.id, [...SETTLEABLE], details);
    this.lastChecked.delete(topUp.id);
  }

  /**
   * Asks the gateway about every attempt against this reference.
   *
   * Throttled per top-up, because the app polls while it waits and each poll
   * would otherwise become a call to the gateway.
   */
  private async reconcile(topUp: TopUp, force = false): Promise<void> {
    const gateway = this.gatewayFor(topUp);
    if (!gateway) return;

    const last = this.lastChecked.get(topUp.id) ?? 0;
    if (!force && Date.now() - last < RECHECK_MS) return;
    this.lastChecked.set(topUp.id, Date.now());

    let attempts;
    try {
      attempts = await gateway.findByTranId(topUp.tranId);
    } catch (err) {
      this.logger.error(
        { err: (err as Error).message, topUpId: topUp.id },
        'Could not ask the gateway about a pending top-up',
      );
      return;
    }

    const paid = attempts.find((a) => a.status === 'VALID' && a.valId);
    if (paid?.valId) {
      await this.settle(topUp, paid.valId);
      return;
    }

    if (
      attempts.length > 0 &&
      attempts.every((a) => a.status === 'FAILED' || a.status === 'CANCELLED')
    ) {
      await this.markUnpaid(
        topUp,
        attempts.some((a) => a.status === 'CANCELLED') ? 'CANCELLED' : 'FAILED',
      );
    }
  }

  /** Records a failed or cancelled attempt. Only ever moves a PENDING top-up. */
  private async markUnpaid(topUp: TopUp, status: 'FAILED' | 'CANCELLED'): Promise<void> {
    await this.prisma.topUp.updateMany({
      where: { id: topUp.id, status: 'PENDING' },
      data: { status, completedAt: new Date() },
    });
  }

  /**
   * The gateway that issued this top-up. A payment opened on one gateway is
   * never checked against another — a top-up started on the simulator stays
   * unsettled on a server switched to SSLCommerz, rather than being
   * validated by a gateway that never saw it.
   */
  private gatewayFor(topUp: TopUp): PaymentGateway | null {
    return this.gateway && this.gateway.name === topUp.gateway ? this.gateway : null;
  }

  private publicBase(requestBase: string): string {
    const configured = this.config.get('API_PUBLIC_URL', { infer: true });
    return (configured ?? requestBase).replace(/\/+$/, '');
  }

  /** The address part of MAIL_FROM — "no-reply@workflex.com.bd". */
  private fallbackEmail(): string {
    const from = this.config.get('MAIL_FROM', { infer: true });
    return /<([^>]+)>/.exec(from)?.[1] ?? from;
  }

  toDto(topUp: TopUp): TopUpDto {
    return {
      id: topUp.id,
      amount: topUp.amount,
      status: topUp.status,
      method: topUp.method,
      createdAt: topUp.createdAt.toISOString(),
      completedAt: topUp.completedAt?.toISOString() ?? null,
    };
  }
}

/**
 * Our reference at the gateway: "WF" and 20 hex characters.
 *
 * SSLCommerz caps tran_id at 30 characters, which rules out a UUID with its
 * dashes. Random rather than sequential, so one reference says nothing about
 * how many others exist.
 */
function newTranId(): string {
  return `WF${randomBytes(10).toString('hex').toUpperCase()}`;
}

/** A text field from a form-encoded callback body. */
function field(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}
