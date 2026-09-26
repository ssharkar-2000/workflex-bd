import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TopUp } from '@prisma/client';
import {
  ApiErrorCode,
  type CreateDepositDto,
  type Deposit,
  type DepositInstructions,
  type PayoutMethod,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import type { Env } from '../config/env.schema';
import { WalletService } from './wallet.service';

/**
 * Adding money without a payment gateway.
 *
 * The person sends money to the platform's own bKash, Nagad or bank account
 * from their own app, then declares it here with the transaction id that app
 * gave them. Nothing is credited on that alone — a claim is not a payment —
 * so a deposit waits as PENDING until someone has found it on the receiving
 * account's statement and approved it in the console.
 *
 * The transaction id is unique per method in the database, so one receipt
 * cannot be declared twice, by the same person or by two.
 *
 * In development WALLET_AUTO_APPROVE_DEPOSITS credits on sight, because
 * waiting for a human makes the wallet impossible to try out. It cannot take
 * effect in production.
 */
@Injectable()
export class DepositService {
  private readonly logger = new Logger(DepositService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Where to send the money, for the add-money screen. */
  instructions(): DepositInstructions {
    const accounts: DepositInstructions['accounts'] = [];
    const name = this.config.get('WALLET_DEPOSIT_NAME', { infer: true }) ?? 'WorkFlex BD';

    const add = (method: PayoutMethod, account: string | undefined, howTo: string) => {
      if (account && account.trim()) {
        accounts.push({ method, account: account.trim(), accountName: name, howTo });
      }
    };

    add('BKASH', this.config.get('WALLET_DEPOSIT_BKASH', { infer: true }), 'Send Money');
    add('NAGAD', this.config.get('WALLET_DEPOSIT_NAGAD', { infer: true }), 'Send Money');
    add('BANK', this.config.get('WALLET_DEPOSIT_BANK', { infer: true }), 'Bank transfer');

    return { accounts };
  }

  /**
   * Declare money already sent. Answers with the deposit as it now stands:
   * PENDING, or PAID where development credits on sight.
   */
  async declare(userId: string, dto: CreateDepositDto): Promise<Deposit> {
    // A retried declaration is the same deposit arriving twice, not a second
    // one — the app sends the same requestId for both.
    const repeat = await this.prisma.topUp.findFirst({
      where: { userId, tranId: dto.requestId },
    });
    if (repeat) return this.toDeposit(repeat);

    let created: TopUp;
    try {
      created = await this.prisma.topUp.create({
        data: {
          userId,
          amount: dto.amount,
          gateway: 'manual',
          tranId: dto.requestId,
          depositMethod: dto.method,
          senderAccount: dto.senderAccount,
          reference: dto.reference,
          status: 'PENDING',
        },
      });
    } catch (err) {
      if (isDuplicate(err)) {
        throw new AppException(
          ApiErrorCode.ALREADY_PROCESSED,
          'That transaction id has already been used for a deposit',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }

    this.logger.log(
      Deposit ${created.id} declared: ${dto.amount} BDT via ${dto.method} by ${userId},
    );

    if (this.autoApproves()) {
      await this.wallet.creditTopUp(created.id, ['PENDING'], {
        reviewNote: 'Credited automatically — WALLET_AUTO_APPROVE_DEPOSITS is on',
      });
      return this.toDeposit(
        await this.prisma.topUp.findUniqueOrThrow({ where: { id: created.id } }),
      );
    }

    return this.toDeposit(created);
  }

  /** This account's deposits, newest first. */
  async list(userId: string): Promise<Deposit[]> {
    const rows = await this.prisma.topUp.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((row) => this.toDeposit(row));
  }

  async one(userId: string, id: string): Promise<Deposit> {
    const row = await this.prisma.topUp.findFirst({ where: { id, userId } });
    if (!row) {
      throw new AppException(ApiErrorCode.NOT_FOUND, 'No such deposit', HttpStatus.NOT_FOUND);
    }
    return this.toDeposit(row);
  }

  private autoApproves(): boolean {
    return (
      this.config.get('NODE_ENV', { infer: true }) !== 'production' &&
      this.config.get('WALLET_AUTO_APPROVE_DEPOSITS', { infer: true }) === true
    );
  }

  private toDeposit(row: TopUp): Deposit {
    return {
      id: row.id,
      amount: row.amount,
      status: row.status,
      method: row.depositMethod,
      senderAccount: row.senderAccount,
      reference: row.reference,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    };
  }
}

/** Postgres unique-violation, as Prisma reports it. */
function isDuplicate(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}
