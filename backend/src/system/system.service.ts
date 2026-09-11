import { Injectable, NotFoundException } from '@nestjs/common';
import { SettingType } from '@prisma/client';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/// Values are stored as text; this restores the declared type on the way out so
/// the client gets a real boolean or number rather than "true" / "12".
function coerce(value: string, type: SettingType): string | number | boolean {
  if (type === SettingType.BOOLEAN) return value === 'true';
  if (type === SettingType.NUMBER) return Number(value);
  return value;
}

@Injectable()
export class SystemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async settings() {
    const rows = await this.prisma.systemSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });

    const groups = new Map<string, unknown[]>();
    for (const row of rows) {
      const list = groups.get(row.group) ?? [];
      list.push({
        key: row.key,
        value: coerce(row.value, row.valueType),
        valueType: row.valueType,
        label: row.label,
        description: row.description,
      });
      groups.set(row.group, list);
    }

    return [...groups].map(([group, settings]) => ({ group, settings }));
  }

  async updateSetting(key: string, value: string, adminId: string) {
    const existing = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (!existing) throw new NotFoundException('That setting does not exist.');

    const row = await this.prisma.systemSetting.update({ where: { key }, data: { value } });
    await this.audit.record({
      adminId,
      action: 'system.setting.update',
      entityType: 'SystemSetting',
      entityId: key,
      metadata: { from: existing.value, to: value },
    });

    return { key: row.key, value: coerce(row.value, row.valueType), valueType: row.valueType };
  }

  /// Health panel on the System Management screen.
  async health() {
    const startedAt = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startedAt;

    const [workers, jobs, transactions, alerts] = await this.prisma.$transaction([
      this.prisma.worker.count(),
      this.prisma.job.count(),
      this.prisma.transaction.count(),
      this.prisma.alert.count(),
    ]);

    return {
      database: { reachable: true, latencyMs: dbLatencyMs },
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      rowCounts: { workers, jobs, transactions, alerts },
    };
  }
}
