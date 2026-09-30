import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root — see the note in cv-writer.service.ts.
import * as z from 'zod/v4';
import type { CvProfile, Job } from '@prisma/client';
import {
  shortlistRange,
  type ApplyShortlistResult,
  type MatchAxis,
  type Shortlist,
  type ShortlistCandidate,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import {
  SHORTLIST_WEIGHTS as WEIGHTS,
  experiencePoints,
  mentions,
  requirementWords,
  skillPoints,
} from './applicant-fit';


/**
 * Where the list stops, inside the range the vacancies allow.
 *
 * The minimum is always taken when that many applied. The one extra place
 * goes to the next candidate only when they are as strong as the last one in
 * — within five points — so the list ends at a natural gap in the scores
 * rather than at a fixed count that cuts between two equals.
 */
function cutAt(scores: number[], range: { min: number; max: number }): number {
  if (scores.length <= range.min) return scores.length;
  const last = scores[range.min - 1]!;
  const next = scores[range.min]!;
  return next >= last - 5 ? Math.min(range.max, scores.length) : range.min;
}

const lineSchema = z.object({
  userId: z.string(),
  why: z.string().describe('One line for them. Facts from the CV only.'),
  reservation: z
    .string()
    .describe('One line against them, or what is still unknown. Never blank.'),
});

const SYSTEM = `You help somebody in Bangladesh choose who to interview for a
job they have posted. You are given the posting and a shortlist the system has
already scored and ordered.

You do not choose and you do not reorder. The ranking is arithmetic done
before you see it, from the CV against the posting's own requirements, and
the recruiter can see every part of it.

For each candidate you write exactly two lines:

1. "why" — the strongest true thing about them for this job, from the facts
   given. "Six years as an electrician, has the wiring and safety words the
   posting asks for" is the line. Never praise a person; state what they
   have. Never invent a skill, a job or a year.
2. "reservation" — what is missing, unclear, or worth asking about. This is
   never blank. If the CV is strong, the reservation is what it does not
   say: no intro video, nothing about the specific machine, a gap between
   jobs, only a parsed CV and no covering note. A shortlist that argues only
   in favour is one a recruiter stops checking, and a person who is passed
   over for an unasked question loses work they could have done.

Then two or three sentences over the whole field: what this set of applicants
looks like, and what the recruiter should be ready to find.

Judge the work, never the person. Say nothing about anybody's age, sex,
religion, home district, marital status or family — none of it predicts
whether someone can do a job, and in this market it is exactly what keeps
people out of work. If a CV mentions such a thing, ignore it.

Write in the language asked for.`;

/**
 * The AI Shortlist Assistant.
 *
 * Ranks everyone who applied against what the posting asks for, and hands
 * back the strongest few with the reasoning attached: four or five when the
 * job is for one person, seven or eight when it is for more.
 *
 *     every live application
 *         -> score each against the posting's requirements
 *         -> order, cut at 4–5 or 7–8
 *         -> a line for and a line against each
 *
 * Nobody is shortlisted until the recruiter says so — one tap on "Shortlist
 * all" (apply) or one per candidate — so the AI does the reading and the
 * sorting, and the decision stays with the person who has to live with it.
 */
@Injectable()
export class ShortlistService {
  private readonly logger = new Logger(ShortlistService.name);
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
      this.logger.warn('Shortlist: reading is off, lines will be assembled');
    }
  }

  async build(ownerId: string, jobId: string): Promise<Shortlist> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.postedBy !== ownerId) {
      throw AppException.notFound('That job is not yours to manage');
    }

    const rows = await this.prisma.jobApplication.findMany({
      where: { jobId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            locale: true,
            verificationLevel: true,
            cvProfile: true,
          },
        },
      },
    });

    // Withdrawn and rejected are out of the running, and counted so the
    // screen can say "6 of 23" rather than implying 23 are still live.
    const live = rows.filter(
      (row) => row.status !== 'WITHDRAWN' && row.status !== 'REJECTED',
    );

    const docs = await this.prisma.document.findMany({
      where: {
        userId: { in: live.map((row) => row.userId) },
        kind: { in: ['CV', 'INTRO_VIDEO'] },
      },
      select: { userId: true, kind: true },
    });
    const hasCv = new Set(docs.filter((d) => d.kind === 'CV').map((d) => d.userId));
    const hasIntro = new Set(
      docs.filter((d) => d.kind === 'INTRO_VIDEO').map((d) => d.userId),
    );

    const wanted = requirementWords(job);

    const scored = live
      .map((row) => {
        const profile = row.user.cvProfile;
        const matched = wanted.filter((word) => mentions(profile, word));
        const missing = wanted.filter((word) => !matched.includes(word));

        const axes: MatchAxis[] = [
          {
            key: 'skills',
            earned: skillPoints(matched.length, wanted.length, profile, job),
            possible: WEIGHTS.skills,
          },
          {
            key: 'experience',
            earned: experiencePoints(profile?.yearsExperience ?? null, job),
            possible: WEIGHTS.experience,
          },
          {
            key: 'cv',
            earned: hasCv.has(row.userId) ? (profile ? WEIGHTS.cv : 8) : 0,
            possible: WEIGHTS.cv,
          },
          {
            key: 'intro',
            earned: hasIntro.has(row.userId) ? WEIGHTS.intro : 0,
            possible: WEIGHTS.intro,
          },
          {
            key: 'standing',
            earned:
              (row.user.verificationLevel >= 1 ? 6 : 0) + (row.message?.trim() ? 4 : 0),
            possible: WEIGHTS.standing,
          },
        ];

        const candidate: ShortlistCandidate = {
          userId: row.userId,
          name:
            [row.user.firstName, row.user.lastName].filter(Boolean).join(' ').trim() ||
            'Applicant',
          verified: row.user.verificationLevel >= 1,
          status: row.status,
          appliedAt: row.appliedAt.toISOString(),
          score: axes.reduce((total, axis) => total + axis.earned, 0),
          axes,
          matchedSkills: matched.slice(0, 8),
          missingSkills: missing.slice(0, 6),
          yearsExperience: profile?.yearsExperience ?? null,
          titles: profile?.titles.slice(0, 4) ?? [],
          summary: profile?.summary ?? null,
          hasCv: hasCv.has(row.userId),
          hasIntro: hasIntro.has(row.userId),
          message: row.message,
          why: '',
          reservation: '',
        };
        return candidate;
      })
      // Applied earlier breaks a tie: two equal candidates, and the one who
      // answered first has waited longer for a reply.
      .sort((a, b) => b.score - a.score || a.appliedAt.localeCompare(b.appliedAt));

    const range = shortlistRange(job.vacancies);
    scored.splice(cutAt(scored.map((person) => person.score), range));

    const language = (await this.languageOf(ownerId)) === 'en' ? 'en' : 'bn';
    const written = scored.length > 0 ? await this.read(job, scored, language) : null;

    return {
      jobId: job.id,
      jobTitle: job.title,
      considered: live.length,
      excluded: rows.length - live.length,
      withoutCv: live.filter((row) => !hasCv.has(row.userId)).length,
      vacancies: job.vacancies,
      sizeMin: range.min,
      sizeMax: range.max,
      candidates: scored.map((person) => {
        const lines = written?.lines.get(person.userId);
        return {
          ...person,
          why: lines?.why.trim() || assembleWhy(person, language),
          reservation: lines?.reservation.trim() || assembleReservation(person, language),
        };
      }),
      summary:
        written?.summary.trim() ||
        assembleSummary(scored, live.length, language),
      source: written ? 'written' : 'assembled',
    };
  }

  /**
   * "Shortlist all": the recruiter accepts the AI's picks in one tap.
   *
   * Takes the ids the recruiter was shown rather than re-ranking, so what
   * lands on the shortlist is exactly the list they read even if someone
   * applied in between. Only people still waiting on a decision move — a
   * hire, a turned-down or a withdrawn application is never overwritten.
   */
  async apply(ownerId: string, jobId: string, userIds: string[]): Promise<ApplyShortlistResult> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { postedBy: true },
    });
    if (!job || job.postedBy !== ownerId) {
      throw AppException.notFound('That job is not yours to manage');
    }

    const { count } = await this.prisma.jobApplication.updateMany({
      where: { jobId, userId: { in: userIds }, status: { in: ['SUBMITTED', 'VIEWED'] } },
      data: { status: 'SHORTLISTED' },
    });

    this.logger.log(`Shortlist ${jobId}: ${count} shortlisted in one tap by ${ownerId}`);
    return { shortlisted: count };
  }

  private async read(
    job: Job,
    people: ShortlistCandidate[],
    language: 'en' | 'bn',
  ): Promise<{ lines: Map<string, { why: string; reservation: string }>; summary: string } | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 2000,
        output_config: {
          effort: 'low',
          format: zodOutputFormat(
            z.object({ lines: z.array(lineSchema), summary: z.string() }),
          ),
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write in ${language === 'bn' ? 'Bangla' : 'English'}.`,
              '',
              'The posting:',
              `- Title: ${job.title}`,
              `- Wants: ${job.requirements?.trim() || 'nothing written down'}`,
              `- Describes the work as: ${job.description.slice(0, 700)}`,
              `- Experience asked for: ${job.experienceLevel}`,
              '',
              'The candidates, in the order they will be shown:',
              ...people.map((person, i) =>
                [
                  `${i + 1}. id=${person.userId} name=${person.name} score=${person.score}`,
                  `   held: ${person.titles.join(', ') || 'not stated'}`,
                  `   years: ${person.yearsExperience ?? 'not stated'}`,
                  `   requirement words in their CV: ${person.matchedSkills.join(', ') || 'none'}`,
                  `   requirement words not in their CV: ${person.missingSkills.join(', ') || 'none'}`,
                  `   CV: ${person.hasCv ? 'yes' : 'no'}; intro video: ${person.hasIntro ? 'yes' : 'no'}; verified: ${person.verified ? 'yes' : 'no'}`,
                  `   their CV summary: ${person.summary ?? 'none'}`,
                  `   what they wrote when applying: ${person.message?.slice(0, 300) ?? 'nothing'}`,
                ].join('\n'),
              ),
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const parsed = response.parsed_output;
      if (!parsed) return null;

      return {
        lines: new Map(
          parsed.lines.map(
            (line) =>
              [line.userId, { why: line.why, reservation: line.reservation }] as const,
          ),
        ),
        summary: parsed.summary,
      };
    } catch (err) {
      this.logger.error(
        `Shortlist reading failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async languageOf(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return user?.locale ?? 'bn';
  }
}

