import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { subscribeSchema, type SubscribeDto } from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get('me')
  @ApiOperation({ summary: 'The plans on offer, and where this account stands' })
  async state(@CurrentUser('userId') userId: string) {
    return this.subscriptions.state(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Buy a plan, paid from the wallet balance' })
  async subscribe(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(subscribeSchema)) dto: SubscribeDto,
  ) {
    return this.subscriptions.subscribe(userId, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Stop a plan renewing; it runs to its end date' })
  async cancel(
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subscriptions.cancel(userId, id);
  }
}
