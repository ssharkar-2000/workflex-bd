import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateSubscriptionDto, ListSubscriptionsDto, UpdateSubscriptionDto } from './dto/subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

type Admin = { id: string };

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  list(@Query() query: ListSubscriptionsDto) {
    return this.subscriptions.list(query);
  }

  @Get('summary')
  summary() {
    return this.subscriptions.summary();
  }

  @Post()
  create(@Body() dto: CreateSubscriptionDto, @CurrentUser() admin: Admin) {
    return this.subscriptions.create(dto, admin.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto, @CurrentUser() admin: Admin) {
    return this.subscriptions.update(id, dto, admin.id);
  }
}
