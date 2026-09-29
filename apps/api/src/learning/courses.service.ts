import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root: zodOutputFormat is typed against v4 while the
// rest of the repo is on the v3 API — the same split the CV writer lives with.
import * as z from 'zod/v4';
import type {
  CourseSuggestion,
  CourseSuggestions,
  SkillGap,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { SkillGapService } from '../matching/skill-gap.service';
import type { Env } from '../config/env.schema';

/** At most this many suggestions, one per gap, strongest demand first. */
const MOST = 5;

const courseSchema = z.object({
  title: z
    .string()
    .describe('The course as it would be searched for. A course, not a topic.'),
  provider: z
    .string()
    .describe('Who runs it — YouTube, Google Digital Garage, freeCodeCamp.'),
  skill: z.string().describe('The gap from the list given, copied exactly.'),
  why: z
    .string()
    .describe('One plain sentence using the demand numbers given. No adjectives.'),
  minutes: z
    .number()
    .int()
    .nullable()
    .describe('Rough length. Null unless it is actually known.'),
});

const coursesSchema = z.object({ courses: z.array(courseSchema) });

const SYSTEM = `You suggest free online courses to workers in Bangladesh:
drivers, kitchen staff, shop assistants, security guards, care workers,
tutors, office staff and junior technical workers.

You are given the skills already on someone's CV, and the skills that open
postings in their field are asking for that their CV does not show. Suggest
where to go and learn the missing ones.

Rules you do not break:

1. Free to start, with no card required. If the only course you know for a
   skill costs money, say the subject plainly instead and let the search find
   what is free today — do not recommend something the reader cannot afford.
2. Never write a URL. You do not know which links still work; the app turns
   your title and provider into a search, which always does.
3. Name a real course and a real provider where you know one. Where you do
   not, give the subject as a person would search for it — "Basic spoken
   English for hotel work" — rather than inventing a course that does not
   exist. An invented course name wastes somebody's afternoon.
4. Prefer what works on a phone, on mobile data, in Bangladesh: YouTube,
   Google Digital Garage, freeCodeCamp, Khan Academy, Alison, Microsoft
   Learn, Coursera's audit track.
5. One course per skill, strongest demand first, and never more than asked.
6. "why" states the demand you were given — "11 of 34 open jobs in your field
   ask for this" — not how useful you think the skill is.
7. Write in the language asked for. Keep course and provider names in their
   own language; a Bangla sentence around an English course name is right.`;

/**
 * Where to learn what the CV is missing.
 *
 * The suggestions are made fresh on every request rather than stored. They
 * are derived from postings that are open right now, and a list saved last
 * month would quietly stop matching the demand it claims to answer.
 *
 * Two paths, and the caller is told which ran — the same arrangement as the
 * CV writer. With the model configured it picks courses it knows; without
 * it, the gaps themselves become searches. The second is not a broken
 * version of the first: a search for "free forklift training course" is a
 * genuinely useful thing to hand somebody, and it invents nothing.
 */
@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly skillGap: SkillGapService,
  ) {
    const enabled = this.config.get('CV_PARSER', { infer: true }) === 'claude';
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    this.model = this.config.get('CV_PARSER_MODEL', { infer: true });

    this.client = enabled && apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('Course suggestions are off — gaps will become searches');
    }
  }

  async suggest(userId: string): Promise<CourseSuggestions> {
    const [path, user] = await Promise.all([
      this.skillGap.path(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { locale: true, cvProfile: { select: { skills: true } } },
      }),
    ]);

    // Nothing to answer. The screen hides the section rather than filling it
    // with courses for skills nobody asked this person for.
    if (!path || path.gaps.length === 0) {
      return { courses: [], source: 'assembled', forSkills: [] };
    }

    const gaps = path.gaps.slice(0, MOST);
    const forSkills = gaps.map((gap) => gap.skill);
    const assembled = gaps.map((gap) => this.searchFor(gap, path.jobsConsidered));

    if (!this.client) {
      return { courses: assembled, source: 'assembled', forSkills };
    }

    const written = await this.write({
      gaps,
      jobsConsidered: path.jobsConsidered,
      targetRole: path.targetRole,
      has: user?.cvProfile?.skills ?? [],
      language: user?.locale === 'en' ? 'en' : 'bn',
    });

    return written
      ? { courses: written, source: 'written', forSkills }
      : { courses: assembled, source: 'assembled', forSkills };
  }

  // --- what somebody did about it ---

  async completions(userId: string) {
    const rows = await this.prisma.courseCompletion.findMany({
      where: { userId },
      orderBy: { declaredAt: 'desc' },
    });

    return {
      completions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        provider: row.provider,
        url: row.url,
        skill: row.skill,
        declaredAt: row.declaredAt.toISOString(),
        certificate: row.storageKey
          ? {
              name: row.originalName,
              mimeType: row.mimeType ?? 'application/octet-stream',
              sizeBytes: row.sizeBytes ?? 0,
            }
          : null,
      })),
    };
  }

  async declare(
    userId: string,
    dto: { title: string; provider: string; url?: string; skill: string },
  ) {
    const row = await this.prisma.courseCompletion.create({
      data: {
        userId,
        title: dto.title,
        provider: dto.provider,
        url: dto.url?.trim() ? dto.url.trim() : null,
        skill: dto.skill,
      },
      select: { id: true },
    });
    return { id: row.id };
  }

  // --- the model's version ---

  private async write(input: {
    gaps: SkillGap[];
    jobsConsidered: number;
    targetRole: string;
    has: string[];
    language: 'en' | 'bn';
  }): Promise<CourseSuggestion[] | null> {
    try {
      const response = await this.client!.messages.parse({
        model: this.model,
        max_tokens: 1500,
        output_config: { effort: 'low', format: zodOutputFormat(coursesSchema) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Suggest up to ${input.gaps.length} free courses, in ${
                input.language === 'bn' ? 'Bangla' : 'English'
              }.`,
              `They are working towards: ${input.targetRole}.`,
              `Measured against ${input.jobsConsidered} open postings in their field.`,
              '',
              '<already_on_their_cv>',
              input.has.join(', ') || '(nothing read from a CV yet)',
              '</already_on_their_cv>',
              '',
              '<missing_skills_with_demand>',
              JSON.stringify(
                input.gaps.map((gap) => ({
                  skill: gap.skill,
                  postingsAskingForIt: gap.postings,
                  outOf: input.jobsConsidered,
                  couldUnlock: gap.unlocks,
                })),
                null,
                1,
              ),
              '</missing_skills_with_demand>',
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const parsed = response.parsed_output?.courses ?? [];
      if (parsed.length === 0) return null;

      return parsed.slice(0, MOST).map((course) => ({
        title: course.title.trim(),
        provider: course.provider.trim(),
        skill: course.skill.trim(),
        why: course.why.trim(),
        minutes: course.minutes && course.minutes > 0 ? course.minutes : null,
        // Built here, never by the model: see rule 2.
        searchUrl: searchUrl(course.title, course.provider),
      }));
    } catch (err) {
      this.logger.error(
        `Course suggestions failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  /** A gap, turned into something to search for. */
  private searchFor(gap: SkillGap, jobsConsidered: number): CourseSuggestion {
    const title = `Free ${gap.skill} course for beginners`;
    return {
      title,
      provider: 'YouTube and Google',
      skill: gap.skill,
      why:
        jobsConsidered > 0
          ? `${gap.postings} of ${jobsConsidered} open jobs in your field ask for ${gap.skill}.`
          : `${gap.postings} open jobs ask for ${gap.skill}.`,
      minutes: null,
      searchUrl: searchUrl(title, ''),
    };
  }
}

/**
 * The link on every card.
 *
 * A search rather than a course page, deliberately. Free courses move, get
 * taken down and change price; a search for the same words finds whatever is
 * there today, and cannot rot the way a stored URL does.
 */
function searchUrl(title: string, provider: string): string {
  const query = [title, provider, 'free course'].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
