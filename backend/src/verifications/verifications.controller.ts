import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ListVerificationsDto, ReviewVerificationDto } from './dto/verification.dto';
import { VerificationsService } from './verifications.service';

type Admin = { id: string };

@Controller('verifications')
@UseGuards(JwtAuthGuard)
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}

  @Get()
  list(@Query() query: ListVerificationsDto) {
    return this.verifications.list(query);
  }

  @Get('pending-by-type')
  pendingByType() {
    return this.verifications.pendingByType();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.verifications.findOne(id);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto,
    @CurrentUser() admin: Admin,
  ) {
    return this.verifications.review(id, VerificationStatus.APPROVED, admin.id, dto.note);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: ReviewVerificationDto,
    @CurrentUser() admin: Admin,
  ) {
    return this.verifications.review(id, VerificationStatus.REJECTED, admin.id, dto.note);
  }
}
