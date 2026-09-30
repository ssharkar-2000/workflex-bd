import { staffingOf, type JobStaffing } from '@workflex/shared';
import type { PrismaService } from '../common/prisma/prisma.service';

export interface Staffing {
  /** Hired, still on the job, and available. */
  working: number;
  /** Hired, flagged unavailable, and not yet replaced. */
  unavailable: number;
  staffing: JobStaffing;
}

/**
 * How full each job is, worked out from its hires.
 *
 * One query for any number of jobs. Nothing here is stored — see
 * `jobStaffingSchema` for why a stored status would drift.
 */
export async function loadStaffing(
  prisma: PrismaService,
  jobs: { id: string; vacancies: number | null }[],
): Promise<Map<string, Staffing>> {
  const result = new Map<string, Staffing>();
  if (jobs.length === 0) return result;

  const rows = await prisma.jobApplication.findMany({
    where: { jobId: { in: jobs.map((job) => job.id) }, status: 'ACCEPTED', completedAt: null },
    select: { jobId: true, unavailableAt: true },
  });

  const counts = new Map<string, { working: number; unavailable: number }>();
  for (const row of rows) {
    const held = counts.get(row.jobId) ?? { working: 0, unavailable: 0 };
    if (row.unavailableAt) held.unavailable += 1;
    else held.working += 1;
    counts.set(row.jobId, held);
  }

  for (const job of jobs) {
    const held = counts.get(job.id) ?? { working: 0, unavailable: 0 };
    result.set(job.id, { ...held, staffing: staffingOf({ vacancies: job.vacancies, ...held }) });
  }
  return result;
}
