import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root — see the note in cv-writer.service.ts.
import * as z from 'zod/v4';
import type { CvProfile, Job } from '@prisma/client';
import type {
  MatchAxis,
  Shortlist,
  ShortlistCandidate,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/**
 * How the hundred points divide.
 *
 * Skills carry nearly half because they are what a recruiter screens on
 * first. The two attachment axes are small on purpose: having uploaded a
 * video is not a qualification, and weighting it heavily would sort for
 * people with a good phone and a quiet room rather than for people who can
 * do the work. They are there because a recruiter can only judge what they
 * can open, and a candidate with both is one whose shortlisting is a
 * decision rather than a guess.
 */
const WEIGHTS = { skills: 45, experience: 20, cv: 15, intro: 10, standing: 10 } as const;

/** The recruiter asked for five or six. Six, so there is something to cut. */
const SHORTLIST = 6;

/** Years each experience band implies at its midpoint. */
const LEVEL_YEARS: Record<Job['experienceLevel'], number> = {
  ENTRY: 0,
  ONE_TO_THREE: 2,
  THREE_TO_FIVE: 4,
  FIVE_PLUS: 7,
};

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
 * back the strongest six with the reasoning attached.
 *
 *     every live application
 *         -> score each against the posting's requirements
 *         -> order, take six
 *         -> a line for and a line against each
 *
 * It does not shortlist anybody. The recruiter presses the button on the
 * applicants screen, as they did before — what changes is that they now do it
 * after reading six ranked candidates instead of forty unsorted ones.
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
      .sort((a, b) => b.score - a.score || a.appliedAt.localeCompare(b.appliedAt))
      .slice(0, SHORTLIST);

    const language = (await this.languageOf(ownerId)) === 'en' ? 'en' : 'bn';
    const written = scored.length > 0 ? await this.read(job, scored, language) : null;

    return {
      jobId: job.id,
      jobTitle: job.title,
      considered: live.length,
      excluded: rows.length - live.length,
      withoutCv: live.filter((row) => !hasCv.has(row.userId)).length,
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

// --- the arithmetic ---

/**
 * The words a posting actually asks for.
 *
 * Requirements first, and only the title and description when a posting has
 * none — plenty are written in a hurry. Short and common words are dropped
 * because matching on "and" would give every CV a perfect score.
 */
function requirementWords(job: Job): string[] {
  const source = job.requirements?.trim()
    ? `${job.requirements} ${job.title}`
    : `${job.title} ${job.description}`;

  const words = source
    .toLowerCase()
    .split(/[^a-zঀ-৿]+/)
    .filter((word) => word.length >= 4 && !STOP.has(word));

  return [...new Set(words)].slice(0, 20);
}

/** Whether a CV says a word anywhere the parser recorded. */
function mentions(profile: CvProfile | null, word: string): boolean {
  if (!profile) return false;
  const hay = [...profile.skills, ...profile.titles, profile.summary ?? '']
    .join(' ')
    .toLowerCase();
  return hay.includes(word);
}

/**
 * The skills axis.
 *
 * Two thirds from how much of what the posting asks for the CV contains, one
 * third from having held the job before — which is the single strongest
 * signal a CV carries and the thing a recruiter screens on first. A posting
 * that lists no requirements at all cannot score anyone on them, so the
 * whole axis falls back to the title match rather than giving everybody
 * zero for the employer's omission.
 */
function skillPoints(
  matched: number,
  wanted: number,
  profile: CvProfile | null,
  job: Job,
): number {
  const title = job.title.toLowerCase();
  const heldIt = (profile?.titles ?? []).some((held) => {
    const t = held.trim().toLowerCase();
    return t.length >= 3 && (title.includes(t) || t.includes(title));
  });

  if (wanted === 0) return heldIt ? WEIGHTS.skills : 0;

  const overlap = Math.min(matched / wanted, 1);
  return Math.round(WEIGHTS.skills * (overlap * 0.66 + (heldIt ? 0.34 : 0)));
}

/**
 * The experience axis.
 *
 * Full marks at or above what the posting asks for, and falling away below
 * it — never negative for having more. An unstated number scores the middle
 * rather than zero: a CV that does not add up its years is a badly written
 * CV, not an inexperienced person, and the recruiter can see the titles.
 */
function experiencePoints(years: number | null, job: Job): number {
  const wanted = LEVEL_YEARS[job.experienceLevel];
  if (years === null) return Math.round(WEIGHTS.experience * 0.5);
  if (wanted === 0 || years >= wanted) return WEIGHTS.experience;
  return Math.round(WEIGHTS.experience * (years / wanted));
}

const STOP = new Set([
  'with', 'that', 'this', 'from', 'have', 'must', 'will', 'able', 'work',
  'working', 'good', 'need', 'needs', 'should', 'required',
  'requirement', 'requirements', 'candidate', 'applicant', 'person', 'people',
  'time', 'years', 'year', 'month', 'months', 'জন্য', 'করতে', 'হবে', 'থেকে',
  'এবং', 'সঙ্গে', 'কাজের', 'প্রয়োজন',
]);

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
