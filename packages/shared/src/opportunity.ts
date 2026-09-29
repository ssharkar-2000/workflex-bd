import { z } from 'zod';
import { jobCategorySchema } from './job-categories';

/**
 * The local opportunity: one line telling somebody where the work is.
 *
 * Both numbers are counts of real rows — open postings in a category near
 * this person, and accounts whose CV points at that category in the same
 * area. Nothing is estimated, and when there is nothing worth saying the
 * card returns null and hides itself rather than manufacturing a headline.
 *
 * "High demand" means the postings outnumber the people who could fill them
 * *there*, which is a claim the two counts on the card support. It is not a
 * forecast and does not promise anybody a job.
 */
export const opportunitySchema = z.object({
  category: jobCategorySchema,
  /** The area the counts are for, as the person wrote it. */
  area: z.string(),
  openJobs: z.number().int().nonnegative(),
  /** Accounts in the same area whose CV points at this work. */
  matchingWorkers: z.number().int().nonnegative(),
  /** True when postings clearly outnumber the people available. */
  highDemand: z.boolean(),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

export const opportunityResponseSchema = z.object({
  opportunity: opportunitySchema.nullable(),
});
export type OpportunityResponse = z.infer<typeof opportunityResponseSchema>;
