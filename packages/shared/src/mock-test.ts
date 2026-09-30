import { z } from 'zod';
import { jobCategorySchema } from './job-categories';

/**
 * The AI mock test: practice questions, a score, and what to do about it.
 *
 * Questions are generated for the person taking them rather than drawn from
 * a fixed paper, which is the whole point of practice — a test you can
 * memorise stops measuring anything on the second attempt.
 *
 * Two things this deliberately is not. It is not an exam: nothing here goes
 * to an employer, appears on a profile, or gates access to work, and the app
 * says so. And it is not a judgement of a person: a low score on a generated
 * multiple-choice test means the questions found gaps, which is what it was
 * asked to do.
 */

export const mockLevelSchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);
export type MockLevel = z.infer<typeof mockLevelSchema>;

/** The three groups the filter row offers. */
export const mockGroupSchema = z.enum(['TECHNICAL', 'NON_TECHNICAL', 'LANGUAGE']);
export type MockGroup = z.infer<typeof mockGroupSchema>;

/** A kind of test somebody can start. */
export const mockSubjectSchema = z.object({
  /** Stable key, e.g. "frontend". */
  key: z.string(),
  title: z.string(),
  category: jobCategorySchema,
  group: mockGroupSchema,
  /** How many different tests exist for it. */
  tests: z.number().int().positive(),
  minMinutes: z.number().int().positive(),
  maxMinutes: z.number().int().positive(),
  /** The skills its questions cover, shown under the title. */
  skills: z.array(z.string()),
  /**
   * True when this person's CV points at this kind of work.
   *
   * Drives the "Recommended for you" list. A mock test somebody cannot use
   * is worse than no suggestion: it costs fifteen minutes to find out.
   */
  recommended: z.boolean(),
});
export type MockSubject = z.infer<typeof mockSubjectSchema>;

export const mockSubjectsSchema = z.object({
  subjects: z.array(mockSubjectSchema),
  /** Tests this account has finished, for the home screen's line. */
  taken: z.number().int().nonnegative(),
});
export type MockSubjects = z.infer<typeof mockSubjectsSchema>;

/**
 * One question, as the phone receives it.
 *
 * No `answer` field, and that is not an oversight. A correct answer sent to
 * the device is a correct answer anyone can read out of the network tab, and
 * a practice test that can be trivially beaten teaches nothing. Marking
 * happens on the server against the stored copy.
 */
export const mockQuestionSchema = z.object({
  prompt: z.string(),
  /** A snippet shown in a monospaced block. Null for most questions. */
  code: z.string().nullable(),
  options: z.array(z.string()).length(4),
  /** Which skill it tests, for the breakdown afterwards. */
  skill: z.string(),
});
export type MockQuestion = z.infer<typeof mockQuestionSchema>;

export const mockTestSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: jobCategorySchema,
  level: mockLevelSchema,
  durationSeconds: z.number().int().positive(),
  questions: z.array(mockQuestionSchema),
  startedAt: z.string(),
  source: z.enum(['written', 'assembled']),
});
export type MockTest = z.infer<typeof mockTestSchema>;

export const startMockTestSchema = z.object({
  subject: z.string().trim().min(1).max(60),
  level: mockLevelSchema.optional(),
});
export type StartMockTestDto = z.infer<typeof startMockTestSchema>;

export const submitMockTestSchema = z.object({
  /** One entry per question, in order. Null where nothing was chosen. */
  answers: z.array(z.number().int().min(0).max(3).nullable()).min(1).max(30),
});
export type SubmitMockTestDto = z.infer<typeof submitMockTestSchema>;

/** How one question was marked, for the review tab. */
export const questionReviewSchema = z.object({
  prompt: z.string(),
  skill: z.string(),
  options: z.array(z.string()),
  correct: z.number().int(),
  chosen: z.number().int().nullable(),
  /** Why the right answer is right. The part that teaches anything. */
  why: z.string(),
});
export type QuestionReview = z.infer<typeof questionReviewSchema>;

export const skillScoreSchema = z.object({
  skill: z.string(),
  correct: z.number().int().nonnegative(),
  asked: z.number().int().positive(),
  /** 0–100. */
  pct: z.number().int().min(0).max(100),
});
export type SkillScore = z.infer<typeof skillScoreSchema>;

/** One thing worth practising, with where they are and where to get to. */
export const learningTipSchema = z.object({
  skill: z.string(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  current: z.number().int().min(0).max(100),
  target: z.number().int().min(0).max(100),
  /** "2-3 hours" — honest about being an estimate. */
  effort: z.string(),
  detail: z.string(),
});
export type LearningTip = z.infer<typeof learningTipSchema>;

export const mockResultSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  score: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  /** 0–100. */
  pct: z.number().int().min(0).max(100),
  passed: z.boolean(),
  /** The mark needed to pass, shown so the verdict can be checked. */
  passMark: z.number().int(),
  secondsTaken: z.number().int().nonnegative(),
  breakdown: z.array(skillScoreSchema),
  review: z.array(questionReviewSchema),
  /** Two or three sentences on what the answers showed. */
  insight: z.string(),
  tips: z.array(learningTipSchema),
  source: z.enum(['written', 'assembled']),
});
export type MockResult = z.infer<typeof mockResultSchema>;

/** One finished test, for the history list. */
export const mockHistoryRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  takenAt: z.string(),
  minutes: z.number().int().nonnegative(),
  pct: z.number().int().min(0).max(100),
  passed: z.boolean(),
});
export type MockHistoryRow = z.infer<typeof mockHistoryRowSchema>;

export const mockProgressSchema = z.object({
  taken: z.number().int().nonnegative(),
  /** Mean percentage across finished tests. Zero when none. */
  averagePct: z.number().int().min(0).max(100),
  /**
   * Skills whose most recent score beats the first one recorded.
   *
   * Counted from the person's own history rather than from a claim: this is
   * the one number on the screen that says something got better.
   */
  improved: z.number().int().nonnegative(),
  recent: z.array(mockHistoryRowSchema),
  /** Per-skill, first score against latest. */
  growth: z.array(
    z.object({
      skill: z.string(),
      first: z.number().int().min(0).max(100),
      latest: z.number().int().min(0).max(100),
      tests: z.number().int().positive(),
    }),
  ),
  /** What to aim at next, and how far along they are. */
  goal: z.object({
    label: z.string(),
    current: z.number().int().min(0).max(100),
    target: z.number().int().min(0).max(100),
  }),
});
export type MockProgress = z.infer<typeof mockProgressSchema>;
