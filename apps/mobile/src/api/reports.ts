import {
  myReportListSchema,
  myReportSchema,
  type CreateReportDto,
  type MyReport,
  type MyReportList,
} from '@workflex/shared';
import { api } from './client';

export async function fetchMyReports(): Promise<MyReportList> {
  const { data } = await api.get('/reports');
  return myReportListSchema.parse(data);
}

export async function createReport(dto: CreateReportDto): Promise<MyReport> {
  const { data } = await api.post('/reports', dto);
  return myReportSchema.parse(data);
}
