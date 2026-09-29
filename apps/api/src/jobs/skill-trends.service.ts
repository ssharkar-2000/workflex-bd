import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root — see the note in cv-writer.service.ts.
import * as z from 'zod/v4';
import type { JobCategory, SkillTrend, SkillTrends, TrendDirection } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { SIGNALS } from '../matching/cv-keywords';

const DAY = 86_400_000;
/** Thirty days against the thirty before them. */
const HALF = 30;
const WINDOW = HALF * 2;
/** Eight weekly buckets across the window, for the small bar chart. */
const BUCKETS = 8;

/**
 * A skill has to appear in at least this many postings this month before its
 * movement is reported.
 *
 * One posting becoming two is a hundred per cent rise and means nothing. The
 * floor is what separates a trend from a coincidence, and it is the single
 * most important number in this file.
 */
const MIN_MENTIONS = 3;

/** Below this many postings in the window, no trend is claimed at all. */
const MIN_JOBS = 25;

/**
 * And below this many in *either* half, no comparison is possible.
 *
 * The separate floor matters more than the total one. A platform can hold
 * two hundred postings that all went up in the same fortnight — which is
 * exactly what a freshly seeded database looks like — and a month-on-month
 * reading of that would call every skill in the vocabulary brand new. The
 * counts are still real and the weekly shape is still worth drawing; it is
 * only the arrow that has nothing to stand on.
 */
const MIN_HALF = 10;

/** What the screen shows before it starts repeating itself. */
const TOP = 12;
const TOP_FOR_YOU = 6;

const lineSchema = z.object({ insight: z.string() });

const SYSTEM = `You explain to somebody in Bangladesh which work skills are
being asked for more than they were.

The numbers come from one job platform's own postings over sixty days, not
from a national survey. Write "on WorkFlex BD" or "here" — never "in
Bangladesh, demand for X is rising".

Write two or three sentences. Say what has moved and what a person could do
about it this month. Where a rising skill is one they do not have, point at
learning it; where it is one they do, say so plainly, because that is worth
knowing too.

Never invent a skill or a number that is not in the table. Never predict what
will happen next — you are describing what has already been advertised. If
the figures are thin, say so instead of manufacturing a trend: somebody may
spend a fortnight learning what you point at, and a fortnight is a real cost
to a person on a daily wage.

Write in the language asked for.`;

/**
 * The Skill Radar.
 *
 * Scans every posting from the last sixty days for the vocabulary CVs
 * actually use — the same list the offline CV reader works from, so a skill
 * detected in a job is the same string as a skill detected in a CV, which is
 * what lets the two be compared at all.
 *
 * The counting is deliberately arithmetic. A model asked "what skills are
 * trending" would produce a plausible list of skills that are trending
 * generally, in the world, which is exactly the answer nobody needs: a
 * worker in Khulna cannot act on what is rising in San Francisco. These
 * numbers come from postings they can actually apply to.
 */
