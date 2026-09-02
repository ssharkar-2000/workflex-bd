import { z } from 'zod';
import { jobListingSchema } from './jobs';

/**
 * Personalised job suggestions.
 *
 * The hard problem here is not ranking, it is that this product stores almost
 * nothing about what a person wants. There is no "preferred division" field,
 * no availability picker, no saved search. Asking for one would not help: the
 * audience is people checking for shift work on a cheap handset, and a
 * preferences form is exactly the screen they abandon.
 *
 * So the taste profile is *inferred* from what someone has already done —
 * every job they saved or applied to is a statement of preference they made
 * without filling anything in. A person who saved three delivery jobs in
 * Mirpur has told us their category, their area and their working hours more
 * reliably than a form would have.
 */

/** Which signal a suggestion came from, so the card can say why. */
export const recommendationReasonSchema = z.enum([
  /** Skills on the parsed CV appear in the posting. */
  'SKILLS',
  /** Same district or division as work they have shown interest in. */
  'LOCATION',
  /** Same shift or working hours as work they have shown interest in. */
  'AVAILABILITY',
  /** Same category or job type as work they have shown interest in. */
  'PREFERENCE',
]);
export type RecommendationReason = z.infer<typeof recommendationReasonSchema>;

export const recommendedJobSchema = z.object({
  job: jobListingSchema,
  /** 0–100. Not the CV match score — this blends four signals. */
  fit: z.number().int().min(0).max(100),
  /**
   * Why this was surfaced, strongest first. Never empty: a suggestion with
   * nothing to say for itself is not shown at all.
   */
  reasons: z.array(recommendationReasonSchema).min(1),
});
export type RecommendedJob = z.infer<typeof recommendedJobSchema>;

export const recommendationsSchema = z.object({
  items: z.array(recommendedJobSchema),
  /**
   * What the suggestions were built from, so the screen can be honest about
   * it rather than claiming to know things it does not.
   *
   * All false means there was nothing to go on — the section hides itself
   * instead of showing arbitrary jobs under a personalised heading.
   */
  basis: z.object({
    skills: z.boolean(),
    location: z.boolean(),
    availability: z.boolean(),
    preferences: z.boolean(),
  }),
});
export type Recommendations = z.infer<typeof recommendationsSchema>;
