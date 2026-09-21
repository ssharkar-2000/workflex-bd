import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BanStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BansService } from './bans.service';

/**
 * Item 8 — the half of the flow that runs without an admin present.
 *
 * `BansService.schedule()` only writes a notice and tells the user; nothing
 * is suspended at that moment. This ticks every minute, finds notices whose
 * 24-hour window has run out and are still SCHEDULED, and applies them. Any
 * notice cancelled inside the window is no longer SCHEDULED, so it is simply
 * never picked up.
 *
 * Catching up on missed windows is intentional: `effectiveAt: { lte: now }`
 * has no lower bound, so if the server was down over a window the ban still
 * applies on the next tick rather than being skipped silently.
 */
@Injectable()
export class BansCronService {
  private readonly logger = new Logger(BansCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bans: BansService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async applyDueBans() {
    const due = await this.prisma.scheduledBan.findMany({
      where: { status: BanStatus.SCHEDULED, effectiveAt: { lte: new Date() } },
      select: { id: true, workerId: true },
    });

    for (const ban of due) {
      try {
        await this.bans.apply(ban.id);
        this.logger.log(`Applied ban ${ban.id} for worker ${ban.workerId}.`);
      } catch (err) {
        // One bad row must not stop the rest of the queue from being applied.
        this.logger.error(`Could not apply ban ${ban.id}: ${(err as Error).message}`);
      }
    }
  }
}
