import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { ComplaintsService } from './complaints.service';
import { ListComplaintsDto, UpdateComplaintDto } from './dto/complaint.dto';

@Controller('complaints')
@UseGuards(JwtAuthGuard)
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  list(@Query() query: ListComplaintsDto) {
    return this.complaints.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.complaints.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateComplaintDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.complaints.update(id, dto, admin.id);
  }
}
