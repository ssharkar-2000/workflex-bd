import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root — see the note in cv-writer.service.ts.
import * as z from 'zod/v4';
import type { JobCategory, MockLevel } from '@prisma/client';
import {
  ApiErrorCode,
  type LearningTip,
  type MockProgress,
  type MockResult,
  type MockSubjects,
  type MockTest,
  type QuestionReview,
  type SkillScore,
  type StartMockTestDto,
  type SubmitMockTestDto,
} from '@workflex/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { SUBJECTS, SUBJECT_BY_KEY, type StoredQuestion } from './mock-bank';

/** Questions in a test, and the mark needed to pass. */
const ASKED = 10;
const PASS_MARK = 70;

/** Roughly a minute and a half a question, which is what practice needs. */
const SECONDS_PER_QUESTION = 90;

const questionSchema = z.object({
  prompt: z.string().describe('The question. One sentence.'),
  code: z
    .string()
    .describe('A short snippet if the question needs one, otherwise an empty string.'),
  options: z.array(z.string()).describe('Exactly four options.'),
  answer: z.number().describe('Index of the correct option, 0 to 3.'),
  skill: z.string().describe('Which of the listed skills it tests.'),
  why: z.string().describe('Why the right answer is right. One or two sentences.'),
});

const SYSTEM = `You write practice questions for people in Bangladesh
preparing for work. Multiple choice, four options, exactly one right.

What makes a question good here:

1. It tests something the job actually needs. Not trivia, not a definition
   somebody could look up in three seconds and never use again.
2. The three wrong options are wrong for a *reason* — each one is a mistake
   somebody really makes. Options that are obviously silly teach nothing and
   turn the test into a reading exercise.
3. The explanation says why the right answer is right, in plain words. This
   is the part that is worth the person's time; the score is not.
4. Nothing depends on knowing a foreign country's law, currency, or
   workplace customs. Somebody in Khulna should not lose a mark for not
   knowing how a American office does something.

Never write a question about somebody's age, sex, religion, home district or
family. Never write one whose correct answer is that the candidate should
work unpaid, hand over documents, or pay a fee.

Write in the language asked for. Keep any code snippet in English, as code
is written.`;

/**
 * The AI mock test.
 *
 * Questions are generated per attempt rather than drawn from a fixed paper,
 * which is the point of practice — a test you can memorise stops measuring
 * anything the second time you sit it. When the model is unavailable the
 * bank in mock-bank.ts supplies real, explained questions instead, so the
 * feature never degrades into an apology.
 *
 * Marking is arithmetic and happens here. The correct answers are stored on
 * the row and stripped from everything sent to the phone: an answer key on
 * the device is an answer key in the network tab, and a practice test that
 * can be trivially beaten is a waste of fifteen minutes.
 */
