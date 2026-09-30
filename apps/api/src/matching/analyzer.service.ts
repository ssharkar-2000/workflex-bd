import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root — see the note in cv-writer.service.ts.
import * as z from 'zod/v4';
import type { CvProfile, JobCategory } from '@prisma/client';
import type {
  AnalysisAxis,
  CvAnalysis,
  Insight,
  SkillMatch,
  Suggestion,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { SIGNALS } from './cv-keywords';

/** How the hundred points divide. */
const WEIGHTS = { skills: 40, experience: 25, ats: 20, completeness: 15 } as const;

/** Skills shown on the bar chart. */
const TOP_SKILLS = 8;

/** Below this many relevant postings, the comparison is not worth making. */
const MIN_POSTINGS = 10;

const writtenSchema = z.object({
  verdict: z.string().describe('One sentence on the score. Plain, not encouraging.'),
  suggestions: z.array(
    z.object({
      title: z.string().describe('What to change. Six words or so.'),
      detail: z.string().describe('Why, in one line, using the numbers given.'),
      priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      section: z.enum(['summary', 'experience', 'skills', 'education', 'contact']),
    }),
  ),
});

const SYSTEM = `You read a report on somebody's CV and tell them what to change.

The report is already computed: a score, the axes it came from, which skills
the open postings in their line of work ask for, and which of those their CV
has. You do not recompute any of it and you never invent a number.

Write a one-sentence verdict, then up to five changes, most useful first.

Rules:

1. Every suggestion names something specific to do — "add the two years at
   the garment factory, with what you actually did" — not "strengthen your
   experience section".
2. Use the demand figures you are given. "Excel appears in 7 of 10 office
   postings here and is not on your CV" is worth acting on; "Excel is a
   valuable skill" is not.
3. Never tell somebody to claim a skill they have not said they have. The
   suggestion for a missing skill is to learn it or to add it *if they have
   it*, never to put it on the CV regardless.
4. Say nothing about age, sex, religion, home district, marital status or a
   photograph. None of it belongs on a CV in this market and advising on it
   does harm.
5. If the report says the comparison was thin, say so in the verdict rather
   than presenting a shaky number as a finding.

Write in the language asked for.`;

/**
 * The AI Resume Analyzer.
 *
 * Scores a CV against the work it is actually for. The comparison set is the
 * open postings in the categories this person's own CV points at — so an
 * electrician is measured against electrician postings, and the "missing
 * skills" are the ones employers near them are really asking for rather than
 * whatever a generic CV checker thinks a CV should contain.
 *
 * The arithmetic is all here. A model is asked only to turn the figures into
 * sentences somebody can act on, because a score a person cannot take apart
 * is a score they cannot argue with, and one they cannot argue with is one
 * they will either over-trust or ignore.
 */
@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);
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
      this.logger.warn('Resume analyzer: writing is off, suggestions will be assembled');
    }
  }

  async analyze(userId: string): Promise<CvAnalysis> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        locale: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        cvProfile: true,
      },
    });

    const language = user?.locale === 'en' ? 'en' : 'bn';
    const profile = user?.cvProfile ?? null;

    const hasCvDoc = await this.prisma.document.findFirst({
      where: { userId, kind: 'CV' },
      select: { id: true, mimeType: true },
    });

    // --- what this person's market asks for ---
    const categories = (profile?.categories ?? []) as JobCategory[];
    const postings = await this.prisma.job.findMany({
      where: {
        isOpen: true,
        ...(categories.length > 0 ? { category: { in: categories } } : {}),
      },
      select: { title: true, description: true, requirements: true },
      take: 400,
    });

    const thin = postings.length < MIN_POSTINGS;
    const mine = new Set((profile?.skills ?? []).map((s) => s.toLowerCase()));

    // How many postings name each term in the vocabulary.
    const demand = new Map<string, number>();
    for (const job of postings) {
      const text = `${job.title} ${job.description} ${job.requirements ?? ''}`.toLowerCase();
      for (const group of SIGNALS) {
        for (const term of group.terms) {
          if (mentions(text, term)) demand.set(term, (demand.get(term) ?? 0) + 1);
        }
      }
    }

    const skills: SkillMatch[] = [...demand.entries()]
      .map(([skill, count]) => ({
        skill,
        demand: Math.round((count / Math.max(postings.length, 1)) * 100),
        onCv: mine.has(skill),
      }))
      .filter((row) => row.demand >= 5)
      .sort((a, b) => b.demand - a.demand)
      .slice(0, TOP_SKILLS);

    // Skills already on the CV that nothing in the comparison set asks for
    // still belong on the chart — they are the person's own, and leaving
    // them out would read as though they did not count.
    for (const skill of mine) {
      if (skills.length >= TOP_SKILLS) break;
      if (!skills.some((row) => row.skill === skill)) {
        skills.push({ skill, demand: demand.get(skill) ?? 0, onCv: true });
      }
    }

    const wanted = skills.filter((row) => row.demand > 0);
    const covered = wanted.filter((row) => row.onCv);
    const missing = wanted.filter((row) => !row.onCv).slice(0, 4);

    // --- the axes ---
    const skillScore =
      wanted.length === 0 ? 50 : Math.round((covered.length / wanted.length) * 100);

    const years = profile?.yearsExperience ?? null;
    const experienceScore =
      years === null ? 40 : years >= 5 ? 100 : Math.round(40 + (years / 5) * 60);

    // ATS: whether a machine could read it at all, which is what the phrase
    // actually means. A scanned photograph of a CV parses to nothing.
    const parsed = Boolean(profile);
    const atsScore =
      (hasCvDoc ? 30 : 0) +
      (parsed ? 40 : 0) +
      (hasCvDoc?.mimeType?.includes('pdf') || hasCvDoc?.mimeType?.includes('word') ? 30 : 0);

    const filled = [
      Boolean(user?.firstName),
      Boolean(user?.phone),
      Boolean(user?.email),
      Boolean(user?.address),
      (profile?.titles.length ?? 0) > 0,
      Boolean(profile?.summary),
    ].filter(Boolean).length;
    const completenessScore = Math.round((filled / 6) * 100);

    const axes: AnalysisAxis[] = [
      {
        key: 'skills',
        score: skillScore,
        weight: WEIGHTS.skills,
        detail: thin
          ? detailThin(language)
          : wanted.length === 0
            ? detailNoDemand(language)
            : detailSkills(covered.length, wanted.length, language),
      },
      {
        key: 'experience',
        score: experienceScore,
        weight: WEIGHTS.experience,
        detail: detailExperience(years, language),
      },
      {
        key: 'ats',
        score: atsScore,
        weight: WEIGHTS.ats,
        detail: detailAts(Boolean(hasCvDoc), parsed, language),
      },
      {
        key: 'completeness',
        score: completenessScore,
        weight: WEIGHTS.completeness,
        detail: detailCompleteness(filled, language),
      },
    ];

    const score = Math.round(
      axes.reduce((total, axis) => total + (axis.score * axis.weight) / 100, 0),
    );

    const insights = buildInsights({ atsScore, covered: covered.length, wanted: wanted.length, years, missing, language });
    const assembled = buildSuggestions({ axes, missing, years, user, profile, language });

    const written = await this.write({ score, axes, skills, missing, thin, language });

    return {
      score,
      verdict: written?.verdict.trim() || verdictFor(score, thin, language),
      axes,
      insights,
      skills,
      suggestions:
        written?.suggestions.map((one, i) => ({
          id: `w${i}`,
          priority: one.priority,
          title: one.title.trim(),
          detail: one.detail.trim(),
          section: one.section,
        })) ?? assembled,
      postingsCompared: postings.length,
      thin,
      source: written ? 'written' : 'assembled',
    };
  }

  private async write(input: {
    score: number;
    axes: AnalysisAxis[];
    skills: SkillMatch[];
    missing: SkillMatch[];
    thin: boolean;
    language: 'en' | 'bn';
  }): Promise<z.infer<typeof writtenSchema> | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1500,
        output_config: { effort: 'low', format: zodOutputFormat(writtenSchema) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write in ${input.language === 'bn' ? 'Bangla' : 'English'}.`,
              input.thin ? 'NOTE: the comparison set was too small to be reliable.' : '',
              `Overall score: ${input.score}`,
              '',
              'Axes:',
              ...input.axes.map((a) => `- ${a.key}: ${a.score}/100 (weight ${a.weight}) — ${a.detail}`),
              '',
              'What the open postings in their field ask for:',
              ...input.skills.map(
                (s) => `- ${s.skill}: named in ${s.demand}% of postings; on their CV: ${s.onCv ? 'yes' : 'no'}`,
              ),
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      return response.parsed_output ?? null;
    } catch (err) {
      this.logger.error(
        `Analyzer writing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

// --- words, when there is no model ---

function verdictFor(score: number, thin: boolean, language: 'en' | 'bn'): string {
  const bn_ = language === 'bn';
  if (thin) {
    return bn_
      ? 'আপনার ক্ষেত্রে এখনো যথেষ্ট বিজ্ঞপ্তি নেই, তাই এই স্কোরটি ইঙ্গিত মাত্র — সিদ্ধান্ত নয়।'
      : 'There are too few postings in your field yet, so treat this score as a hint rather than a finding.';
  }
  if (score >= 80) {
    return bn_
      ? 'আপনার সিভি ভালো অবস্থায় আছে। কয়েকটি ছোট পরিবর্তনে আরও ভালো হতে পারে।'
      : 'Your CV is in good shape. A few small changes would make it better still.';
  }
  if (score >= 55) {
    return bn_
      ? 'কাজ চলার মতো সিভি। নিচের পরিবর্তনগুলো করলে স্পষ্ট পার্থক্য হবে।'
      : 'A workable CV. The changes below would make a visible difference.';
  }
  return bn_
    ? 'এখনো অনেকটা বাকি — নিচের প্রথম দুটি পরিবর্তনই সবচেয়ে বেশি কাজে দেবে।'
    : 'There is a fair way to go. The first two changes below are worth the most.';
}

function buildInsights(input: {
  atsScore: number;
  covered: number;
  wanted: number;
  years: number | null;
  missing: SkillMatch[];
  language: 'en' | 'bn';
}): Insight[] {
  const bn_ = input.language === 'bn';
  const out: Insight[] = [];

  out.push({
    key: 'ats',
    good: input.atsScore >= 70,
    title: bn_ ? 'মেশিনে পড়া যায়' : 'ATS friendly',
    detail:
      input.atsScore >= 70
        ? bn_
          ? 'আপনার সিভি স্বয়ংক্রিয় ব্যবস্থায় পড়া যাচ্ছে।'
          : 'Your CV can be read by automatic systems.'
        : bn_
          ? 'সিভিটি ঠিকমতো পড়া যাচ্ছে না — ছবি নয়, PDF বা Word ফাইল দিন।'
          : 'It cannot be read properly. Upload a PDF or Word file rather than a photograph.',
  });

  out.push({
    key: 'skills',
    good: input.wanted > 0 && input.covered / input.wanted >= 0.6,
    title: bn_ ? 'মিল থাকা দক্ষতা' : 'Relevant skills',
    detail: bn_
      ? `${bn(input.wanted)}টির মধ্যে ${bn(input.covered)}টি দক্ষতা চাহিদার সঙ্গে মেলে।`
      : `${input.covered} of ${input.wanted} sought-after skills match.`,
  });

  out.push({
    key: 'experience',
    good: (input.years ?? 0) >= 1,
    title: bn_ ? 'অভিজ্ঞতা' : 'Experience',
    detail:
      input.years === null
        ? bn_
          ? 'সিভিতে বছরের হিসাব পাওয়া যায়নি।'
          : 'No countable years found on the CV.'
        : bn_
          ? `${bn(input.years)} বছরের প্রাসঙ্গিক অভিজ্ঞতা পাওয়া গেছে।`
          : `${input.years} ${input.years === 1 ? 'year' : 'years'} of relevant experience found.`,
  });

  out.push({
    key: 'missing',
    good: input.missing.length === 0,
    title: bn_ ? 'যে দক্ষতাগুলো নেই' : 'Missing skills',
    detail:
      input.missing.length === 0
        ? bn_
          ? 'চাহিদার বড় কোনো দক্ষতা বাদ পড়েনি।'
          : 'Nothing in high demand is missing.'
        : bn_
          ? `যোগ করার কথা ভাবুন: ${input.missing.map((m) => m.skill).join(', ')}`
          : `Consider adding ${input.missing.map((m) => m.skill).join(', ')}`,
  });

  return out;
}

function buildSuggestions(input: {
  axes: AnalysisAxis[];
  missing: SkillMatch[];
  years: number | null;
  user: { firstName: string | null; email: string | null; address: string | null } | null;
  profile: CvProfile | null;
  language: 'en' | 'bn';
}): Suggestion[] {
  const bn_ = input.language === 'bn';
  const out: Suggestion[] = [];
  const axis = (key: string) => input.axes.find((a) => a.key === key)?.score ?? 0;

  for (const skill of input.missing.slice(0, 2)) {
    out.push({
      id: `skill-${skill.skill}`,
      priority: skill.demand >= 50 ? 'HIGH' : 'MEDIUM',
      section: 'skills',
      title: bn_ ? `${skill.skill} যোগ করুন` : `Add ${skill.skill} to your skills`,
      detail: bn_
        ? `এই প্ল্যাটফর্মে আপনার ধরনের ${bn(skill.demand)}% বিজ্ঞপ্তিতে এটি চাওয়া হয়। জানা থাকলে যোগ করুন, না জানলে শিখে নিন।`
        : `Asked for in ${skill.demand}% of similar postings here. Add it if you have it; learn it if you do not.`,
    });
  }

  if (axis('ats') < 70) {
    out.push({
      id: 'ats',
      priority: 'HIGH',
      section: 'contact',
      title: bn_ ? 'পড়ার যোগ্য ফাইল দিন' : 'Upload a readable file',
      detail: bn_
        ? 'ছবি তোলা সিভি কোনো ব্যবস্থাই পড়তে পারে না। PDF বা Word ফাইল দিন।'
        : 'A photographed CV cannot be read by any system. Upload a PDF or Word file.',
    });
  }

  if (!input.profile?.summary) {
    out.push({
      id: 'summary',
      priority: 'MEDIUM',
      section: 'summary',
      title: bn_ ? 'একটি সারসংক্ষেপ লিখুন' : 'Add a professional summary',
      detail: bn_
        ? 'দুই-তিন লাইনে আপনি কী কাজ করেন তা বললে নিয়োগদাতা দ্রুত বুঝতে পারেন।'
        : 'Two or three lines on what you do helps a recruiter place you quickly.',
    });
  }

  if (input.years === null) {
    out.push({
      id: 'years',
      priority: 'MEDIUM',
      section: 'experience',
      title: bn_ ? 'কাজের সময়কাল লিখুন' : 'Put dates on your work history',
      detail: bn_
        ? 'কোন কাজ কবে থেকে কবে — এটি না থাকলে আপনার অভিজ্ঞতা গোনা যায় না।'
        : 'Without start and end dates your experience cannot be counted at all.',
    });
  }

  if (!input.user?.address) {
    out.push({
      id: 'area',
      priority: 'LOW',
      section: 'contact',
      title: bn_ ? 'আপনার এলাকা যোগ করুন' : 'Add your area',
      detail: bn_
        ? 'কাছের কাজ দেখাতে এবং নিয়োগদাতার যাতায়াতের হিসাব করতে এটি লাগে।'
        : 'It decides which nearby work you are shown and what a recruiter assumes about travel.',
    });
  }

  out.push({
    id: 'numbers',
    priority: 'LOW',
    section: 'experience',
    title: bn_ ? 'সংখ্যা দিয়ে লিখুন' : 'Include measurable results',
    detail: bn_
      ? 'কতজনের রান্না, কয়টি ঘর পরিষ্কার, কত টাকার বিক্রি — সংখ্যা সবচেয়ে বেশি বলে।'
      : 'How many people, how many rooms, how much in sales. Numbers say the most.',
  });

  return out.slice(0, 5);
}

// --- axis wording ---

const bn = (v: number) => String(v).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)] ?? d);

