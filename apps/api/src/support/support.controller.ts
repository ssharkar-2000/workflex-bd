import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  createSupportTicketSchema,
  type CreateSupportTicketDto,
} from '@workflex/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Get('tickets')
  @ApiOperation({ summary: "The signed-in account's own tickets" })
  async mine(@CurrentUser('userId') userId: string) {
    return this.support.mine(userId);
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Raise a support request' })
  async create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createSupportTicketSchema))
    dto: CreateSupportTicketDto,
  ) {
    return this.support.create(userId, dto);
  }
}