@Injectable()
export class MockTestsService {
  private readonly logger = new Logger(MockTestsService.name);
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
      this.logger.warn('Mock tests: question writing is off, the bank will be used');
    }
  }

  // --- choosing ---

  async subjects(userId: string): Promise<MockSubjects> {
    const [user, taken] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { cvProfile: { select: { categories: true } } },
      }),
      this.prisma.mockTest.count({ where: { userId, submittedAt: { not: null } } }),
    ]);

    const mine = new Set<JobCategory>(user?.cvProfile?.categories ?? []);

    return {
      taken,
      subjects: SUBJECTS.map((subject) => ({
        key: subject.key,
        title: subject.title,
        category: subject.category,
        group: subject.group,
        // One "test" per distinct set the generator can produce from the
        // skills listed. Honest arithmetic rather than a made-up number.
        tests: Math.max(2, Math.ceil(subject.bank.length / 4)),
        minMinutes: subject.minMinutes,
        maxMinutes: subject.maxMinutes,
        skills: subject.skills,
        recommended: mine.has(subject.category),
      })),
    };
  }

  // --- sitting one ---

  async start(userId: string, dto: StartMockTestDto): Promise<MockTest> {
    const subject = SUBJECT_BY_KEY.get(dto.subject);
    if (!subject) throw AppException.notFound('No such test');

    const level: MockLevel = dto.level ?? 'INTERMEDIATE';
    const language = await this.languageOf(userId);

    const written = await this.write(subject.title, subject.skills, level, language);
    const questions = written ?? pickFrom(subject.bank, ASKED);

    const row = await this.prisma.mockTest.create({
      data: {
        userId,
        category: subject.category,
        level,
        title: subject.title,
        questions: questions as never,
        total: questions.length,
        durationSeconds: questions.length * SECONDS_PER_QUESTION,
        source: written ? 'written' : 'assembled',
      },
    });

    return {
      id: row.id,
      title: row.title,
      category: row.category,
      level: row.level,
      durationSeconds: row.durationSeconds,
      startedAt: row.startedAt.toISOString(),
      source: written ? 'written' : 'assembled',
      // The answer key never leaves this server.
      questions: questions.map((q) => ({
        prompt: q.prompt,
        code: q.code,
        options: q.options,
        skill: q.skill,
      })),
    };
  }

  async submit(
    userId: string,
    testId: string,
    dto: SubmitMockTestDto,
  ): Promise<MockResult> {
    const row = await this.prisma.mockTest.findUnique({ where: { id: testId } });
    if (!row || row.userId !== userId) throw AppException.notFound('No such test');
    if (row.submittedAt) {
      throw new AppException(
        ApiErrorCode.ALREADY_PROCESSED,
        'That test has already been submitted',
        HttpStatus.CONFLICT,
      );
    }

    const questions = row.questions as unknown as StoredQuestion[];
    const answers = dto.answers.slice(0, questions.length);

    // --- marking ---
    const bySkill = new Map<string, { correct: number; asked: number }>();
    let score = 0;

    const review: QuestionReview[] = questions.map((q, i) => {
      const chosen = answers[i] ?? null;
      const right = chosen === q.answer;
      if (right) score += 1;

      const held = bySkill.get(q.skill) ?? { correct: 0, asked: 0 };
      held.asked += 1;
      if (right) held.correct += 1;
      bySkill.set(q.skill, held);

      return {
        prompt: q.prompt,
        skill: q.skill,
        options: q.options,
        correct: q.answer,
        chosen,
        why: q.why,
      };
    });

    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= PASS_MARK;

    const breakdown: SkillScore[] = [...bySkill.entries()]
      .map(([skill, counts]) => ({
        skill,
        correct: counts.correct,
        asked: counts.asked,
        pct: Math.round((counts.correct / counts.asked) * 100),
      }))
      .sort((a, b) => b.pct - a.pct);

    const submittedAt = new Date();
    const secondsTaken = Math.max(
      0,
      Math.round((submittedAt.getTime() - row.startedAt.getTime()) / 1000),
    );

    await this.prisma.mockTest.update({
      where: { id: row.id },
      data: {
        answers: answers as never,
        submittedAt,
        score,
        passed,
        breakdown: breakdown as never,
      },
    });

    const language = await this.languageOf(userId);
    const read = await this.read(row.title, pct, breakdown, language);

    return {
      id: row.id,
      title: row.title,
      score,
      total: questions.length,
      pct,
      passed,
      passMark: PASS_MARK,
      secondsTaken,
      breakdown,
      review,
      insight: read?.insight.trim() || assembleInsight(pct, breakdown, language),
      tips: read?.tips ?? assembleTips(breakdown, language),
      source: read ? 'written' : 'assembled',
    };
  }

  /** A finished test read back, for the result screen after a reload. */
  async result(userId: string, testId: string): Promise<MockResult> {
    const row = await this.prisma.mockTest.findUnique({ where: { id: testId } });
    if (!row || row.userId !== userId) throw AppException.notFound('No such test');
    if (!row.submittedAt || row.score === null) {
      throw new AppException(
        ApiErrorCode.VALIDATION_FAILED,
        'That test has not been finished',
        HttpStatus.BAD_REQUEST,
      );
    }

    const questions = row.questions as unknown as StoredQuestion[];
    const answers = (row.answers ?? []) as unknown as (number | null)[];
    const breakdown = (row.breakdown ?? []) as unknown as SkillScore[];
    const pct = Math.round((row.score / row.total) * 100);
    const language = await this.languageOf(userId);

    return {
      id: row.id,
      title: row.title,
      score: row.score,
      total: row.total,
      pct,
      passed: row.passed ?? false,
      passMark: PASS_MARK,
      secondsTaken: Math.round(
        (row.submittedAt.getTime() - row.startedAt.getTime()) / 1000,
      ),
      breakdown,
      review: questions.map((q, i) => ({
        prompt: q.prompt,
        skill: q.skill,
        options: q.options,
        correct: q.answer,
        chosen: answers[i] ?? null,
        why: q.why,
      })),
      insight: assembleInsight(pct, breakdown, language),
      tips: assembleTips(breakdown, language),
      source: 'assembled',
    };
  }

  // --- progress ---

  async progress(userId: string): Promise<MockProgress> {
    const rows = await this.prisma.mockTest.findMany({
      where: { userId, submittedAt: { not: null } },
      orderBy: { submittedAt: 'desc' },
      take: 50,
    });

    const language = await this.languageOf(userId);
    const done = rows.filter((row) => row.score !== null);

    const averagePct =
      done.length === 0
        ? 0
        : Math.round(
            done.reduce((sum, row) => sum + (row.score! / row.total) * 100, 0) / done.length,
          );

    // Per-skill, oldest score against newest. Oldest last in this list, so
    // the arrays are walked from the end.
    const firstSeen = new Map<string, number>();
    const lastSeen = new Map<string, number>();
    const counts = new Map<string, number>();

    for (const row of [...done].reverse()) {
      for (const entry of (row.breakdown ?? []) as unknown as SkillScore[]) {
        if (!firstSeen.has(entry.skill)) firstSeen.set(entry.skill, entry.pct);
        lastSeen.set(entry.skill, entry.pct);
        counts.set(entry.skill, (counts.get(entry.skill) ?? 0) + 1);
      }
    }

    const growth = [...firstSeen.entries()].map(([skill, first]) => ({
      skill,
      first,
      latest: lastSeen.get(skill) ?? first,
      tests: counts.get(skill) ?? 1,
    }));

    return {
      taken: done.length,
      averagePct,
      improved: growth.filter((g) => g.latest > g.first).length,
      growth: growth.sort((a, b) => b.latest - b.first - (a.latest - a.first)),
      recent: done.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.title,
        takenAt: row.submittedAt!.toISOString(),
        minutes: Math.max(
          1,
          Math.round((row.submittedAt!.getTime() - row.startedAt.getTime()) / 60_000),
        ),
        pct: Math.round((row.score! / row.total) * 100),
        passed: row.passed ?? false,
      })),
      goal: nextGoal(averagePct, done.length, language),
    };
  }

  // --- the model ---

  private async write(
    title: string,
    skills: string[],
    level: MockLevel,
    language: 'en' | 'bn',
  ): Promise<StoredQuestion[] | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4000,
        output_config: {
          effort: 'low',
          format: zodOutputFormat(z.object({ questions: z.array(questionSchema) })),
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: [
              `Write ${ASKED} questions in ${language === 'bn' ? 'Bangla' : 'English'}.`,
              `Subject: ${title}`,
              `Level: ${level.toLowerCase()}`,
              `Cover these skills, roughly evenly: ${skills.join(', ')}`,
              `Use the skill names exactly as written above in the "skill" field.`,
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const raw = response.parsed_output?.questions ?? [];

      // A question with the wrong number of options, or an answer index that
      // points at nothing, is unmarkable — drop it rather than ship a
      // question nobody can get right.
      const usable = raw
        .filter((q) => q.options.length === 4 && q.answer >= 0 && q.answer <= 3)
        .slice(0, ASKED)
        .map(
          (q): StoredQuestion => ({
            prompt: q.prompt.trim(),
            code: q.code.trim() ? q.code : null,
            options: [q.options[0]!, q.options[1]!, q.options[2]!, q.options[3]!],
            answer: q.answer as 0 | 1 | 2 | 3,
            skill: skills.includes(q.skill) ? q.skill : (skills[0] ?? 'General'),
            why: q.why.trim(),
          }),
        );

      // Half a test is worse than the bank's whole one.
      return usable.length >= ASKED - 2 ? usable : null;
    } catch (err) {
      this.logger.error(
        `Question writing failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async read(
    title: string,
    pct: number,
    breakdown: SkillScore[],
    language: 'en' | 'bn',
  ): Promise<{ insight: string; tips: LearningTip[] } | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 1200,
        output_config: {
          effort: 'low',
          format: zodOutputFormat(
            z.object({
              insight: z.string(),
              tips: z.array(
                z.object({
                  skill: z.string(),
                  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
                  target: z.number(),
                  effort: z.string(),
                  detail: z.string(),
                }),
              ),
            }),
          ),
        },
        system: `You read somebody's practice test result and tell them what to
work on. Two or three sentences on what the answers showed, then up to four
skills to practise, weakest first.

Say what to practise, not how clever they are. Never flatter a low score and
never call a high one a talent — both stop somebody doing the next hour of
work. The effort estimate is a guess and should be written as a range.

Write in the language asked for.`,
        messages: [
          {
            role: 'user',
            content: [
              `Write in ${language === 'bn' ? 'Bangla' : 'English'}.`,
              `Test: ${title}. Score: ${pct}%.`,
              'Per skill:',
              ...breakdown.map((b) => `- ${b.skill}: ${b.correct}/${b.asked} (${b.pct}%)`),
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') return null;
      const parsed = response.parsed_output;
      if (!parsed) return null;

      const current = new Map(breakdown.map((b) => [b.skill, b.pct]));
      return {
        insight: parsed.insight,
        tips: parsed.tips.slice(0, 4).map((tip) => ({
          skill: tip.skill,
          priority: tip.priority,
          current: current.get(tip.skill) ?? 0,
          target: Math.min(100, Math.max(0, Math.round(tip.target))),
          effort: tip.effort,
          detail: tip.detail,
        })),
      };
    } catch (err) {
      this.logger.error(
        `Result reading failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async languageOf(userId: string): Promise<'en' | 'bn'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { locale: true },
    });
    return user?.locale === 'en' ? 'en' : 'bn';
  }
}

