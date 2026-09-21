import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from '../common/mail.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * "System maintenance shuru howar 1 hour / 30 min age notification jabe."
 *
 * Runs every minute, looks for MaintenanceWindow rows whose `scheduledAt`
 * falls in the next 55-65 minute band (still not 60-min-notified) or the
 * next 25-35 minute band (still not 30-min-notified), and for each one:
 *   1. writes a Notification row (shows up in the app's Notifications feed)
 *   2. emails every admin via MailService
 *   3. stamps notified60At/notified30At so the same window never fires twice
 *
 * The ±5 minute bands (rather than an exact 60/30) exist because this cron
 * only ticks once a minute — checking for an exact match could skip a window
 * if the process was busy on the tick that would have matched.
 */
@Injectable()
export class MaintenanceCronService {
  private readonly logger = new Logger(MaintenanceCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkUpcomingMaintenance() {
    await this.notifyWindow({
      field: 'notified60At',
      minMinutes: 55,
      maxMinutes: 65,
      label: '1 hour',
    });
    await this.notifyWindow({
      field: 'notified30At',
      minMinutes: 25,
      maxMinutes: 35,
      label: '30 minutes',
    });
  }

  private async notifyWindow(opts: {
    field: 'notified60At' | 'notified30At';
    minMinutes: number;
    maxMinutes: number;
    label: string;
  }) {
    const now = Date.now();
    const from = new Date(now + opts.minMinutes * 60_000);
    const to = new Date(now + opts.maxMinutes * 60_000);

    const windows = await this.prisma.maintenanceWindow.findMany({
      where: {
        cancelledAt: null,
        [opts.field]: null,
        scheduledAt: { gte: from, lte: to },
      },
    });

    for (const window of windows) {
      const title = `Maintenance in ${opts.label}: ${window.title}`;
      const body = window.message ?? `Scheduled at ${window.scheduledAt.toISOString()}.`;

      await this.prisma.notification.create({
        data: { kind: 'MAINTENANCE', title, body },
      });

      const admins = await this.prisma.adminUser.findMany({ select: { email: true } });
      await this.mail.send(
        admins.map((a) => a.email),
        title,
        `${body}\n\nScheduled time: ${window.scheduledAt.toISOString()}`,
      );

      await this.prisma.maintenanceWindow.update({
        where: { id: window.id },
        data: { [opts.field]: new Date() },
      });

      this.logger.log(`Sent "${opts.label}" maintenance notice for window ${window.id}`);
    }
  }
}
