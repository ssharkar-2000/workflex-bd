import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root — see the note in cv-writer.service.ts.
import * as z from 'zod/v4';
import {
  DIVISION_POINTS,
  DIVISIONS,
  jobCategoryName,
  divisionOf,
  haversineKm,
  resolvePlace,
  type AreaDemand,
  type CategoryDemand,
  type DemandBand,
  type DemandGap,
  type DemandMap,
  type Division,
  type JobCategory,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Where the bands are cut, on share of posts against share of workers.
 *
 * Shares rather than raw ratios, and this is the correction that matters. The
 * obvious approach — vacancies per worker, compared with the national figure
 * — collapses the moment a division has no workers recorded: dividing by a
 * floor of one makes its ratio depend only on how many posts it holds, and a
 * division with thirty-six posts and nobody to fill them came out *greener*
 * than Dhaka. A share comparison cannot do that. A division holding a tenth
 * of the country's work and a fiftieth of its workers is short of workers
 * whatever the absolute counts are.
 */
const BANDS = { short: 1.4, surplus: 0.7 } as const;

/**
 * Below this many locatable workers, no colour is honest.
 *
 * Shares need a denominator worth dividing by. With four workers on the map,
 * one person moving house would repaint the country, so everything is shown
 * as balanced and the screen says why.
 */
const MIN_WORKERS = 10;

/** Categories shown per division, and gaps shown overall. */
const TOP_CATEGORIES = 4;
const TOP_GAPS = 5;

/** Below this a ratio is noise — two postings and one worker is not a trend. */
const MIN_VACANCIES = 3;

const gapSchema = z.object({
  division: z.string().describe('The division key exactly as given.'),
  category: z.string().describe('The category key exactly as given.'),
  why: z.string().describe('One line. What it means for the person reading.'),
});

const SYSTEM = `You read a table of job vacancies and available workers across
Bangladesh's eight divisions, and explain it to somebody using a work app.

The numbers come from one platform's own records, not from a national survey,
and you must never write as though they describe the whole country. "On
WorkFlex BD" or "here" — never "in Bangladesh, there is a shortage of".

You write two things:

1. Up to five gaps: a division and a kind of work where vacancies clearly
   outrun the workers available, worst first. Pick only from the table. For
   each, one line on what it means for a reader — where work is going
   unfilled, what skill is worth having there. Never tell somebody to move
   house or leave their family; most people reading this cannot, and a
   suggestion they cannot act on is worth nothing.
2. Two or three sentences over the whole map. Say what stands out. If the
   figures are thin, say that instead of manufacturing a trend — a reader
   who is told there is a shortage that is really four postings will trust
   nothing else on the screen.

Never invent a number, a division or a category that is not in the table.
Never predict what will happen next: you are describing what is recorded
today. Write in the language asked for.`;

/**
 * The Work Map.
 *
 * Demand is open postings, counted as posts rather than listings — a notice
 * hiring six people is six. Supply is accounts whose address names somewhere
 * we can place, which is the honest limit of what this platform knows about
 * where its workers are.
 *
 * The arithmetic is deliberately all here rather than in the model. A colour
 * on a map is a claim, and it has to come from a count somebody can check.
 * What the model adds is the reading: which pairings are worth a person's
 * attention and what they mean.
 */
@Injectable()
export class DemandMapService {
  private readonly logger = new Logger(DemandMapService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const enabled = this.config.get('CV_PARSER') === 'claude';
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    this.model = this.config.get<string>('CV_PARSER_MODEL') ?? 'claude-sonnet-5';

    this.client = enabled && apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('Work map: reading is off, the summary will be assembled');
    }
  }

  async map(userId: string): Promise<DemandMap> {
    const [jobs, workers, user] = await Promise.all([
      this.prisma.job.findMany({
        where: { isOpen: true },
        select: {
          division: true,
          location: true,
          district: true,
          category: true,
          vacancies: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          accountType: 'INDIVIDUAL',
          address: { not: null },
        },
        select: { address: true, cvProfile: { select: { categories: true } } },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { locale: true } }),
    ]);

    const language = user?.locale === 'en' ? 'en' : 'bn';

    // --- demand ---
    const vacancies = blank();
    const openJobs = blank();
    const byCategory = new Map<string, number>();
    let unplacedJobs = 0;

    for (const job of jobs) {
      // The structured column when the posting has one, the free text when it
      // does not: plenty of listings were written before the field existed.
      const where = job.division ?? placeOf(job.district) ?? placeOf(job.location);
      if (!where) {
        unplacedJobs += 1;
        continue;
      }
      // A vacancy count of null means the employer did not say, which is
      // common and honestly means "at least one".
      const posts = Math.max(1, job.vacancies ?? 1);
      vacancies[where] += posts;
      openJobs[where] += 1;
      bump(byCategory, key(where, job.category), posts);
    }

    // --- supply ---
    const workerCount = blank();
    const workersByCategory = new Map<string, number>();
    let unplacedWorkers = 0;

    for (const worker of workers) {
      const where = placeOf(worker.address);
      if (!where) {
        unplacedWorkers += 1;
        continue;
      }
      workerCount[where] += 1;
      // Somebody with no parsed CV counts towards the division but towards no
      // category — we do not know what they do, and guessing would put them
      // in whichever category needs them least.
      for (const category of worker.cvProfile?.categories ?? []) {
        bump(workersByCategory, key(where, category), 1);
      }
    }

    const totalVacancies = sum(vacancies);
    const totalWorkers = sum(workerCount);
    const thin = totalWorkers < MIN_WORKERS || totalVacancies === 0;

    const areas: AreaDemand[] = DIVISIONS.map((division) => {
      const here = division.key;
      const point = DIVISION_POINTS[here];
      const shareOfPosts = share(vacancies[here], totalVacancies);
      const shareOfWorkers = share(workerCount[here], totalWorkers);

      return {
        division: here,
        en: division.en,
        bn: division.bn,
        lat: point.lat,
        lng: point.lng,
        openJobs: openJobs[here],
        vacancies: vacancies[here],
        workers: workerCount[here],
        shareOfPosts: round1(shareOfPosts * 100),
        shareOfWorkers: round1(shareOfWorkers * 100),
        quotient: shareOfWorkers === 0 ? null : round1(shareOfPosts / shareOfWorkers),
        band: bandOf(shareOfPosts, shareOfWorkers, vacancies[here], thin),
        topCategories: this.categoriesIn(
          here,
          byCategory,
          workersByCategory,
          totalVacancies,
          totalWorkers,
          thin,
        ),
      };
    });

    const gaps = this.gapsFrom(areas);
    const written = await this.read(areas, gaps, language);

    return {
      areas,
      gaps: gaps.map((gap) => ({
        ...gap,
        why: written?.why.get(key(gap.division, gap.category))?.trim() || this.assembleWhy(gap, language),
      })),
      insight: written?.insight.trim() || this.assembleInsight(areas, gaps, language),
      source: written ? 'written' : 'assembled',
      totals: { vacancies: totalVacancies, workers: totalWorkers },
      unplaced: { jobs: unplacedJobs, workers: unplacedWorkers },
    };
  }

  // --- the arithmetic ---

  /** The categories that most decide a division's colour, worst first. */
  private categoriesIn(
    division: Division,
    byCategory: Map<string, number>,
    workersByCategory: Map<string, number>,
    totalVacancies: number,
    totalWorkers: number,
    thin: boolean,
  ): CategoryDemand[] {
    const rows: CategoryDemand[] = [];

    for (const [composite, posts] of byCategory) {
      if (!composite.startsWith(`${division}:`)) continue;
      const category = composite.slice(division.length + 1) as JobCategory;
      const workers = workersByCategory.get(composite) ?? 0;
      rows.push({
        category,
        vacancies: posts,
        workers,
        band: bandOf(share(posts, totalVacancies), share(workers, totalWorkers), posts, thin),
      });
    }

    // Most vacancies first rather than the most extreme ratio: one posting
    // with no worker behind it is an infinite ratio and a meaningless row.
    return rows.sort((a, b) => b.vacancies - a.vacancies).slice(0, TOP_CATEGORIES);
  }

  /** The pairings worth naming: short of workers, and big enough to mean it. */
  private gapsFrom(areas: AreaDemand[]): Omit<DemandGap, 'why'>[] {
    const gaps = areas.flatMap((area) =>
      area.topCategories
        .filter((row) => row.band === 'SHORT_OF_WORKERS' && row.vacancies >= MIN_VACANCIES)
        .map((row) => ({
          division: area.division,
          en: area.en,
          bn: area.bn,
          category: row.category,
          vacancies: row.vacancies,
          workers: row.workers,
        })),
    );

    return gaps
      .sort((a, b) => b.vacancies - a.vacancies - (b.workers - a.workers))
      .slice(0, TOP_GAPS);
  }

  // --- the reading ---

  private async read(
    areas: AreaDemand[],
    gaps: Omit<DemandGap, 'why'>[],
    language: 'en' | 'bn',
  ): Promise<{ why: Map<string, string>; insight: string } | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1500,
        output_config: {
          effort: 'low',
          format: zodOutputFormat(
            z.object({ gaps: z.array(gapSchema), insight: z.string() }),
          ),
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write in ${language === 'bn' ? 'Bangla' : 'English'}.`,
              '',
              'Open vacancies and available workers, by division:',
              ...areas.map((area) =>
                [
                  `${area.division} (${area.en}): ${area.vacancies} vacancies, ${area.workers} workers`,
                  ...area.topCategories.map(
                    (row) =>
                      `    ${row.category}: ${row.vacancies} vacancies, ${row.workers} workers`,
                  ),
                ].join('\n'),
              ),
              '',
              'Pairings the arithmetic already flagged as short of workers:',
              ...(gaps.length > 0
                ? gaps.map(
                    (gap) =>
                      `- ${gap.division} / ${gap.category}: ${gap.vacancies} vacancies, ${gap.workers} workers`,
                  )
                : ['- none']),
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const parsed = response.parsed_output;
      if (!parsed) return null;

      return {
        why: new Map(
          parsed.gaps.map((gap) => [`${gap.division}:${gap.category}`, gap.why] as const),
        ),
        insight: parsed.insight,
      };
    } catch (err) {
      this.logger.error(
        `Work map reading failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private assembleWhy(gap: Omit<DemandGap, 'why'>, language: 'en' | 'bn'): string {
    const name = jobCategoryName(gap.category, language);
    const where = language === 'bn' ? gap.bn : gap.en;

    if (language === 'bn') {
      return gap.workers === 0
        ? `${where}-এ ${name} কাজে ${bn(gap.vacancies)}টি পদ খালি, কিন্তু এই কাজ পারেন এমন কারও সিভি এখানে নেই।`
        : `${where}-এ ${name} কাজে ${bn(gap.workers)} জনের বিপরীতে ${bn(gap.vacancies)}টি পদ খালি।`;
    }
    return gap.workers === 0
      ? `${gap.vacancies} posts open for ${name} in ${where}, and nobody here has that on their CV.`
      : `${gap.vacancies} posts open for ${name} in ${where}, against ${gap.workers} ${
          gap.workers === 1 ? 'worker' : 'workers'
        }.`;
  }

  /**
   * The summary when there is no model.
   *
   * It says less than the written one, and says it from the same counts. What
   * it will not do is invent a trend out of four postings — see the note on
   * thin figures below, which is the whole reason this reads the totals
   * before it reads the extremes.
   */
  private assembleInsight(
    areas: AreaDemand[],
    gaps: Omit<DemandGap, 'why'>[],
    language: 'en' | 'bn',
  ): string {
    const total = areas.reduce((sum, area) => sum + area.vacancies, 0);
    const people = areas.reduce((sum, area) => sum + area.workers, 0);
    const bn_ = language === 'bn';

    if (total < 20) {
      return bn_
        ? 'এখনো খুব কম বিজ্ঞপ্তি আছে বলে মানচিত্রটি পুরো ছবি দেখায় না। আরও কাজ যোগ হলে এটি নিজে থেকেই ভরে উঠবে।'
        : 'There are still too few postings here for the map to show much. It fills in on its own as more work is posted.';
    }

    // The supply side goes thin long before the demand side does, and saying
    // so is the only honest thing to print: with a handful of located
    // workers, one person moving house would repaint the country.
    if (people < MIN_WORKERS) {
      return bn_
        ? `${bn(total)}টি খালি পদ আছে, কিন্তু এলাকা বোঝা যায় এমন কর্মী মাত্র ${bn(people)} জন — তুলনা করার মতো যথেষ্ট নয়। তাই এখন কোনো বিভাগকে রঙে আলাদা করা হচ্ছে না।`
        : `There are ${total} posts open but only ${people} workers we can place on the map — too few to compare divisions against each other, so none is coloured yet.`;
    }

    const short = areas
      .filter((area) => area.band === 'SHORT_OF_WORKERS')
      .sort((a, b) => (b.quotient ?? 99) - (a.quotient ?? 99));
    const spare = areas
      .filter((area) => area.band === 'SHORT_OF_WORK')
      .sort((a, b) => (a.quotient ?? 0) - (b.quotient ?? 0));

    const parts: string[] = [];
    if (short.length > 0) {
      const names = short.slice(0, 2).map((area) => (bn_ ? area.bn : area.en)).join(bn_ ? ' ও ' : ' and ');
      parts.push(
        bn_
          ? `${names}-এ কর্মীর তুলনায় খালি পদ বেশি।`
          : `${names} ${short.length > 1 ? 'have' : 'has'} more posts open than workers to fill them.`,
      );
    }
    if (spare.length > 0) {
      const names = spare.slice(0, 2).map((area) => (bn_ ? area.bn : area.en)).join(bn_ ? ' ও ' : ' and ');
      parts.push(
        bn_
          ? `${names}-এ কাজের চেয়ে কর্মী বেশি, তাই সেখানে প্রতিযোগিতা বেশি।`
          : `${names} ${spare.length > 1 ? 'have' : 'has'} more workers than work, so expect more competition there.`,
      );
    }
    if (gaps.length > 0) {
      const gap = gaps[0]!;
      parts.push(
        bn_
          ? `সবচেয়ে বড় ফাঁক: ${gap.bn}-এ ${jobCategoryName(gap.category, 'bn')}।`
          : `The widest single gap is ${jobCategoryName(gap.category, 'en')} in ${gap.en}.`,
      );
    }
    if (parts.length === 0) {
      parts.push(
        bn_
          ? 'এই মুহূর্তে বিভাগগুলোর মধ্যে বড় কোনো পার্থক্য নেই।'
          : 'No division stands out from the others at the moment.',
      );
    }
    return parts.join(' ');
  }
}

// --- small things ---

/**
 * Which division a string names, with the gazetteer as a second attempt.
 *
 * A great many addresses name a neighbourhood and nothing above it —
 * "Mirpur", "Zindabazar" — which no list of districts will match. Those are
 * in bd-places with coordinates, so the point is resolved and handed to the
 * nearest division centre. Wrong only for somewhere sitting almost exactly
 * on a boundary, and far better than dropping the row.
 */
function placeOf(text: string | null): Division | null {
  const named = divisionOf(text);
  if (named) return named;

  const place = resolvePlace(text);
  if (!place) return null;

  let nearest: Division | null = null;
  let best = Infinity;
  for (const division of DIVISIONS) {
    const point = DIVISION_POINTS[division.key];
    const km = haversineKm(
      { lat: place.lat, lng: place.lng },
      { lat: point.lat, lng: point.lng },
    );
    if (km < best) {
      best = km;
      nearest = division.key;
    }
  }
  return nearest;
}

function blank(): Record<Division, number> {
  return Object.fromEntries(DIVISIONS.map((d) => [d.key, 0])) as Record<Division, number>;
}

function sum(counts: Record<Division, number>): number {
  return Object.values(counts).reduce((total, one) => total + one, 0);
}

function key(division: Division, category: string): string {
  return `${division}:${category}`;
}

function bump(map: Map<string, number>, at: string, by: number): void {
  map.set(at, (map.get(at) ?? 0) + by);
}

/** A part of a whole, with an empty whole reading as nothing rather than NaN. */
function share(part: number, whole: number): number {
  return whole === 0 ? 0 : part / whole;
}

/**
 * Which colour.
 *
 * Three guards before the comparison, each stopping a different lie:
 *
 * - Too few posts here, and nothing is claimed. Two postings and no workers
 *   is not a shortage, and painting it red would send somebody across the
 *   country for two jobs that may both be filled by Friday.
 * - Too few workers anywhere on the map, and nothing is claimed of any
 *   division — see MIN_WORKERS.
 * - Posts here but no workers at all is the one case a share comparison
 *   cannot divide, and it is also the clearest shortage there is, so it is
 *   answered directly rather than by arithmetic.
 */
function bandOf(
  shareOfPosts: number,
  shareOfWorkers: number,
  vacancies: number,
  thin: boolean,
): DemandBand {
  if (thin || vacancies < MIN_VACANCIES) return 'BALANCED';
  if (shareOfWorkers === 0) return 'SHORT_OF_WORKERS';

  const quotient = shareOfPosts / shareOfWorkers;
  if (quotient >= BANDS.short) return 'SHORT_OF_WORKERS';
  if (quotient <= BANDS.surplus) return 'SHORT_OF_WORK';
  return 'BALANCED';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}


function bn(value: number): string {
  const digits = '০১২৩৪৫৬৭৮৯';
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}
