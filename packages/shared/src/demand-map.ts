import { z } from 'zod';
import { divisionSchema } from './bd-geography';
import { jobCategorySchema } from './job-categories';

/**
 * Where the work is, and where the workers are.
 *
 * Both halves come from the platform's own rows — open postings on one side,
 * accounts with a locatable address on the other. Nothing here is forecast
 * and nothing is bought in: it is a count of what WorkFlex BD holds today,
 * which is the only demand figure this app can stand behind.
 *
 * That honesty shapes the whole feature. An absolute number of postings in a
 * division says more about how many employers have joined than about the
 * labour market, so the map never colours on absolute counts. It colours on
 * how a division's vacancies-per-worker compares with the national figure —
 * a ratio that stays meaningful whether the platform holds two hundred
 * postings or two hundred thousand.
 */

/**
 * Which way an area leans.
 *
 * Named for what a person can do about it rather than in the vocabulary of
 * economics. "Short of workers" is where somebody looking for work should
 * look; "short of work" is where they will be competing.
 */
export const demandBandSchema = z.enum(['SHORT_OF_WORKERS', 'BALANCED', 'SHORT_OF_WORK']);
export type DemandBand = z.infer<typeof demandBandSchema>;

/** One work category inside one division. */
export const categoryDemandSchema = z.object({
  category: jobCategorySchema,
  vacancies: z.number().int().nonnegative(),
  workers: z.number().int().nonnegative(),
  band: demandBandSchema,
});
export type CategoryDemand = z.infer<typeof categoryDemandSchema>;

export const areaDemandSchema = z.object({
  division: divisionSchema,
  en: z.string(),
  bn: z.string(),
  lat: z.number(),
  lng: z.number(),
  openJobs: z.number().int().nonnegative(),
  /** Posts, not postings: a listing hiring six people counts six. */
  vacancies: z.number().int().nonnegative(),
  workers: z.number().int().nonnegative(),
  /** This division's share of all open posts, as a percentage. */
  shareOfPosts: z.number(),
  /** Its share of all locatable workers, as a percentage. */
  shareOfWorkers: z.number(),
  /**
   * Share of posts divided by share of workers.
   *
   * The number the bands are cut from. Above one means the division carries
   * more of the country's work than of its workers; below one, the reverse.
   * Null when no worker here could be placed at all, which is a different
   * statement from a ratio of zero and is shown differently.
   */
  quotient: z.number().nullable(),
  band: demandBandSchema,
  /** The categories that most decide this division's colour, worst first. */
  topCategories: z.array(categoryDemandSchema),
});
export type AreaDemand = z.infer<typeof areaDemandSchema>;

/** One undersupplied pairing: this kind of work, in this division. */
export const demandGapSchema = z.object({
  division: divisionSchema,
  en: z.string(),
  bn: z.string(),
  category: jobCategorySchema,
  vacancies: z.number().int().nonnegative(),
  workers: z.number().int().nonnegative(),
  /** One line on what it means for the person reading. */
  why: z.string(),
});
export type DemandGap = z.infer<typeof demandGapSchema>;

export const demandMapSchema = z.object({
  areas: z.array(areaDemandSchema),
  gaps: z.array(demandGapSchema),
  /** Two or three sentences over the whole map. */
  insight: z.string(),
  source: z.enum(['written', 'assembled']),
  totals: z.object({
    vacancies: z.number().int().nonnegative(),
    workers: z.number().int().nonnegative(),
  }),
  /**
   * What the map could not place, and therefore is not counting.
   *
   * Shown on the screen rather than swallowed. A map that silently drops a
   * third of its postings is a map that lies, and the reader deserves to
   * know how much of the picture they are looking at.
   */
  unplaced: z.object({
    jobs: z.number().int().nonnegative(),
    workers: z.number().int().nonnegative(),
  }),
});
export type DemandMap = z.infer<typeof demandMapSchema>;
