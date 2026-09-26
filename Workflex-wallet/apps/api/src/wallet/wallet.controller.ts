import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  createDepositSchema,
  createPaymentSchema,
  createTransferSchema,
  createWithdrawalSchema,
  type CreateDepositDto,
  type CreatePaymentDto,
  type CreateTransferDto,
  type CreateWithdrawalDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DepositService } from './deposit.service';
import { WalletService } from './wallet.service';

const statementQuerySchema = z.object({ cursor: z.string().uuid().optional() });
type StatementQuery = z.output<typeof statementQuerySchema>;

const resolveQuerySchema = z.object({ code: z.string().trim().min(6).max(200) });
type ResolveQuery = z.output<typeof resolveQuerySchema>;

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly deposits: DepositService,
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

  @Post('transfers')
  @ApiOperation({ summary: 'Send money to another account, by scanned code or number' })
  async transfer(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createTransferSchema)) dto: CreateTransferDto,
  ) {
    return this.wallet.transfer(userId, dto);
  }

  @Get('payees')
  @ApiOperation({ summary: 'People hired on your postings, and what each has been paid' })
  async payees(@CurrentUser('userId') userId: string) {
    return this.wallet.payees(userId);
  }

  @Post('payments')
  @ApiOperation({ summary: 'Pay someone you hired' })
  async pay(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) dto: CreatePaymentDto,
  ) {
    return this.wallet.pay(userId, dto);
  }

  @Post('withdrawals')
  @ApiOperation({ summary: 'Ask for earnings to be sent to bKash, Nagad or a bank' })
  async withdraw(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createWithdrawalSchema)) dto: CreateWithdrawalDto,
  ) {
    return this.wallet.withdraw(userId, dto);
  }

  @Post('withdrawals/:id/cancel')
  @ApiOperation({ summary: 'Call off a withdrawal that has not been sent' })
  async cancelWithdrawal(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wallet.cancelWithdrawal(userId, id);
  }
}