// --- without a model ---

/**
 * Pick n questions, shuffled.
 *
 * Shuffled per attempt so a second sitting is not the same paper in the same
 * order — the bank is small, and order alone is most of what somebody
 * memorises.
 */
function pickFrom(bank: StoredQuestion[], n: number): StoredQuestion[] {
  const pool = [...bank];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, Math.min(n, pool.length));
}

function assembleInsight(
  pct: number,
  breakdown: SkillScore[],
  language: 'en' | 'bn',
): string {
  const bn_ = language === 'bn';
  const strong = breakdown.filter((b) => b.pct >= 80).map((b) => b.skill);
  const weak = breakdown.filter((b) => b.pct < 60).map((b) => b.skill);

  const parts: string[] = [];
  if (strong.length > 0) {
    parts.push(
      bn_
        ? `ভালো করেছেন: ${strong.slice(0, 2).join(', ')}।`
        : `You did well on ${strong.slice(0, 2).join(' and ')}.`,
    );
  }
  if (weak.length > 0) {
    parts.push(
      bn_
        ? `যেখানে কাজ বাকি: ${weak.slice(0, 2).join(', ')}।`
        : `The gaps are in ${weak.slice(0, 2).join(' and ')}.`,
    );
  } else if (pct >= 80) {
    parts.push(
      bn_
        ? 'কোনো একটি বিষয়ে আলাদা করে দুর্বলতা দেখা যায়নি — পরেরবার কঠিন স্তরে চেষ্টা করুন।'
        : 'No single weak area showed up. Try the harder level next.',
    );
  }
  parts.push(
    bn_
      ? 'নিচের প্রশ্ন পর্যালোচনায় প্রতিটি সঠিক উত্তরের কারণ দেওয়া আছে — স্কোরের চেয়ে সেটিই বেশি কাজের।'
      : 'The question review below explains every answer, which is worth more than the score.',
  );
  return parts.join(' ');
}