// --- the words, when there is no model ---

function assembleWhy(person: ShortlistCandidate, language: 'en' | 'bn'): string {
  const bits: string[] = [];

  if (language === 'bn') {
    if (person.titles.length > 0) bits.push(person.titles.slice(0, 2).join(', '));
    if (person.yearsExperience !== null) bits.push(`${bn(person.yearsExperience)} বছরের অভিজ্ঞতা`);
    if (person.matchedSkills.length > 0)
      bits.push(`মিল আছে: ${person.matchedSkills.slice(0, 3).join(', ')}`);
    return bits.length > 0 ? bits.join(' · ') : 'সিভিতে এই কাজের মতো কিছু পাওয়া যায়নি।';
  }

  if (person.titles.length > 0) bits.push(person.titles.slice(0, 2).join(', '));
  if (person.yearsExperience !== null) {
    bits.push(`${person.yearsExperience} ${person.yearsExperience === 1 ? 'year' : 'years'}`);
  }
  if (person.matchedSkills.length > 0) {
    bits.push(`matches on ${person.matchedSkills.slice(0, 3).join(', ')}`);
  }
  return bits.length > 0 ? bits.join(' · ') : 'Nothing in the CV lines up with this posting.';
}

/**
 * The line against, assembled.
 *
 * Ordered by what most changes a decision: no CV at all first, then missing
 * requirements, then what cannot be checked. It is never empty — see the
 * prompt's second rule for why that matters.
 */
