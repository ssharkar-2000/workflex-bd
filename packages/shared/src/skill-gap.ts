import { z } from 'zod';
import { jobCategorySchema } from './job-categories';

/**
 * What to learn next, from what employers on this platform are actually asking
 * for.
 *
 * The premise is that a job board already knows the answer. Every open posting
 * names the skills its employer wants; a CV names the skills its owner has.
 * Counting the first, subtracting the second and ordering by demand gives a
 * ranked list of what is worth learning — no model call, no external data set,
 * and every number traceable to rows a reader could count themselves.
 *
 * That traceability is the point. "Learn TypeScript" from an opaque model is
 * advice; "34 open jobs here ask for TypeScript and your CV does not mention
 * it" is evidence, and evidence is what makes it worth acting on.
 */

/** One skill worth learning, with the demand that justifies saying so. */
export const skillGapSchema = z.object({
  /** The term as it appears in postings — "typescript", "figma". */
  skill: z.string(),
  /**
   * Share of open postings in the target field that ask for this, 0–100.
   * Demand, not difficulty: a high number means many employers want it.
   */
  relevance: z.number().int().min(0).max(100),
  /**
   * Postings that name this skill and that the person does not already match
   * well. The honest reading of "learning this could unlock N more jobs".
   */
  unlocks: z.number().int().nonnegative(),
  /**
   * Postings naming this skill, the raw count `relevance` was derived from.
   *
   * Sent alongside the percentage so the explanation can say "2 of 11" rather
   * than only "18%". A share on its own hides its own sample size, and 18% of
   * eleven postings deserves less weight than 18% of four hundred.
   */
  postings: z.number().int().nonnegative(),
  /**
   * The skill already on the CV that this one most often appears beside, and
   * how many postings name both.
   *
   * Null when nothing on the CV shows up in the same postings — which says
   * something real, namely that this skill sits away from everything the
   * person can already do.
   *
   * Notably not a "related to" judgement. Nothing here knows that TypeScript
   * resembles JavaScript; it knows that employers on this platform ask for
   * them together, which is a fact with a number behind it.
   */
  pairedWith: z
    .object({ skill: z.string(), jobs: z.number().int().positive() })
    .nullable(),
});
export type SkillGap = z.infer<typeof skillGapSchema>;

export const skillPathSchema = z.object({
  /**
   * The field this is measured against, and the most common job title in it.
   *
   * Derived from the person's own CV categories rather than asked for: a
   * question at signup is a question most people in this market skip.
   */
  category: jobCategorySchema,
  /** e.g. "Software developer" — the commonest open title in that field. */
  targetRole: z.string(),
  /** Open postings in the field the figures below are drawn from. */
  jobsConsidered: z.number().int().nonnegative(),

  /**
   * Share of the field's in-demand skills the CV already covers, 0–100.
   *
   * Deliberately not "employability": it measures overlap with what is being
   * advertised right now, which is a narrower and more defensible claim than
   * how ready someone is for work.
   */
  readiness: z.number().int().min(0).max(100),

  /** Skills the person already has that the field is asking for. */
  strengths: z.array(z.string()),
  /** What to learn next, most in demand first. */
  gaps: z.array(skillGapSchema),
});
export type SkillPath = z.infer<typeof skillPathSchema>;

/**
 * Null when there is nothing honest to say — no CV, or no postings in the
 * person's field to measure against. The card hides itself rather than
 * inventing a target to be ready for.
 */
export const skillPathResponseSchema = z.object({
  path: skillPathSchema.nullable(),
});
export type SkillPathResponse = z.infer<typeof skillPathResponseSchema>;
