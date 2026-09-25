import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { CreateMaintenanceDto, UpdateSettingDto } from './dto/system.dto';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('health')
  health() {
    return this.system.health();
  }

  @Get('settings')
  settings() {
    return this.system.settings();
  }

  @Patch('settings/:key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() admin: { id: string },
  ) {
    return this.system.updateSetting(key, dto.value, admin.id);
  }

  @Get('maintenance')
  listMaintenance() {
    return this.system.listMaintenance();
  }

  @Post('maintenance')
  scheduleMaintenance(@Body() dto: CreateMaintenanceDto, @CurrentUser() admin: { id: string }) {
    return this.system.scheduleMaintenance(dto, admin.id);
  }

  @Delete('maintenance/:id')
  cancelMaintenance(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.system.cancelMaintenance(id, admin.id);
  }
}