function assembleReservation(person: ShortlistCandidate, language: 'en' | 'bn'): string {
  const bn_ = language === 'bn';

  if (!person.hasCv) {
    return bn_
      ? 'কোনো সিভি নেই — যাচাই করার মতো কিছু নেই, তাই নম্বর কম হতে পারে যোগ্যতার অভাবে নয়।'
      : 'No CV at all, so there is nothing to check. A low score here may mean nothing was uploaded, not that they cannot do the work.';
  }
  if (person.missingSkills.length > 0) {
    const list = person.missingSkills.slice(0, 3).join(', ');
    return bn_
      ? `সিভিতে নেই: ${list} — জিজ্ঞেস করে নিন।`
      : `Nothing in the CV about ${list} — worth asking.`;
  }
  if (!person.hasIntro) {
    return bn_
      ? 'কোনো পরিচিতি ভিডিও নেই, তাই কথা বলার ধরন দেখা যাচ্ছে না।'
      : 'No intro video, so there is no sense yet of how they come across.';
  }
  if (!person.message) {
    return bn_
      ? 'আবেদনের সঙ্গে কিছু লেখেননি — কেন এই কাজ, জানা যায়নি।'
      : 'They wrote nothing with the application, so their reason for applying is unknown.';
  }
  return bn_
    ? 'কাগজে সব মিলছে; বাকিটা কথা বলে দেখুন।'
    : 'It all lines up on paper. The rest is what an interview is for.';
}

function assembleSummary(
  people: ShortlistCandidate[],
  considered: number,
  language: 'en' | 'bn',
): string {
  const bn_ = language === 'bn';
  if (people.length === 0) {
    return bn_
      ? 'এখনো কেউ আবেদন করেননি, তাই তালিকা তৈরি করার কিছু নেই।'
      : 'Nobody has applied yet, so there is nothing to rank.';
  }

  const top = people[0]!;
  const strong = people.filter((p) => p.score >= 60).length;
  const noCv = people.filter((p) => !p.hasCv).length;

  const parts: string[] = [];
  parts.push(
    bn_
      ? `${bn(considered)}টি আবেদনের মধ্যে সবচেয়ে বেশি মিল ${top.name}-এর, ${bn(top.score)}%।`
      : `Out of ${considered} applications, ${top.name} matches best at ${top.score}%.`,
  );
  parts.push(
    strong > 1
      ? bn_
        ? `${bn(strong)} জনের মিল ৬০%-এর বেশি।`
        : `${strong} of them are above 60%.`
      : bn_
        ? 'একজনের বাইরে কারও মিল ৬০%-এর বেশি নয়।'
        : 'Only one is above 60%.',
  );
  if (noCv > 0) {
    parts.push(
      bn_
        ? `${bn(noCv)} জনের কোনো সিভি নেই, তাই তাঁদের নম্বর কম — যোগ্যতার অভাবে নয়।`
        : `${noCv} of them uploaded no CV, so their score is low for want of anything to read.`,
    );
  }
  return parts.join(' ');
}

function bn(value: number): string {
  const digits = '০১২৩৪৫৬৭৮৯';
  return String(value).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}
