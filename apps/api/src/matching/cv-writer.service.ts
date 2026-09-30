import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root: zodOutputFormat is typed against v4 while the
// rest of the repo is on the v3 API — the same split the CV parser lives with.
import * as z from 'zod/v4';
import {
  type CvBulletsDto,
  type CvBulletsResult,
  type CvDraftResult,
  type CvEntry,
  type CvSummaryDto,
  type CvSummaryResult,
  type GenerateCvDto,
  type GeneratedCv,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { cvBulletLines, cvSummaryText, type CvLanguage } from './cv-phrases';
import type { Env } from '../config/env.schema';

const entrySchema = z.object({
  title: z.string().describe('The job title, qualification or certificate name.'),
  org: z.string().describe('Employer, school or issuing body. Empty if unknown.'),
  place: z.string().describe('Town or area. Empty if unknown.'),
  from: z.string().describe('Start year as given. Empty if unknown — never guess.'),
  to: z.string().describe('End year, or "now". Empty if unknown.'),
  detail: z
    .string()
    .describe('One line per point, newline separated. Two to four at most.'),
});

const draftSchema = z.object({
  summary: z.string().describe('Two or three plain sentences. Empty if there is nothing true to say.'),
  headline: z.string().describe('What they do, in three or four words.'),
  experience: z.array(entrySchema),
  education: z.array(entrySchema),
  certificates: z.array(entrySchema),
  skills: z.array(z.string()).describe('Concrete skills only, never personality traits.'),
  languages: z.array(z.string()),
});

/** The summary on its own — the model returns a sentence, not a CV. */
const summaryOnlySchema = z.object({
  summary: z
    .string()
    .describe('Two or three plain sentences, third person, no pronouns, nothing invented.'),
});

/** The points for one job on its own. */
const bulletsOnlySchema = z.object({
  bullets: z
    .array(z.string())
    .describe('Two to four lines. One duty each, starting with what they did.'),
});

const SYSTEM = `You write CVs for workers in Bangladesh: cleaners, drivers,
kitchen staff, tutors, security guards, shop assistants, care workers, and
office staff at small companies.

You are given what a platform knows about one person — their own words, what
was read from any CV they uploaded, and the jobs they were actually hired for
through the platform. Arrange that into a CV an employer can read in thirty
seconds.

Rules you do not break:

1. Invent nothing. No employer, date, qualification, certificate or duty that
   is not in the input. If the input is thin, the CV is short. A short true CV
   gets someone hired; an impressive false one gets them dismissed in week one.
2. Keep the person's own words where they wrote something. You may fix spelling
   and grammar. You may not replace their sentence with a better one.
3. No adjectives the person has not earned in the input. Not "dynamic", not
   "passionate", not "results-driven". Say what they did and for how long.
4. Write the summary in two or three plain sentences, in the third person
   without pronouns — "Six years running kitchen teams in Dhaka." — not "I am
   a hardworking..." and not "Rahima is a hardworking...".
5. Experience bullets: one line each, starting with what they did, with a
   number where the input gives one. Two to four per job at most.
6. Dates exactly as the input gives them. If a date is unknown, leave it empty
   rather than guessing a year.
7. Write in the language asked for. For Bangla, use natural Bangla — do not
   transliterate English sentences. Keep proper nouns, job titles and company
   names as they are written.

If there is almost nothing to work with, return what little there is and leave
the rest empty. Do not pad.`;

/**
 * Drafting a CV from what the account already holds.
 *
 * Two paths, and the caller is told which ran. With the model configured it
 * arranges and phrases the person's own details; without it, the same details
 * are laid out unphrased. The second is not a degraded imitation of the first
 * — it is the honest thing to show when there is no model: the person's facts,
 * in the right boxes, with nothing written for them.
 *
 * Nothing here saves anything. The draft goes back to the builder, where the
 * person edits it and decides what to keep.
 */
@Injectable()
export class CvWriterService {
  private readonly logger = new Logger(CvWriterService.name);
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
      this.logger.warn('CV writing is off — drafts will be assembled, not written');
    }
  }

  async generate(userId: string, dto: GenerateCvDto): Promise<CvDraftResult> {
    const facts = await this.gather(userId);
    const assembled = this.assemble(facts, dto);

    const used = {
      usedProfile: Boolean(facts.firstName || facts.address),
      usedCvUpload: Boolean(facts.cv),
      usedWorkHistory: facts.hires.length > 0,
    };

    if (!this.client) {
      return { cv: assembled, source: 'assembled', ...used };
    }

    const written = await this.write(facts, dto, assembled);
    return written
      ? { cv: written, source: 'written', ...used }
      : { cv: assembled, source: 'assembled', ...used };
  }

  // --- what the platform knows ---

  private async gather(userId: string) {
    const [user, hires, shifts] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          address: true,
          locale: true,
          cvProfile: {
            select: {
              titles: true,
              skills: true,
              summary: true,
              yearsExperience: true,
              categories: true,
            },
          },
        },
      }),
      this.prisma.jobApplication.findMany({
        where: { userId, status: 'ACCEPTED' },
        orderBy: { appliedAt: 'desc' },
        take: 20,
        select: {
          appliedAt: true,
          job: { select: { id: true, title: true, companyName: true, location: true, category: true } },
        },
      }),
      this.prisma.shift.findMany({
        where: { workerId: userId, status: 'COMPLETED' },
        orderBy: { startsAt: 'desc' },
        take: 50,
        select: { jobId: true, startsAt: true, endsAt: true },
      }),
    ]);

    // How many shifts were worked on each job, which is the one piece of
    // evidence this platform has that a person actually turned up.
    const shiftsByJob = new Map<string, number>();
    for (const shift of shifts) {
      shiftsByJob.set(shift.jobId, (shiftsByJob.get(shift.jobId) ?? 0) + 1);
    }

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      email: user.email,
      address: user.address,
      locale: user.locale,
      cv: user.cvProfile,
      hires: hires.map((hire) => ({
        title: hire.job.title,
        company: hire.job.companyName,
        place: hire.job.location,
        category: hire.job.category,
        since: hire.appliedAt.getFullYear().toString(),
        shifts: shiftsByJob.get(hire.job.id) ?? 0,
      })),
    };
  }

  /**
   * The same facts, without a model: stored details in the right boxes.
   *
   * This is what the person gets when the model is off or fails, and it is
   * also what the model is handed as a starting point — so the two paths
   * never disagree about the facts, only about the phrasing.
   */
  private assemble(facts: Facts, dto: GenerateCvDto): GeneratedCv {
    const existing = dto.existing ?? {};

    const experience: CvEntry[] = facts.hires.map((hire) => ({
      title: hire.title,
      org: hire.company,
      place: hire.place,
      from: hire.since,
      to: '',
      detail: hire.shifts > 0 ? `${hire.shifts} shifts completed through WorkFlex BD.` : '',
    }));

    return {
      summary: existing.summary?.trim() || facts.cv?.summary || '',
      headline: existing.headline?.trim() || facts.cv?.titles[0] || dto.targetRole?.trim() || '',
      // Anything the person typed wins; the platform's record fills the gap.
      experience: existing.experience?.length ? existing.experience.map(entry) : experience,
      education: (existing.education ?? []).map(entry),
      certificates: (existing.certificates ?? []).map(entry),
      skills: existing.skills?.length ? existing.skills : (facts.cv?.skills ?? []),
      languages: existing.languages?.length ? existing.languages : [],
    };
  }

  private async write(
    facts: Facts,
    dto: GenerateCvDto,
    assembled: GeneratedCv,
  ): Promise<GeneratedCv | null> {
    const language = dto.language ?? (facts.locale === 'en' ? 'en' : 'bn');

    try {
      const response = await this.client!.messages.parse({
        model: this.model,
        max_tokens: 4000,
        // The judgement here is what to leave out, not how much to produce.
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'low',
          format: zodOutputFormat(draftSchema),
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write this person's CV in ${language === 'bn' ? 'Bangla' : 'English'}.`,
              dto.targetRole?.trim() ? `They are applying for: ${dto.targetRole.trim()}` : '',
              '',
              '<what_they_wrote>',
              JSON.stringify(dto.existing ?? {}, null, 1),
              '</what_they_wrote>',
              '',
              '<their_profile>',
              JSON.stringify(
                {
                  name: [facts.firstName, facts.lastName].filter(Boolean).join(' '),
                  lives: facts.address,
                  fromTheirUploadedCv: facts.cv,
                },
                null,
                1,
              ),
              '</their_profile>',
              '',
              '<work_through_this_platform>',
              JSON.stringify(facts.hires, null, 1),
              '</work_through_this_platform>',
              '',
              '<already_arranged>',
              JSON.stringify(assembled, null, 1),
              '</already_arranged>',
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') {
        this.logger.warn(
          `CV writing declined: ${response.stop_details?.category ?? 'unknown'}`,
        );
        return null;
      }

      const parsed = response.parsed_output;
      if (!parsed) {
        this.logger.warn('CV writing returned no parsable output');
        return null;
      }

      return parsed;
    } catch (err) {
      // A failed draft is not a failed request: the assembled one still goes
      // back, and the person is told it was assembled rather than written.
      this.logger.error(
        `CV writing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  // --- one section at a time ---

  /**
   * The summary alone, for the button beside that box.
   *
   * Drafting the whole CV is the right first move on an empty builder and the
   * wrong one once somebody has written three sections by hand. This rewrites
   * the paragraph they are looking at and touches nothing else.
   *
   * What the person has typed into the builder wins over what the account
   * holds — they are editing it because they know better than their profile
   * does — and the account only fills what they left blank.
   */
  async summary(userId: string, dto: CvSummaryDto): Promise<CvSummaryResult> {
    const facts = await this.gather(userId);
    const language: CvLanguage = dto.language ?? (facts.locale === 'en' ? 'en' : 'bn');

    const headline = (dto.headline ?? '').trim() || facts.cv?.titles[0] || '';
    const years = dto.years ?? facts.cv?.yearsExperience ?? 0;
    const skills = dto.skills?.length ? dto.skills : (facts.cv?.skills ?? []);
    const variant = dto.variant ?? 0;

    const assembled = cvSummaryText({ headline, years, skills, language, variant });
    if (!this.client) return { summary: assembled, source: 'assembled' };

    const written = await this.writeSummary({
      headline,
      years,
      skills,
      language,
      variant,
      assembled,
      facts,
    });
    return written
      ? { summary: written, source: 'written' }
      : { summary: assembled, source: 'assembled' };
  }

  /**
   * The points for one job.
   *
   * If the platform hired this person for that job it knows the dates and how
   * many shifts they actually worked, and that record is handed to the model
   * — a number somebody earned is worth more on a CV than any sentence about
   * the role in general.
   */
  async bullets(userId: string, dto: CvBulletsDto): Promise<CvBulletsResult> {
    const facts = await this.gather(userId);
    const language: CvLanguage = dto.language ?? (facts.locale === 'en' ? 'en' : 'bn');
    const skills = dto.skills?.length ? dto.skills : (facts.cv?.skills ?? []);
    const org = (dto.org ?? '').trim();

    const hire =
      facts.hires.find((row) => alike(row.title, dto.role)) ??
      (org ? facts.hires.find((row) => alike(row.company, org)) : undefined);

    const assembled = cvBulletLines({
      role: dto.role,
      org,
      skills,
      language,
      category: hire?.category ?? null,
    });
    if (!this.client) return { bullets: assembled, source: 'assembled' };

    const written = await this.writeBullets({
      role: dto.role,
      org,
      skills,
      language,
      hire,
      assembled,
    });
    return written
      ? { bullets: written, source: 'written' }
      : { bullets: assembled, source: 'assembled' };
  }

  private async writeSummary(input: {
    headline: string;
    years: number;
    skills: string[];
    language: CvLanguage;
    variant: number;
    assembled: string;
    facts: Facts;
  }): Promise<string | null> {
    try {
      const response = await this.client!.messages.parse({
        model: this.model,
        max_tokens: 800,
        output_config: { effort: 'low', format: zodOutputFormat(summaryOnlySchema) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write only the summary paragraph for this person's CV, in ${
                input.language === 'bn' ? 'Bangla' : 'English'
              }.`,
              input.variant > 0
                ? 'They pressed the button again: same facts, different wording from the draft below.'
                : '',
              '',
              `<job_title>${input.headline}</job_title>`,
              `<years_of_experience>${input.years || 'unknown'}</years_of_experience>`,
              `<skills>${input.skills.join(', ')}</skills>`,
              '',
              '<their_profile>',
              JSON.stringify(
                {
                  lives: input.facts.address,
                  fromTheirUploadedCv: input.facts.cv,
                  workThroughThisPlatform: input.facts.hires,
                },
                null,
                1,
              ),
              '</their_profile>',
              '',
              '<current_draft>',
              input.assembled,
              '</current_draft>',
            ]
              .filter((line) => line !== '')
              .join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const text = response.parsed_output?.summary?.trim();
      return text ? text : null;
    } catch (err) {
      this.logger.error(
        `CV summary failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async writeBullets(input: {
    role: string;
    org: string;
    skills: string[];
    language: CvLanguage;
    hire: Facts['hires'][number] | undefined;
    assembled: string[];
  }): Promise<string[] | null> {
    try {
      const response = await this.client!.messages.parse({
        model: this.model,
        max_tokens: 800,
        output_config: { effort: 'low', format: zodOutputFormat(bulletsOnlySchema) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write the points for one job on this person's CV, in ${
                input.language === 'bn' ? 'Bangla' : 'English'
              }.`,
              'Two to four lines. One duty each. Nothing invented: no employer, date or',
              'number that is not given below.',
              '',
              `<job_title>${input.role}</job_title>`,
              `<employer>${input.org}</employer>`,
              `<their_skills>${input.skills.join(', ')}</their_skills>`,
              input.hire
                ? `<this_platforms_record>${JSON.stringify(input.hire)}</this_platforms_record>`
                : '',
              '',
              '<current_draft>',
              input.assembled.join('\n'),
              '</current_draft>',
            ]
              .filter((line) => line !== '')
              .join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const lines = (response.parsed_output?.bullets ?? [])
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 4);
      return lines.length ? lines : null;
    } catch (err) {
      this.logger.error(
        `CV points failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

type Facts = Awaited<ReturnType<CvWriterService['gather']>>;

/**
 * Two job titles that are the same job.
 *
 * Someone types "Delivery man" where the posting said "Food delivery"; an
 * exact match would find nothing and throw away the shift count that makes
 * the bullet worth reading.
 */
function alike(a: string, b: string): boolean {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');
  const [x, y] = [norm(a), norm(b)];
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}

/** A half-filled entry from the builder, with every field present. */
function entry(row: Partial<CvEntry>): CvEntry {
  return {
    title: row.title ?? '',
    org: row.org ?? '',
    place: row.place ?? '',
    from: row.from ?? '',
    to: row.to ?? '',
    detail: row.detail ?? '',
  };
}