const detailThin = (l: 'en' | 'bn') =>
  l === 'bn'
    ? 'তুলনা করার মতো যথেষ্ট বিজ্ঞপ্তি নেই।'
    : 'Not enough postings to compare against.';

const detailNoDemand = (l: 'en' | 'bn') =>
  l === 'bn'
    ? 'আপনার ক্ষেত্রের বিজ্ঞপ্তিতে নির্দিষ্ট কোনো দক্ষতার নাম পাওয়া যায়নি।'
    : 'Postings in your field name no specific skills to match against.';

const detailSkills = (covered: number, wanted: number, l: 'en' | 'bn') =>
  l === 'bn'
    ? `চাওয়া ${bn(wanted)}টি দক্ষতার মধ্যে ${bn(covered)}টি আপনার সিভিতে আছে।`
    : `${covered} of the ${wanted} skills these postings ask for are on your CV.`;

const detailExperience = (years: number | null, l: 'en' | 'bn') =>
  years === null
    ? l === 'bn'
      ? 'সিভি থেকে বছরের হিসাব বের করা যায়নি।'
      : 'No countable years of experience on the CV.'
    : l === 'bn'
      ? `${bn(years)} বছরের অভিজ্ঞতা পাওয়া গেছে।`
      : `${years} ${years === 1 ? 'year' : 'years'} of experience found.`;

const detailAts = (hasFile: boolean, parsed: boolean, l: 'en' | 'bn') =>
  !hasFile
    ? l === 'bn'
      ? 'কোনো সিভি ফাইল দেওয়া হয়নি।'
      : 'No CV file has been uploaded.'
    : parsed
      ? l === 'bn'
        ? 'ফাইলটি পড়া গেছে এবং বোঝা গেছে।'
        : 'The file was read and understood.'
      : l === 'bn'
        ? 'ফাইলটি আছে, কিন্তু তার লেখা পড়া যায়নি।'
        : 'The file is there but its text could not be read.';

const detailCompleteness = (filled: number, l: 'en' | 'bn') =>
  l === 'bn'
    ? `৬টি মূল অংশের মধ্যে ${bn(filled)}টি পূরণ করা আছে।`
    : `${filled} of the 6 basic sections are filled in.`;

/** Word-boundary match, so "java" does not match inside "javascript". */
function mentions(text: string, term: string): boolean {
  let from = 0;
  for (;;) {
    const at = text.indexOf(term, from);
    if (at === -1) return false;
    const before = at === 0 ? ' ' : text[at - 1]!;
    const after = text[at + term.length] ?? ' ';
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true;
    from = at + 1;
  }
}
