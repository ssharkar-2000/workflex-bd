import { z } from 'zod';

/**
 * Internships for people who have just finished studying.
 *
 * Same two halves as the volunteer board, for the same reason: what this
 * platform has posted is real and can be applied to; what is advertised
 * elsewhere changes weekly, so this suggests **what to search for** rather
 * than naming a placement that may have closed months ago.
 *
 * A fresh graduate applying to an internship that no longer exists loses a
 * day and some confidence. The search runs live and cannot go stale.
 */

export const internshipIdeaSchema = z.object({
  /** The kind of placement — "Bank internship", "NGO programme internship". */
  title: z.string(),
  /** The sort of organisation that runs them here. Empty when not knowable. */
  employers: z.string(),
  /** What a graduate gets out of it, in one line. No encouragement. */
  why: z.string(),
  /** What it usually asks for — a degree, a subject, a skill. */
  asksFor: z.string(),
  /** A ready-made Google search, scoped to where they are. */
  searchUrl: z.string().url(),
});
export type InternshipIdea = z.infer<typeof internshipIdeaSchema>;

export const internshipIdeasSchema = z.object({
  ideas: z.array(internshipIdeaSchema),
  /** The area the searches were built around. */
  area: z.string(),
  source: z.enum(['written', 'assembled']),
});
export type InternshipIdeas = z.infer<typeof internshipIdeasSchema>;
