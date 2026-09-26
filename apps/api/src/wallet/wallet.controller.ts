import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { Request } from 'express';
import {
  createDepositSchema,
  createTopUpSchema,
  createPaymentSchema,
  createTransferSchema,
  createWithdrawalSchema,
  insightsRangeSchema,
  payForJobSchema,
  type CreateDepositDto,
  type CreatePaymentDto,
  type CreateTransferDto,
  type CreateWithdrawalDto,
  type CreateTopUpDto,
  type PayForJobDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DepositService } from './deposit.service';
import { TopUpService } from './top-up.service';
import { WalletService } from './wallet.service';

const statementQuerySchema = z.object({ cursor: z.string().uuid().optional() });
type StatementQuery = z.output<typeof statementQuerySchema>;

const resolveQuerySchema = z.object({ code: z.string().trim().min(6).max(200) });
type ResolveQuery = z.output<typeof resolveQuerySchema>;

const insightsQuerySchema = z.object({ range: insightsRangeSchema.default('M') });
type InsightsQuery = z.output<typeof insightsQuerySchema>;

/** Payments arriving after the moment the app last announced one. */
const receiptsQuerySchema = z.object({ since: z.string().datetime().optional() });
type ReceiptsQuery = z.output<typeof receiptsQuerySchema>;

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly deposits: DepositService,
    private readonly topUps: TopUpService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Balance, the withdrawable part, and what is on its way out' })
  async summary(@CurrentUser('userId') userId: string) {
    return this.wallet.summary(userId);
  }

  @Get('statement')
  @ApiOperation({ summary: 'The ledger, newest first' })
  async statement(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(statementQuerySchema)) query: StatementQuery,
  ) {
    return this.wallet.statement(userId, query.cursor);
  }

  @Post('top-ups')
  @ApiOperation({ summary: 'Start adding money; returns the gateway page to open' })
  async createTopUp(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createTopUpSchema)) dto: CreateTopUpDto,
    @Req() req: Request,
  ) {
    return this.topUps.create(userId, dto, `${req.protocol}://${req.get('host')}/api/v1`);
  }

  @Get('top-ups/:id')
  @ApiOperation({ summary: 'Where a top-up has got to; asks the gateway if still pending' })
  async topUp(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.topUps.get(userId, id);
  }

  @Get('deposit-accounts')
  @ApiOperation({ summary: 'Where to send money to add it to the wallet' })
  depositAccounts() {
    return this.deposits.instructions();
  }

  @Post('deposits')
  @ApiOperation({ summary: 'Declare money already sent to one of those accounts' })
  async declareDeposit(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createDepositSchema)) dto: CreateDepositDto,
  ) {
    return this.deposits.declare(userId, dto);
  }

  @Get('deposits')
  @ApiOperation({ summary: 'Deposits declared by this account, newest first' })
  async myDeposits(@CurrentUser('userId') userId: string) {
    return { deposits: await this.deposits.list(userId) };
  }

  @Get('deposits/:id')
  @ApiOperation({ summary: 'Where one declared deposit has got to' })
  async deposit(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deposits.one(userId, id);
  }

  @Get('code')
  @ApiOperation({ summary: 'This wallet as a QR payload and a short code' })
  async code(@CurrentUser('userId') userId: string) {
    return this.wallet.code(userId);
  }

  @Get('resolve')
  @ApiOperation({ summary: 'Who a scanned code, account id or phone number belongs to' })
  async resolve(@Query(new ZodValidationPipe(resolveQuerySchema)) query: ResolveQuery) {
    return this.wallet.resolve(query.code);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Income, spending and top-ups over a day, week, month or year' })
  async insights(
    @CurrentUser('userId') userId: string,
    @Query(new ZodValidationPipe(insightsQuerySchema)) query: InsightsQuery,
  ) {
    return this.wallet.insights(userId, query.range);
  }

  @Post('job-payments')
  @ApiOperation({ summary: 'Pay someone for a job, by their id, number and job id' })
  async payForJob(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(payForJobSchema)) dto: PayForJobDto,
  ) {
    return this.wallet.payForJob(userId, dto);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Money paid in since a moment, for the app to announce
