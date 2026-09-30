import {
  cvBulletsResultSchema,
  cvDraftResultSchema,
  cvSummaryResultSchema,
  type CvBulletsInput,
  type CvBulletsResult,
  type CvDraftResult,
  type CvSummaryInput,
  type CvSummaryResult,
  type GenerateCvInput,
} from '@workflex/shared';
import { api } from './client';

/**
 * Ask for a CV drafted from this account's own details.
 *
 * Returns a draft for the builder to fill in — nothing is saved by this call.
 * `source` says whether a model phrased it or the details were simply laid
 * out, which the screen passes on rather than hiding.
 */
export async function generateCv(input: GenerateCvInput): Promise<CvDraftResult> {
  const { data } = await api.post('/cv/generate', input);
  return cvDraftResultSchema.parse(data);
}

/**
 * Rewrite the summary paragraph alone.
 *
 * `variant` goes up by one each press, so asking twice gives two versions of
 * the same facts rather than the same sentence back.
 */
export async function writeSummary(input: CvSummaryInput): Promise<CvSummaryResult> {
  const { data } = await api.post('/cv/summary', input);
  return cvSummaryResultSchema.parse(data);
}

/** Suggest the points for one job, from its title and this account's record. */
export async function suggestBullets(input: CvBulletsInput): Promise<CvBulletsResult> {
  const { data } = await api.post('/cv/bullets', input);
  return cvBulletsResultSchema.parse(data);
}
