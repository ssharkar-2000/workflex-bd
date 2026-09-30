import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root: zodOutputFormat is typed against v4 while the
// rest of the repo is on the v3 API — the same split the CV writer lives with.
import * as z from 'zod/v4';
import { jobCategoryName, type ApplyDraft } from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import type { Env } from '../config/env.schema';

/** The application allows 500 characters; a note that fills them is a letter. */
const LIMIT = 420;

const noteSchema = z.object({
  message: z
    .string()
    .describe('Two or three sentences, first person, under 400 characters.'),
});

const SYSTEM = `You write the short note that goes with a job application in
Bangladesh, for workers applying to shifts and jobs: drivers, cleaners,
kitchen staff, guards, tutors, care workers, shop assistants.

You are given the posting and what this platform knows about the applicant —
the skills read from their CV, the years they have given, and the jobs they
were actually hired for here.

Rules you do not break:

1. Invent nothing. No employer, no length of service, no qualification that
   is not in what you were given. If there is little to say, the note is
   short. A short true note gets read; an impressive false one gets found out
   at the interview.
2. Two or three sentences, first person, under 400 characters. This is a note
   beside an application, not a cover letter.
3. Say what they have done that matches this posting, then that they are
   available. Nothing about being hardworking, passionate or dedicated —
   every applicant says it and no employer believes it.
4. Plain words a busy employer reads in ten seconds. No greeting, no
   "Dear Sir/Madam", no sign-off: the platform already shows who is applying.
5. Write in the language asked for. Natural Bangla for Bangla, not
   transliterated English.
6. If the account has no CV and no work history here, say plainly that they
   are new to the platform and what they are offering. Do not pad it.`;

/**
 * One-Click Apply: the application note, prepared from the CV and the profile.
 *
 * Nothing is sent by this. It returns a note the applicant reads, edits if
 * they want to, and sends by pressing Apply — an application that posts
 * itself is a message somebody did not write in their own name.
 *
 * The facts it used come back with it, so an applicant can see the note is
 * built from their own record rather than from nothing, and can tell when
 * that record is thin.
 */
