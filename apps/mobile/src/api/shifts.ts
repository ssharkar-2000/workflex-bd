import {
  shiftDetailSchema,
  shiftListSchema,
  type CreateShiftInput,
  type ShiftCheckInDto,
  type ShiftCheckOutDto,
  type ShiftDetail,
  type ShiftFilter,
  type ShiftList,
  type ShiftSide,
} from '@workflex/shared';
import { api } from './client';

/** Shifts you work or shifts you posted, with the tab counts. */
export async function fetchShifts(side: ShiftSide, filter: ShiftFilter): Promise<ShiftList> {
  const { data } = await api.get('/shifts/me', { params: { side, filter } });
  return shiftListSchema.parse(data);
}

export async function fetchShift(id: string): Promise<ShiftDetail> {
  const { data } = await api.get(`/shifts/${id}`);
  return shiftDetailSchema.parse(data);
}

/** Put someone you hired on a shift. */
export async function createShift(input: CreateShiftInput): Promise<ShiftDetail> {
  const { data } = await api.post('/shifts', input);
  return shiftDetailSchema.parse(data);
}

export async function checkIn(id: string, body: ShiftCheckInDto): Promise<ShiftDetail> {
  const { data } = await api.post(`/shifts/${id}/check-in`, body);
  return shiftDetailSchema.parse(data);
}

export async function checkOut(id: string, body: ShiftCheckOutDto): Promise<ShiftDetail> {
  const { data } = await api.post(`/shifts/${id}/check-out`, body);
  return shiftDetailSchema.parse(data);
}

export async function cancelShift(id: string, reason: string): Promise<ShiftDetail> {
  const { data } = await api.post(`/shifts/${id}/cancel`, { reason });
  return shiftDetailSchema.parse(data);
}
