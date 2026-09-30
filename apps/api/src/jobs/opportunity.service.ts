import { Injectable } from '@nestjs/common';
import type { JobCategory } from '@prisma/client';
import { DIVISION_BY_KEY, divisionOf, type Division, type OpportunityResponse } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/** Below this many postings there is no headline worth printing. */
const MIN_JOBS = 3;

/**
 * "High demand for X workers in Y" — the one line above the recommendations.
 *
 * Both figures are counts of rows that exist: open postings in a category in
 * this person's division, and accounts in the same division whose CV points
 * at that category. The card claims high demand only when the first clearly
 * outnumbers the second, which is a claim those two numbers support.
 *
 * It returns null rather than reaching for something to say. A banner that
 * always finds an opportunity is a banner people stop reading by the third
 * day, and the one time it matters they will not see it either.
 */
@Injectable()
export class OpportunityService {
  constructor(private readonly prisma: PrismaService) {}

  async nearby(userId: string): Promise<OpportunityResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        address: true,
        cvProfile: { select: { categories: true } },
      },
    });

    const division = divisionOf(user?.address);
    // Without an area there is no "near you", and a national figure dressed
    // up as a local one would be the misleading version of this card.
    if (!division) return { opportunity: null };

    const area = user?.address?.trim() ?? '';
    const mine = (user?.cvProfile?.categories ?? []) as JobCategory[];

    const jobs = await this.prisma.job.findMany({
      where: { isOpen: true, division },
      select: { category: true },
    });
    if (jobs.length === 0) return { opportunity: null };

    const perCategory = new Map<JobCategory, number>();
    for (const job of jobs) {
      perCategory.set(job.category, (perCategory.get(job.category) ?? 0) + 1);
    }

    // Their own field first when it has anything in it — a headline about
    // work they cannot do is worse than no headline. Otherwise the busiest
    // category in the area, which is at least true and actionable.
    const candidates = [...perCategory.entries()].sort((a, b) => b[1] - a[1]);
    const preferred = candidates.find(([category]) => mine.includes(category));
    const picked = preferred ?? candidates[0];
    if (!picked || picked[1] < MIN_JOBS) return { opportunity: null };

    const [category, openJobs] = picked;

    const workers = await this.prisma.user.count({
      where: {
        status: 'ACTIVE',
        accountType: 'INDIVIDUAL',
        address: { not: null },
        cvProfile: { categories: { has: category } },
        // Same division, matched on the text since accounts carry no
        // division column — the same compromise the Work Map lives with.
        OR: divisionWords(division).map((word) => ({
          address: { contains: word, mode: 'insensitive' as const },
        })),
      },
    });

    return {
      opportunity: {
        category,
        area,
        openJobs,
        matchingWorkers: workers,
        // Twice as many posts as people is the threshold. A ratio closer to
        // one is a normal market, and calling that "high demand" would make
        // the phrase meaningless the rest of the time.
        highDemand: openJobs >= Math.max(MIN_JOBS, workers * 2),
      },
    };
  }
}

/**
 * Words that place an address in a division.
 *
 * The division's own name plus its districts, so "Tongi, Gazipur" counts
 * towards Dhaka without the account ever naming it.
 */
function divisionWords(division: Division): string[] {
  const info = DIVISION_BY_KEY[division];
  if (!info) return [division];
  return [info.en, ...info.districts.map((d) => d.en)];
}