@Injectable()
export class ApplyDraftService {
  private readonly logger = new Logger(ApplyDraftService.name);
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
      this.logger.warn('Apply drafting is off — notes will be assembled');
    }
  }

  async draft(userId: string, jobId: string): Promise<ApplyDraft> {
    const [job, user, hires] = await Promise.all([
      this.prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true, category: true, location: true, companyName: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          locale: true,
          address: true,
          cvProfile: {
            select: { titles: true, skills: true, yearsExperience: true, summary: true },
          },
        },
      }),
      this.prisma.jobApplication.findMany({
        where: { userId, status: 'ACCEPTED' },
        orderBy: { appliedAt: 'desc' },
        take: 5,
        select: { job: { select: { title: true, companyName: true } } },
      }),
    ]);

    if (!job) throw AppException.notFound('Job not found');

    const language = user?.locale === 'en' ? 'en' : 'bn';
    const cv = user?.cvProfile ?? null;

    // What the note is allowed to draw on, and what the screen shows back.
    const from: string[] = [];
    if (cv?.titles?.length) from.push(cv.titles.slice(0, 2).join(', '));
    if (cv?.yearsExperience) {
      from.push(
        language === 'bn'
          ? `${cv.yearsExperience} বছরের অভিজ্ঞতা`
          : `${cv.yearsExperience} years of experience`,
      );
    }
    if (cv?.skills?.length) from.push(cv.skills.slice(0, 4).join(', '));
    if (hires.length) {
      from.push(
        language === 'bn'
          ? `ওয়ার্কফ্লেক্সে ${hires.length}টি কাজে নিয়োগ পেয়েছেন`
          : `hired for ${hires.length} job${hires.length === 1 ? '' : 's'} on WorkFlex BD`,
      );
    }
    if (user?.address) from.push(user.address);

    const assembled = this.template({ job, cv, hires: hires.length, language });
    if (!this.client) {
      return { message: assembled, from, source: 'assembled', usedCv: Boolean(cv) };
    }

    const written = await this.write({ job, cv, hires, language, assembled });
    return {
      message: written ?? assembled,
      from,
      source: written ? 'written' : 'assembled',
      usedCv: Boolean(cv),
    };
  }

  private async write(input: {
    job: { title: string; category: string; location: string; companyName: string };
    cv: { titles: string[]; skills: string[]; yearsExperience: number | null; summary: string | null } | null;
    hires: { job: { title: string; companyName: string } }[];
    language: 'en' | 'bn';
    assembled: string;
  }): Promise<string | null> {
    try {
      const response = await this.client!.messages.parse({
        model: this.model,
        max_tokens: 600,
        output_config: { effort: 'low', format: zodOutputFormat(noteSchema) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write the note in ${input.language === 'bn' ? 'Bangla' : 'English'}.`,
              '',
              '<the_posting>',
              JSON.stringify(input.job, null, 1),
              '</the_posting>',
              '',
              '<from_their_cv>',
              input.cv ? JSON.stringify(input.cv, null, 1) : '(no CV uploaded)',
              '</from_their_cv>',
              '',
              '<hired_for_on_this_platform>',
              input.hires.length
                ? JSON.stringify(input.hires.map((hire) => hire.job), null, 1)
                : '(nothing yet)',
              '</hired_for_on_this_platform>',
              '',
              '<a_plain_version>',
              input.assembled,
              '</a_plain_version>',
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const message = response.parsed_output?.message?.trim();
      return message ? message.slice(0, LIMIT) : null;
    } catch (err) {
      this.logger.error(
        `Apply drafting failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /**
   * The note without a model: the account's own facts in a sentence.
   *
   * Deliberately flat. It is somebody's record read back to them, and the
   * screen says it was assembled rather than written, so nobody sends it
   * believing a machine made a case for them.
   */
  private template(input: {
    job: { title: string; category: string };
    cv: { titles: string[]; skills: string[]; yearsExperience: number | null } | null;
    hires: number;
    language: 'en' | 'bn';
  }): string {
    const { language } = input;
    const bn = language === 'bn';
    const field = jobCategoryName(input.job.category as never, language);
    const parts: string[] = [];

    const role = input.cv?.titles?.[0];
    const years = input.cv?.yearsExperience ?? 0;

    if (role && years > 0) {
      parts.push(
        bn
          ? `আমি ${role} হিসেবে ${bnNum(years)} বছর কাজ করেছি।`
          : `I have worked as a ${role} for ${years} years.`,
      );
    } else if (role) {
      parts.push(bn ? `আমি ${role} হিসেবে কাজ করি।` : `I work as a ${role}.`);
    } else {
      parts.push(
        bn
          ? `আমি ${field} ক্ষেত্রের কাজ খুঁজছি।`
          : `I am looking for ${field.toLowerCase()} work.`,
      );
    }

    const skills = input.cv?.skills?.slice(0, 3) ?? [];
    if (skills.length > 0) {
      parts.push(
        bn ? `আমার দক্ষতা: ${skills.join(', ')}।` : `I can do ${skills.join(', ')}.`,
      );
    }

    if (input.hires > 0) {
      parts.push(
        bn
          ? `ওয়ার্কফ্লেক্স বিডির মাধ্যমে ${bnNum(input.hires)}টি কাজে নিয়োগ পেয়েছি।`
          : `I have been hired for ${input.hires} job${input.hires === 1 ? '' : 's'} through WorkFlex BD.`,
      );
    }

    parts.push(bn ? 'কাজটির জন্য আমি প্রস্তুত আছি।' : 'I am available for this work.');

    return parts.join(' ').slice(0, LIMIT);
  }
}

/** Bangla prose takes Bangla numerals, as the rest of the app's copy does. */
function bnNum(value: number): string {
  const digits = '০১২৩৪৫৬৭৮৯';
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}