@Injectable()
export class SkillTrendsService {
  private readonly logger = new Logger(SkillTrendsService.name);
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
      this.logger.warn('Skill radar: reading is off, the summary will be assembled');
    }
  }

  async trends(userId: string): Promise<SkillTrends> {
    const now = Date.now();
    const from = new Date(now - WINDOW * DAY);
    const split = now - HALF * DAY;

    const [jobs, user] = await Promise.all([
      this.prisma.job.findMany({
        where: { createdAt: { gte: from } },
        select: {
          createdAt: true,
          title: true,
          description: true,
          requirements: true,
          category: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          locale: true,
          cvProfile: { select: { skills: true, categories: true } },
        },
      }),
    ]);

    const language = user?.locale === 'en' ? 'en' : 'bn';
    const mine = new Set((user?.cvProfile?.skills ?? []).map((s) => s.toLowerCase()));
    const myFields = new Set<JobCategory>(user?.cvProfile?.categories ?? []);

    let thisMonthJobs = 0;
    let lastMonthJobs = 0;

    // skill -> counts. One pass over the postings, scanning each for every
    // term: the vocabulary is a few hundred entries and the window is at most
    // a couple of thousand postings, so this stays well inside one request.
    const counts = new Map<
      string,
      { category: JobCategory; thisMonth: number; lastMonth: number; weekly: number[] }
    >();

    for (const job of jobs) {
      const when = job.createdAt.getTime();
      const recent = when >= split;
      if (recent) thisMonthJobs += 1;
      else lastMonthJobs += 1;

      // Which bucket of the eight this posting falls in, oldest first.
      const bucket = Math.min(
        BUCKETS - 1,
        Math.max(0, Math.floor(((when - from.getTime()) / (WINDOW * DAY)) * BUCKETS)),
      );

      const text = `${job.title} ${job.description} ${job.requirements ?? ''}`.toLowerCase();

      for (const group of SIGNALS) {
        for (const term of group.terms) {
          if (!mentions(text, term)) continue;

          const held =
            counts.get(term) ??
            { category: group.category, thisMonth: 0, lastMonth: 0, weekly: new Array(BUCKETS).fill(0) };
          if (recent) held.thisMonth += 1;
          else held.lastMonth += 1;
          held.weekly[bucket] = (held.weekly[bucket] ?? 0) + 1;
          counts.set(term, held);
        }
      }
    }

    // Either half being empty is as disqualifying as the whole window being
    // small — see MIN_HALF.
    const thin =
      jobs.length < MIN_JOBS || thisMonthJobs < MIN_HALF || lastMonthJobs < MIN_HALF;

    const trends: SkillTrend[] = [...counts.entries()]
      .filter(([, row]) => row.thisMonth >= MIN_MENTIONS || row.lastMonth >= MIN_MENTIONS)
      .map(([skill, row]) => {
        const changePct =
          row.lastMonth === 0
            ? null
            : Math.round(((row.thisMonth - row.lastMonth) / row.lastMonth) * 100);

        return {
          skill,
          category: row.category,
          thisMonth: row.thisMonth,
          lastMonth: row.lastMonth,
          changePct,
          direction: directionOf(row.thisMonth, row.lastMonth, changePct, thin),
          weekly: row.weekly,
          onYourCv: mine.has(skill),
          inYourField: myFields.has(row.category) || mine.has(skill),
        } satisfies SkillTrend;
      })
      // Biggest real movement first, and within that the busier skill: a jump
      // from 4 to 8 and one from 40 to 80 are both +100%, and the second is
      // the one somebody should hear about first.
      .sort(
        (a, b) =>
          moveOf(b) - moveOf(a) || b.thisMonth - a.thisMonth,
      )
      .slice(0, TOP);

    const forYou = trends
      .filter((trend) => trend.inYourField && trend.direction !== 'FALLING')
      .slice(0, TOP_FOR_YOU);
    const toLearn = forYou.filter(
      (trend) => !trend.onYourCv && (trend.direction === 'RISING' || trend.direction === 'NEW'),
    );

    const written = trends.length > 0 ? await this.read(trends, forYou, toLearn, language, thin) : null;

    return {
      thisMonthJobs,
      lastMonthJobs,
      trends,
      forYou,
      toLearn,
      insight:
        written?.trim() ||
        assembleInsight(
          trends,
          forYou,
          toLearn,
          { thisMonth: thisMonthJobs, lastMonth: lastMonthJobs },
          language,
          thin,
        ),
      source: written ? 'written' : 'assembled',
      thin,
    };
  }

  private async read(
    trends: SkillTrend[],
    forYou: SkillTrend[],
    toLearn: SkillTrend[],
    language: 'en' | 'bn',
    thin: boolean,
  ): Promise<string | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 700,
        output_config: { effort: 'low', format: zodOutputFormat(lineSchema) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write in ${language === 'bn' ? 'Bangla' : 'English'}.`,
              thin
                ? 'WARNING: there are very few postings in this window. Say so.'
                : '',
              '',
              'Skills, with postings naming them this month and last:',
              ...trends.map(
                (trend) =>
                  `- ${trend.skill} (${trend.category}): ${trend.thisMonth} this month, ${trend.lastMonth} last month, ${trend.direction}`,
              ),
              '',
              `In this person's field: ${forYou.map((t) => t.skill).join(', ') || 'none'}`,
              `Rising and not yet on their CV: ${toLearn.map((t) => t.skill).join(', ') || 'none'}`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      return response.parsed_output?.insight ?? null;
    } catch (err) {
      this.logger.error(
        `Skill radar reading failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

// --- the arithmetic ---

/**
 * Whether a posting names a term.
 *
 * Word boundaries, so "java" does not match inside "javascript" and "sql"
 * does not match inside "mysql" — both of which are separate entries in the
 * vocabulary, and conflating them would report a rise in one because the
 * other rose. Terms containing a dot or a plus ("node.js", "c++") are
 * escaped rather than treated as pattern characters.
 */
function mentions(text: string, term: string): boolean {
  let from = 0;
  for (;;) {
    const at = text.indexOf(term, from);
    if (at === -1) return false;
    const before = at === 0 ? ' ' : text[at - 1]!;
    const after = text[at + term.length] ?? ' ';
    // A trailing "+" or "." belongs to the term itself, so only letters and
    // digits either side disqualify a match.
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    from = at + 1;
  }
}

/**
 * How much a skill moved, for ordering.
 *
 * The absolute change in postings rather than the percentage, so a skill
 * going from two to four does not outrank one going from thirty to fifty.
 */
function moveOf(trend: SkillTrend): number {
  return Math.abs(trend.thisMonth - trend.lastMonth);
}

/**
 * Which arrow.
 *
 * A tenth either way is called steady. Postings are lumpy — one employer
 * putting up four notices on a Tuesday moves a small skill by more than that
 * — and an arrow that flips every week is one nobody believes.
 */
function directionOf(
  thisMonth: number,
  lastMonth: number,
  changePct: number | null,
  thin: boolean,
): TrendDirection {
  if (thin) return 'STEADY';
  if (lastMonth === 0 && thisMonth >= MIN_MENTIONS) return 'NEW';
  if (changePct === null) return 'STEADY';
  if (changePct >= 10) return 'RISING';
  if (changePct <= -10) return 'FALLING';
  return 'STEADY';
}

function assembleInsight(
  trends: SkillTrend[],
  forYou: SkillTrend[],
  toLearn: SkillTrend[],
  halves: { thisMonth: number; lastMonth: number },
  language: 'en' | 'bn',
  thin: boolean,
): string {
  const bn_ = language === 'bn';
  const jobs = halves.thisMonth + halves.lastMonth;

  if (trends.length === 0 || jobs === 0) {
    return bn_
      ? 'গত দুই মাসে তুলনা করার মতো যথেষ্ট বিজ্ঞপ্তি নেই। কাজ যোগ হলে এই পাতা নিজে থেকেই ভরে উঠবে।'
      : 'There are not enough postings in the last two months to compare. This fills in on its own as work is posted.';
  }
  if (thin) {
    // Two different thin cases, and conflating them would be the misleading
    // half-truth: "not many jobs" and "plenty of jobs but all in one of the
    // two months" call for different reading, and the second is what a young
    // platform actually looks like.
    const lopsided = jobs >= MIN_JOBS;
    if (lopsided) {
      return bn_
        ? `গত ৩০ দিনে ${bn(halves.thisMonth)}টি বিজ্ঞপ্তি, তার আগের ৩০ দিনে ${bn(halves.lastMonth)}টি — মাসে মাসে তুলনা করার মতো যথেষ্ট নয়। নিচের সংখ্যাগুলো আসল গণনা, কিন্তু তীরচিহ্ন দেওয়া হয়নি।`
        : `${halves.thisMonth} postings in the last 30 days against ${halves.lastMonth} in the 30 before — too lopsided to compare month with month. The counts below are real; the arrows are held back until both halves have something in them.`;
    }
    return bn_
      ? `গত ৬০ দিনে মাত্র ${bn(jobs)}টি বিজ্ঞপ্তি — কোনটা বাড়ছে আর কোনটা কমছে বলার মতো যথেষ্ট নয়। নিচে যা দেখছেন তা গণনা, প্রবণতা নয়।`
      : `Only ${jobs} postings in the last 60 days — too few to say what is rising and what is falling. What is below is a count, not a trend.`;
  }

  const rising = trends.filter((t) => t.direction === 'RISING' || t.direction === 'NEW');
  const falling = trends.filter((t) => t.direction === 'FALLING');
  const parts: string[] = [];

  if (rising.length > 0) {
    const top = rising[0]!;
    parts.push(
      bn_
        ? `সবচেয়ে বেশি বেড়েছে ${top.skill} — গত মাসে ${bn(top.lastMonth)}টি বিজ্ঞপ্তি, এ মাসে ${bn(top.thisMonth)}টি।`
        : `${top.skill} has moved most — ${top.lastMonth} postings last month, ${top.thisMonth} this month.`,
    );
  }
  if (toLearn.length > 0) {
    parts.push(
      bn_
        ? `আপনার কাজের ক্ষেত্রে বাড়ছে কিন্তু আপনার সিভিতে নেই: ${toLearn.slice(0, 3).map((t) => t.skill).join(', ')}।`
        : `Rising in your field and not yet on your CV: ${toLearn.slice(0, 3).map((t) => t.skill).join(', ')}.`,
    );
  } else if (forYou.length > 0) {
    parts.push(
      bn_
        ? 'আপনার ক্ষেত্রে যা বাড়ছে তার সবই ইতিমধ্যে আপনার সিভিতে আছে।'
        : 'Everything rising in your field is already on your CV.',
    );
  }
  if (falling.length > 0) {
    parts.push(
      bn_
        ? `কমেছে ${falling[0]!.skill}।`
        : `${falling[0]!.skill} has gone the other way.`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      bn_
        ? 'এ মাসে কোনো দক্ষতার চাহিদায় বড় পরিবর্তন হয়নি।'
        : 'No skill has moved much this month.',
    );
  }
  return parts.join(' ');
}

function bn(value: number): string {
  const digits = '০১২৩৪৫৬৭৮৯';
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}