function assembleTips(breakdown: SkillScore[], language: 'en' | 'bn'): LearningTip[] {
  const bn_ = language === 'bn';
  return breakdown
    .filter((b) => b.pct < 90)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 4)
    .map((b) => {
      const priority = b.pct < 50 ? 'HIGH' : b.pct < 75 ? 'MEDIUM' : 'LOW';
      const target = Math.min(100, Math.max(b.pct + 20, 80));
      return {
        skill: b.skill,
        priority: priority as LearningTip['priority'],
        current: b.pct,
        target,
        effort: b.pct < 50 ? '2-3 hours' : '1-2 hours',
        detail: bn_
          ? `${b.asked}টির মধ্যে ${b.correct}টি সঠিক। লক্ষ্য ${target}% — লার্নিং ল্যাবে এই বিষয়ে বিনামূল্যের কোর্স আছে।`
          : `${b.correct} of ${b.asked} right. Aim for ${target}% — the Learning Lab has free courses on this.`,
      };
    });
}

function nextGoal(
  averagePct: number,
  taken: number,
  language: 'en' | 'bn',
): MockProgress['goal'] {
  const bn_ = language === 'bn';
  if (taken === 0) {
    return {
      label: bn_ ? 'প্রথম পরীক্ষাটি দিন' : 'Take your first test',
      current: 0,
      target: 100,
    };
  }
  // The next round number above where they are, so the goal is always a
  // short step rather than a distant one.
  const target = Math.min(100, Math.ceil((averagePct + 1) / 10) * 10);
  return {
    label: bn_
      ? `গড় ${target}% ছুঁয়ে ফেলুন`
      : `Reach a ${target}% average score`,
    current: averagePct,
    target,
  };
}
