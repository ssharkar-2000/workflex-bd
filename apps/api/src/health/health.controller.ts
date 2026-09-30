import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Is the process up — and nothing else.
   *
   * This is what the host's health check and any uptime pinger call, every
   * few seconds or minutes, forever. It deliberately does not touch the
   * database: Neon's free compute sleeps after five idle minutes, and a
   * check that queried it would keep it awake around the clock and spend
   * the month's free compute hours on nobody.
   */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness only — never touches the database' })
  live() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + database reachability' })
  async check() {
    const dbUp = await this.prisma.ping();
    return {
      status: dbUp ? 'ok' : 'degraded',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database: dbUp ? 'up' : 'down' },
    };
  }
}
