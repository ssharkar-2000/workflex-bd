import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root: zodOutputFormat is typed against v4 while the
// rest of the repo is on the v3 API — the same split the CV writer lives with.
import * as z from 'zod/v4';
import {
  JOB_CATEGORIES,
  type JobCategory,
  type JobDraft,
  type JobDraftRequestDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env.schema';

const CATEGORY_KEYS = JOB_CATEGORIES.map((category) => category.key);

const draftSchema = z.object({
  title: z
    .string()
    .describe('A short posting title a worker would search for. No emoji.'),
  category: z
    .enum(CATEGORY_KEYS as [JobCategory, ...JobCategory[]])
    .nullable()
    .describe('The closest category, or null if the text does not say enough.'),
  description: z
    .string()
    .describe("Two or three sentences in the employer's own words, tidied."),
  jobType: z
    .enum([
      'FULL_TIME',
      'PART_TIME',
      'PERMANENT',
      'CONTRACT',
      'FREELANCE',
      'INTERNSHIP',
      'TEMPORARY',
      'SEASONAL',
      'SHIFT_BASED',
      'ONE_TIME',
    ])
    .nullable(),
  duration: z
    .enum(['ONE_DAY', 'FEW_DAYS', 'ONE_WEEK', 'ONE_MONTH', 'THREE_TO_SIX_MONTHS', 'LONG_TERM'])
    .nullable(),
  hours: z
    .number()
    .int()
    .nullable()
    .describe('Hours of work, only if a number of hours was actually said.'),
  startsOn: z
    .string()
    .nullable()
    .describe('YYYY-MM-DD, resolved against the date given. Null if unsaid.'),
  whenText: z.string().describe('The timing read back plainly: "Tomorrow, 3 hours".'),
  skills: z
    .array(z.string())
    .describe('Two to four plain skills the work needs. Not a taxonomy.'),
  paymentType: z
    .enum(['HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'FIXED_PROJECT', 'NEGOTIABLE'])
    .nullable(),
  payMin: z.number().int().nullable().describe('Taka. Use the figures supplied.'),
  payMax: z.number().int().nullable(),
  assumptions: z
    .array(z.string())
    .describe('Anything filled in that the employer did not actually say.'),
});

const SYSTEM = `You turn one sentence from an employer in Bangladesh into a
job posting, so that somebody who would never finish an eleven-field form can
still hire the help they need.

They write things like "need someone to help my elderly mother for 3 hours
tomorrow" or "আমার দোকানে সপ্তাহে তিন দিন একজন লোক দরকার".

Rules you do not break:

1. Do not invent facts. If the text does not say where the work is, how long
   it lasts or how much it pays, those fields stay null — except where you
   were given platform figures to use for pay.
2. Everything you filled in that they did not say goes in "assumptions", in
   plain words: "You did not say a time, so this is set to flexible." The
   employer reads these before posting.
3. Pay comes from the figures supplied with this request, which are what this
   platform's own open postings in that category pay. If none were supplied,
   leave pay null and say so in assumptions. Never guess a number.
4. The title is what a worker would search for — "Elderly care, 3 hours" —
   not a sentence and not a plea.
5. Dates: resolve "tomorrow", "next week" and "আগামীকাল" against the date
   given below. Never output a date in the past.
6. Write in the language the employer wrote in. A Bangla sentence gets a
   Bangla title and description.
7. Nothing about a person's age, gender, religion or marital status goes in
   the posting, whatever the employer wrote. If they asked for one, drop it
   and note it in assumptions.`;

/**
 * One sentence in, a posting out.
 *
 * Pay is the part worth being careful about. The model is never asked to
 * guess taka: the service measures what open postings in that category
 * actually pay on this platform and hands those figures over, so a range
 * shown to an employer can be traced to something real. Where there is
 * nothing to measure, the range comes back null and says why.
 *
 * Two paths, as everywhere else here. Without the model a rule-based reader
 * picks the category by keyword and pulls hours and dates out with patterns.
 * It is plainly worse at reading a sentence, and it still fills the form in —
 * which is the whole point of the feature.
 */
@Injectable()
export class JobDraftService {
  private readonly logger = new Logger(JobDraftService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    const enabled = this.config.get('CV_PARSER', { infer: true }) === 'claude';
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    this.model = this.config.get('CV_PARSER_MODEL', { infer: true });

    this.client = enabled && apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('Job drafting is off — postings will be read by rules');
    }
  }

  async draft(userId: string, dto: JobDraftRequestDto): Promise<JobDraft> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true, address: true },
    });

    const language = dto.language ?? (user?.locale === 'en' ? 'en' : 'bn');
    const location = dto.location?.trim() || user?.address || '';
    const pay = await this.payByCategory();

    const assembled = this.readByRules(dto.text, location, language, pay);
    if (!this.client) return assembled;

    const written = await this.write({ dto, location, language, pay, assembled });
    return written ?? assembled;
  }

  /**
   * What this platform's open postings pay, per category.
   *
   * Averaged over what employers here have actually offered rather than taken
   * from a salary survey: it is the only figure this system can defend, and
   * an employer asking "what should I pay?" deserves an answer with a source.
   */
  private async payByCategory(): Promise<Map<JobCategory, { min: number; max: number; n: number }>> {
    const rows = await this.prisma.job.groupBy({
      by: ['category'],
      where: { isOpen: true, salaryMin: { not: null } },
      _avg: { salaryMin: true, salaryMax: true },
      _count: { _all: true },
    });

    const out = new Map<JobCategory, { min: number; max: number; n: number }>();
    for (const row of rows) {
      const min = row._avg.salaryMin;
      const max = row._avg.salaryMax ?? row._avg.salaryMin;
      if (min === null || max === null) continue;
      out.set(row.category as JobCategory, {
        // Stored in paisa; an employer thinks in taka.
        min: Math.round(min / 100),
        max: Math.round(max / 100),
        n: row._count._all,
      });
    }
    return out;
  }

  private async write(input: {
    dto: JobDraftRequestDto;
    location: string;
    language: 'en' | 'bn';
    pay: Map<JobCategory, { min: number; max: number; n: number }>;
    assembled: JobDraft;
  }): Promise<JobDraft | null> {
    const today = new Date().toISOString().slice(0, 10);
    const rates = [...input.pay.entries()].map(([category, figures]) => ({
      category,
      typicalTakaMin: figures.min,
      typicalTakaMax: figures.max,
      fromPostings: figures.n,
    }));

    try {
      const response = await this.client!.messages.parse({
        model: this.model,
        max_tokens: 1200,
        output_config: { effort: 'low', format: zodOutputFormat(draftSchema) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Today is ${today}. Write in ${input.language === 'bn' ? 'Bangla' : 'English'}.`,
              input.location
                ? `The work is at: ${input.location}`
                : 'No location was given.',
              '',
              '<what_the_employer_wrote>',
              input.dto.text,
              '</what_the_employer_wrote>',
              '',
              '<what_this_platform_pays>',
              rates.length
                ? JSON.stringify(rates, null, 1)
                : '(no open postings to measure — leave pay null)',
              '</what_this_platform_pays>',
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const parsed = response.parsed_output;
      if (!parsed) return null;

      const figures = parsed.category ? input.pay.get(parsed.category) : undefined;

      return {
        title: parsed.title.trim(),
        category: parsed.category,
        description: parsed.description.trim(),
        location: input.location,
        jobType: parsed.jobType,
        duration: parsed.duration,
        hours: parsed.hours && parsed.hours > 0 ? parsed.hours : null,
        startsOn: futureOnly(parsed.startsOn),
        whenText: parsed.whenText.trim(),
        skills: parsed.skills.map((skill) => skill.trim()).filter(Boolean).slice(0, 6),
        paymentType: parsed.paymentType,
        payMin: parsed.payMin,
        payMax: parsed.payMax,
        payBasis: figures
          ? basisLine(figures.n, input.language)
          : parsed.payMin === null
            ? null
            : unsourcedLine(input.language),
        assumptions: parsed.assumptions.map((line) => line.trim()).filter(Boolean),
        source: 'written',
      };
    } catch (err) {
      this.logger.error(
        `Job drafting failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * The same job without a model: keywords for the category, patterns for the
   * hours and the day.
   */
  private readByRules(
    text: string,
    location: string,
    language: 'en' | 'bn',
    pay: Map<JobCategory, { min: number; max: number; n: number }>,
  ): JobDraft {
    const category = categoryFor(text);
    const hours = hoursIn(text);
    const startsOn = dayIn(text);
    const figures = category ? pay.get(category) : undefined;

    const assumptions: string[] = [];
    if (!category) assumptions.push(unknownCategoryLine(language));
    if (!hours) assumptions.push(noHoursLine(language));

    const skills = category ? SKILLS[category][language] : [];
    if (skills.length > 0) assumptions.push(skillsLine(language));

    return {
      // Not the sentence itself. "Need someone to help my elderly mother for
      // 3 hours tomorrow" is how the employer thinks about it; "Care work, 3
      // hours" is what a worker scans a list for.
      title: titleFor(category, hours, language) || text.trim().slice(0, 60),
      category,
      description: text.trim(),
      location,
      jobType: hours && hours <= 12 ? 'ONE_TIME' : null,
      duration: hours && hours <= 12 ? 'ONE_DAY' : null,
      hours,
      startsOn,
      whenText: whenLine(hours, startsOn, language),
      skills,
      paymentType: hours ? 'HOURLY' : null,
      payMin: figures?.min ?? null,
      payMax: figures?.max ?? null,
      payBasis: figures ? basisLine(figures.n, language) : null,
      assumptions,
      source: 'assembled',
    };
  }
}

// --- reading a sentence without a model -------------------------------------

/**
 * Words that place a request in one of the platform's categories.
 *
 * Ordered by what somebody does before where they do it, and first match
 * wins. "A night guard for my shop" is security work in a shop, not shop
 * work — put the places first and every guard, driver and tutor is filed by
 * the building they happen to stand in.
 */
const CATEGORY_WORDS: [JobCategory, RegExp][] = [
  ['SECURITY', /guard|security|watchman|নিরাপত্তা|দারোয়ান|গার্ড/i],
  ['HEALTHCARE', /elderly|nurse|patient|care ?giver|বয়স্ক|রোগী|সেবা|নার্স/i],
  ['EDUCATION', /tutor|teach|lesson|শিক্ষক|টিউশন|পড়া/i],
  ['TRANSPORT', /driver|drive|car|rickshaw|truck|চালক|ড্রাইভার|গাড়ি/i],
  ['DELIVERY', /deliver|parcel|courier|pick ?up|ডেলিভারি|পার্সেল|পৌঁছ/i],
  ['TRADES', /electric|plumb|carpent|repair|mechanic|মিস্ত্রি|ইলেকট্রি|মেরামত/i],
  ['CONSTRUCTION', /construct|mason|labour|labor|নির্মাণ|রাজমিস্ত্রি|শ্রমিক/i],
  ['HOUSEHOLD', /clean|maid|cook|house|laundry|garden|বাসা|পরিষ্কার|রান্না|বুয়া|কাজের লোক/i],
  ['HOSPITALITY', /waiter|restaurant|hotel|kitchen|catering|রেস্টুরেন্ট|হোটেল|রান্নাঘর/i],
  ['RETAIL', /shop|store|sales|cashier|দোকান|বিক্রয়|ক্যাশ/i],
  ['EVENTS', /wedding|event|party|বিয়ে|অনুষ্ঠান/i],
];

/**
 * A short title per kind of work, and what that work needs.
 *
 * Only reached when the model is unavailable, and that is exactly when it
 * matters: without these the fallback posts the employer's own sentence as
 * the advert's title and asks for no skills at all, which is a posting no
 * worker can scan and no search can match.
 */
const SHORT: Record<JobCategory, { en: string; bn: string }> = {
  SECURITY: { en: 'Security guard', bn: 'নিরাপত্তা প্রহরী' },
  HEALTHCARE: { en: 'Care work', bn: 'সেবা ও দেখাশোনা' },
  EDUCATION: { en: 'Tutoring', bn: 'পড়ানো' },
  TRANSPORT: { en: 'Driving', bn: 'গাড়ি চালানো' },
  DELIVERY: { en: 'Delivery', bn: 'ডেলিভারি' },
  TRADES: { en: 'Repair work', bn: 'মেরামতের কাজ' },
  CONSTRUCTION: { en: 'Site work', bn: 'নির্মাণের কাজ' },
  HOUSEHOLD: { en: 'House help', bn: 'ঘরের কাজ' },
  HOSPITALITY: { en: 'Kitchen help', bn: 'রান্নাঘরের কাজ' },
  RETAIL: { en: 'Shop help', bn: 'দোকানের কাজ' },
  EVENTS: { en: 'Event help', bn: 'অনুষ্ঠানের কাজ' },
  OFFICE: { en: 'Office help', bn: 'অফিসের কাজ' },
  IT: { en: 'Computer work', bn: 'কম্পিউটারের কাজ' },
  BEAUTY: { en: 'Salon work', bn: 'পার্লারের কাজ' },
  AGRICULTURE: { en: 'Farm work', bn: 'কৃষিকাজ' },
  MANUFACTURING: { en: 'Factory work', bn: 'কারখানার কাজ' },
  PROFESSIONAL: { en: 'Professional work', bn: 'পেশাদার কাজ' },
  CREATIVE: { en: 'Creative work', bn: 'সৃজনশীল কাজ' },
  VOLUNTEER: { en: 'Volunteer work', bn: 'স্বেচ্ছাসেবার কাজ' },
  EMERGENCY: { en: 'Emergency help', bn: 'জরুরি সহায়তা' },
};

const SKILLS: Record<JobCategory, { en: string[]; bn: string[] }> = {
  SECURITY: { en: ['Alertness', 'Record keeping'], bn: ['সতর্কতা', 'রেজিস্টার রাখা'] },
  HEALTHCARE: { en: ['Basic caregiving', 'Communication'], bn: ['প্রাথমিক সেবা', 'যোগাযোগ'] },
  EDUCATION: { en: ['Teaching', 'Patience'], bn: ['পড়ানো', 'ধৈর্য'] },
  TRANSPORT: { en: ['Safe driving', 'Route knowledge'], bn: ['নিরাপদ ড্রাইভিং', 'রাস্তা চেনা'] },
  DELIVERY: { en: ['Punctuality', 'Handling cash'], bn: ['সময়ানুবর্তিতা', 'ক্যাশ সামলানো'] },
  TRADES: { en: ['Hand tools', 'Fault finding'], bn: ['যন্ত্রপাতি ব্যবহার', 'ত্রুটি খুঁজে বের করা'] },
  CONSTRUCTION: { en: ['Site safety', 'Physical work'], bn: ['সাইটের নিরাপত্তা', 'শারীরিক পরিশ্রম'] },
  HOUSEHOLD: { en: ['Cleaning', 'Cooking'], bn: ['পরিষ্কার করা', 'রান্না'] },
  HOSPITALITY: { en: ['Food hygiene', 'Working at pace'], bn: ['খাদ্য পরিচ্ছন্নতা', 'দ্রুত কাজ করা'] },
  RETAIL: { en: ['Customer service', 'Handling cash'], bn: ['গ্রাহকসেবা', 'ক্যাশ সামলানো'] },
  EVENTS: { en: ['Setting up', 'Working in a team'], bn: ['আয়োজন গোছানো', 'দলবদ্ধ কাজ'] },
  OFFICE: { en: ['Record keeping', 'Communication'], bn: ['নথি রাখা', 'যোগাযোগ'] },
  IT: { en: ['Computer basics', 'Problem solving'], bn: ['কম্পিউটারের প্রাথমিক জ্ঞান', 'সমস্যা সমাধান'] },
  BEAUTY: { en: ['Grooming skills', 'Customer service'], bn: ['রূপচর্চার দক্ষতা', 'গ্রাহকসেবা'] },
  AGRICULTURE: { en: ['Field work', 'Physical work'], bn: ['মাঠের কাজ', 'শারীরিক পরিশ্রম'] },
  MANUFACTURING: { en: ['Machine handling', 'Safety rules'], bn: ['মেশিন চালানো', 'নিরাপত্তার নিয়ম'] },
  PROFESSIONAL: { en: ['Reporting', 'Communication'], bn: ['রিপোর্ট তৈরি', 'যোগাযোগ'] },
  CREATIVE: { en: ['Design sense', 'Meeting deadlines'], bn: ['ডিজাইন বোধ', 'সময়মতো কাজ শেষ'] },
  VOLUNTEER: { en: ['Willingness to help', 'Teamwork'], bn: ['সাহায্যের মানসিকতা', 'দলবদ্ধ কাজ'] },
  EMERGENCY: { en: ['Staying calm', 'First aid'], bn: ['ঠান্ডা মাথা', 'প্রাথমিক চিকিৎসা'] },
};

function titleFor(
  category: JobCategory | null,
  hours: number | null,
  language: 'en' | 'bn',
): string {
  if (!category) return '';
  const short = SHORT[category][language];
  if (!hours) return short;
  return language === 'bn' ? `${short}, ${hours} ঘণ্টা` : `${short}, ${hours} hours`;
}

function categoryFor(text: string): JobCategory | null {
  for (const [category, pattern] of CATEGORY_WORDS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

/** "3 hours", "৩ ঘণ্টা". */
function hoursIn(text: string): number | null {
  const western = text.match(/(\d{1,2})\s*(hours?|hrs?|ঘণ্টা|ঘন্টা)/i);
  if (western?.[1]) {
    const hours = Number(western[1]);
    if (hours > 0 && hours <= 24) return hours;
  }

  const BN = '০১২৩৪৫৬৭৮৯';
  const bangla = text.match(/([০-৯]{1,2})\s*(ঘণ্টা|ঘন্টা)/);
  if (bangla?.[1]) {
    const hours = Number([...bangla[1]].map((d) => BN.indexOf(d)).join(''));
    if (hours > 0 && hours <= 24) return hours;
  }
  return null;
}

/** "today", "tomorrow", "আগামীকাল" — nothing more adventurous without a model. */
function dayIn(text: string): string | null {
  const day = new Date();
  if (/tomorrow|আগামীকাল|কাল/i.test(text)) day.setDate(day.getDate() + 1);
  else if (/today|আজ/i.test(text)) {
    /* today */
  } else return null;
  return day.toISOString().slice(0, 10);
}

/** Never a date that has already gone by, whatever produced it. */
function futureOnly(date: string | null): string | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const today = new Date().toISOString().slice(0, 10);
  return date < today ? null : date;
}

function whenLine(hours: number | null, startsOn: string | null, language: 'en' | 'bn'): string {
  const parts: string[] = [];
  if (startsOn) {
    const today = new Date().toISOString().slice(0, 10);
    const isToday = startsOn === today;
    parts.push(
      language === 'bn' ? (isToday ? 'আজ' : 'আগামীকাল') : isToday ? 'Today' : 'Tomorrow',
    );
  }
  if (hours) parts.push(language === 'bn' ? `${hours} ঘণ্টা` : `${hours} hours`);
  return parts.join(language === 'bn' ? ', ' : ', ');
}

function basisLine(postings: number, language: 'en' | 'bn'): string {
  return language === 'bn'
    ? `এই ধরনের ${postings}টি খোলা বিজ্ঞপ্তি থেকে নেওয়া।`
    : `From ${postings} open postings like this one.`;
}

function unsourcedLine(language: 'en' | 'bn'): string {
  return language === 'bn'
    ? 'এই ধরনের কোনো বিজ্ঞপ্তি এখনও নেই, তাই অঙ্কটি আন্দাজ — বদলে নিন।'
    : 'Nothing like this has been posted here yet, so this figure is a guess — change it.';
}

function unknownCategoryLine(language: 'en' | 'bn'): string {
  return language === 'bn'
    ? 'কোন ধরনের কাজ তা বোঝা যায়নি — নিজে বেছে নিন।'
    : 'Could not tell what kind of work this is — pick a category yourself.';
}

function skillsLine(language: 'en' | 'bn'): string {
  return language === 'bn'
    ? 'দক্ষতাগুলো এই ধরনের কাজের সাধারণ চাহিদা থেকে বসানো — বদলে নিতে পারেন।'
    : 'The skills are the usual ones for this kind of work — change them if you need something else.';
}

function noHoursLine(language: 'en' | 'bn'): string {
  return language === 'bn'
    ? 'কত সময়ের কাজ তা বলা হয়নি।'
    : 'You did not say how long the work takes.';
}
