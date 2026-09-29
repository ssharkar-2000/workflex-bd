import {
  coverGapsSchema,
  notifyResultSchema,
  replacementListSchema,
  shiftDetailSchema,
  type ConfirmReplacementDto,
  type CoverGaps,
  type NotifyReplacementsDto,
  type NotifyResult,
  type ReplacementList,
  type ShiftDetail,
} from '@workflex/shared';
import { api } from './client';

/** Cancelled shifts on this account's own postings that still need somebody. */
export async function fetchGaps(): Promise<CoverGaps> {
  const { data } = await api.get('/shifts/gaps');
  return coverGapsSchema.parse(data);
}

/**
 * The ranked shortlist for one gap.
 *
 * Given a long timeout: the ranking is arithmetic and fast, but the lines
 * beside each name are written by a model, and a person filling tomorrow's
 * shift would rather wait ten seconds than read eight bare scores.
 */
export async function fetchCover(shiftId: string): Promise<ReplacementList> {
  const { data } = await api.get(`/shifts/${shiftId}/cover`, { timeout: 60_000 });
  return replacementListSchema.parse(data);
}

export async function askCover(
  shiftId: string,
  dto: NotifyReplacementsDto,
): Promise<NotifyResult> {
  const { data } = await api.post(`/shifts/${shiftId}/cover/ask`, dto);
  return notifyResultSchema.parse(data);
}

export async function confirmCover(
  shiftId: string,
  dto: ConfirmReplacementDto,
): Promise<ShiftDetail> {
  const { data } = await api.post(`/shifts/${shiftId}/cover/confirm`, dto);
  return shiftDetailSchema.parse(data);
}
