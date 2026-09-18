import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { AuditLogQueryDto } from './dto/security.dto';
import { SecurityService } from './security.service';

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  constructor(private readonly security: SecurityService) {}

  @Get('overview')
  overview() {
    return this.security.overview();
  }

  @Get('audit-log')
  auditLog(@Query() query: AuditLogQueryDto) {
    return this.security.auditLog(query);
  }

  @Get('sessions')
  sessions() {
    return this.security.sessions();
  }

  @Post('sessions/:id/revoke')
  revoke(@Param('id') id: string, @CurrentUser() admin: { id: string }) {
    return this.security.revokeSession(id, admin.id);
  }
}
