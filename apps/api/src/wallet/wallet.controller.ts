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
import type { Request } from 'express';
import { z } from 'zod';
import {
  createPaymentSchema,
  createTopUpSchema,
  createWithdrawalSchema,
  type CreatePaymentDto,
  type CreateTopUpDto,
  type CreateWithdrawalDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { TopUpService } from './top-up.service';
import { WalletService } from './wallet.service';

const statementQuerySchema = z.object({ cursor: z.string().uuid().optional() });
type StatementQuery = z.output<typeof statementQuerySchema>;

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
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
