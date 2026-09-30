import { z } from 'zod';

/**
 * The CV analyser: a score, what it is made of, and what to do about it.
 *
 * Every number comes from two things the platform actually holds — what was
 * parsed out of this person's CV, and what the open postings in their line of
 * work ask for. Nothing is compared against an imaginary ideal CV, because
 * there isn't one: a good CV for a Dhaka electrician and a good CV for a
 * Chattogram merchandiser share almost no words.
 *
 * The score exists to be taken apart. A bare "82%" tells somebody nothing
 * they can act on, so every axis, every matched skill and every missing one
 * is returned alongside it, and the suggestions say what to change.
 */

export const analysisAxisSchema = z.object({
  key: z.enum(['ats', 'skills', 'experience', 'completeness']),
  /** 0–100 within this axis. */
  score: z.number().int().min(0).max(100),
  /** What it weighs towards the total. */
  weight: z.number().int().positive(),
  /** One line the reader can act on or argue with. */
  detail: z.string(),
});
export type AnalysisAxis = z.infer<typeof analysisAxisSchema>;

/** One skill, and how much of the person's market asks for it. */
export const skillMatchSchema = z.object({
  skill: z.string(),
  /** Percentage of relevant open postings naming it. */
  demand: z.number().int().min(0).max(100),
  /** Whether this person's CV has it. */
  onCv: z.boolean(),
});
export type SkillMatch = z.infer<typeof skillMatchSchema>;

export const insightSchema = z.object({
  key: z.enum(['ats', 'skills', 'experience', 'missing']),
  /** Good news or bad. Drives the colour and the icon. */
  good: z.boolean(),
  title: z.string(),
  detail: z.string(),
});
export type Insight = z.infer<typeof insightSchema>;

export const suggestionPrioritySchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type SuggestionPriority = z.infer<typeof suggestionPrioritySchema>;

export const suggestionSchema = z.object({
  id: z.string(),
  priority: suggestionPrioritySchema,
  title: z.string(),
  detail: z.string(),
  /**
   * Which part of the CV it changes, so the builder can be opened at the
   * right step rather than at the top.
   */
  section: z.enum(['summary', 'experience', 'skills', 'education', 'contact']),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

export const cvAnalysisSchema = z.object({
  /** 0–100, the weighted axes below. */
  score: z.number().int().min(0).max(100),
  /** A sentence on the score, in the reader's language. */
  verdict: z.string(),
  axes: z.array(analysisAxisSchema),
  insights: z.array(insightSchema),
  /** Strongest demand first. Both the skills they have and the ones they lack. */
  skills: z.array(skillMatchSchema),
  suggestions: z.array(suggestionSchema),

  /**
   * How many postings the comparison was drawn from.
   *
   * Shown rather than hidden: a skills match computed against four postings
   * is a number, not a verdict, and somebody about to rewrite their CV on
   * the strength of it deserves to know which they are looking at.
   */
  postingsCompared: z.number().int().nonnegative(),
  /** True when there were too few postings to compare against honestly. */
  thin: z.boolean(),
  source: z.enum(['written', 'assembled']),
});
export type CvAnalysis = z.infer<typeof cvAnalysisSchema>;

/** The four templates the builder offers. */
export const cvTemplateSchema = z.enum([
  'MODERN_PROFESSIONAL',
  'CLEAN_MINIMAL',
  'CREATIVE',
  'EXECUTIVE',
]);
export type CvTemplate = z.infer<typeof cvTemplateSchema>;
