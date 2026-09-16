import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  payWithdrawalSchema,
  topUpStatusSchema,
  walletRejectSchema,
  withdrawalStatusSchema,
  type PayWithdrawalDto,
  type WalletRejectDto,
} from '@workflex/shared';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { WalletAdminService } from './wallet-admin.service';
import { WalletService } from './wallet.service';

// "ALL", or absent, lists every status.
const withdrawalQuerySchema = z.object({
  status: withdrawalStatusSchema.or(z.literal('ALL')).optional(),
});
const topUpQuerySchema = z.object({
  status: topUpStatusSchema.or(z.literal('ALL')).optional(),
});

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/wallet')
export class WalletAdminController {
  constructor(
    private readonly admin: WalletAdminService,
    private readonly wallet: WalletService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Money held, the withdrawal queue, and the last 30 days' })
  async summary() {
    return this.admin.summary();
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Withdrawals, by status' })
  async withdrawals(
    @Query(new ZodValidationPipe(withdrawalQuerySchema))
    query: z.output<typeof withdrawalQuerySchema>,
  ) {
    return this.admin.withdrawals(query.status === 'ALL' ? undefined : query.status);
  }

  @Post('withdrawals/:id/paid')
  @HttpCode(200)
  @ApiOperation({ summary: 'Record that a withdrawal was sent' })
  async markPaid(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(payWithdrawalSchema)) dto: PayWithdrawalDto,
  ) {
    return this.wallet.markWithdrawalPaid(id, adminId, dto.reference);
  }

  @Post('withdrawals/:id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Turn a withdrawal down; the money goes back to the wallet' })
  async rejectWithdrawal(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(walletRejectSchema)) dto: WalletRejectDto,
  ) {
    return this.wallet.rejectWithdrawal(id, adminId, dto.reason);
  }

  @Get('top-ups')
  @ApiOperation({ summary: 'Top-ups, by status' })
  async topUps(
    @Query(new ZodValidationPipe(topUpQuerySchema))
    query: z.output<typeof topUpQuerySchema>,
  ) {
    return this.admin.topUps(query.status === 'ALL' ? undefined : query.status);
  }

  @Post('top-ups/:id/approve')
  @HttpCode(200)
  @ApiOperation({ summary: 'Credit a held top-up after checking it' })
  async approveTopUp(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.admin.approveTopUp(id, adminId);
    return { ok: true };
  }

  @Post('top-ups/:id/reject')
  @HttpCode(200)
  @ApiOperation({ summary: 'Turn a held top-up down; refund it from the gateway panel' })
  async rejectTopUp(
    @CurrentUser('userId') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(walletRejectSchema)) dto: WalletRejectDto,
  ) {
    await this.admin.rejectTopUp(id, adminId, dto.reason);
    return { ok: true };
  }
}
