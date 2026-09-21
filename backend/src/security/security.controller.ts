import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaginationDto } from '../common/pagination.dto';
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
  auditLog(@Query() query: PaginationDto) {
    return this.security.auditLog(query);
  }

  @Get('sessions')
  sessions() {
    return this.security.sessions();
  }

  @Post('sessions/:id/revoke')
  revoke(@Param('id') id: string) {
    return this.security.revokeSession(id);
  }
}
