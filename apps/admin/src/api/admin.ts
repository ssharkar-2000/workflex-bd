import {
  adminAnalyticsSchema,
  adminAuthTokensSchema,
  adminCompanyListSchema,
  adminDashboardSchema,
  adminUserListSchema,
  aiMonitoringSchema,
  attendanceListSchema,
  contentBlockSchema,
  fraudReportSchema,
  kycQueueResponseSchema,
  notificationSchema,
  reportSummarySchema,
  securityOverviewSchema,
  supportListSchema,
  systemStatusSchema,
  type AdminAuthTokens,
  type AdminDashboard,
  type AdminUserFilter,
  type AdminUserList,
  type KycQueueResponse,
} from '@workflex/shared';
import { api } from './client';
import { env } from '../lib/env';
import { useAdminStore } from '../store/admin-store';

export async function adminLogin(
  email: string,
  password: string,
): Promise<AdminAuthTokens> {
  const { data } = await api.post('/auth/admin/login', { email, password });
  return adminAuthTokensSchema.parse(data);
}

export async function fetchDashboard(): Promise<AdminDashboard> {
  const { data } = await api.get('/admin/dashboard');
  return adminDashboardSchema.parse(data);
}

export async function fetchUsers(params: {
  filter?: AdminUserFilter;
  search?: string;
  accountType?: 'INDIVIDUAL' | 'COMPANY';
  page?: number;
}): Promise<AdminUserList> {
  const { data } = await api.get('/admin/users', { params });
  return adminUserListSchema.parse(data);
}

export async function setUserStatus(
  id: string,
  status: 'ACTIVE' | 'SUSPENDED',
  reason?: string,
): Promise<void> {
  await api.patch(`/admin/users/${id}/status`, { status, reason });
}

export async function fetchKycQueue(): Promise<KycQueueResponse> {
  const { data } = await api.get('/admin/kyc/queue');
  return kycQueueResponseSchema.parse(data);
}

export async function approveKyc(id: string): Promise<void> {
  await api.post(`/admin/kyc/${id}/approve`);
}

export async function rejectKyc(id: string, reason: string): Promise<void> {
  await api.post(`/admin/kyc/${id}/reject`, { reason });
}

/**
 * Documents come back as raw bytes, so they load through <Image> by URL
 * rather than the axios instance — which is also why the bearer token has to
 * be passed as an explicit header here.
 */
export function kycDocumentUrl(userId: string, kind: string): string {
  return `${env.apiUrl}/admin/kyc/${userId}/documents/${kind}`;
}

export function authImageHeaders(): Record<string, string> {
  const token = useAdminStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// --- sections ---
// Responses are parsed through the shared schemas so a contract change shows
// up here as a clear error rather than an undefined field inside a screen.

export async function fetchCompanies(search?: string) {
  const { data } = await api.get('/admin/companies', { params: { search } });
  return adminCompanyListSchema.parse(data);
}

export async function fetchAnalytics() {
  const { data } = await api.get('/admin/analytics');
  return adminAnalyticsSchema.parse(data);
}

export async function fetchAiMonitoring() {
  const { data } = await api.get('/admin/ai-monitoring');
  return aiMonitoringSchema.parse(data);
}

export async function fetchFraud() {
  const { data } = await api.get('/admin/fraud');
  return fraudReportSchema.parse(data);
}

export async function fetchSecurity() {
  const { data } = await api.get('/admin/security');
  return securityOverviewSchema.parse(data);
}

export async function revokeSessions(userId: string): Promise<void> {
  await api.post(`/admin/security/users/${userId}/revoke`);
}

export async function fetchSystem() {
  const { data } = await api.get('/admin/system');
  return systemStatusSchema.parse(data);
}

export async function fetchReport() {
  const { data } = await api.get('/admin/reports/summary');
  return reportSummarySchema.parse(data);
}

export async function fetchNotifications() {
  const { data } = await api.get('/admin/notifications');
  return notificationSchema.array().parse(data);
}

export async function createNotification(input: {
  title: string;
  body: string;
  audience: 'ALL' | 'WORKERS' | 'EMPLOYERS';
}) {
  const { data } = await api.post('/admin/notifications', input);
  return notificationSchema.parse(data);
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/admin/notifications/${id}`);
}

export async function fetchTickets(status?: string) {
  const { data } = await api.get('/admin/support', { params: { status } });
  return supportListSchema.parse(data);
}

export async function respondToTicket(
  id: string,
  response: string,
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
): Promise<void> {
  await api.patch(`/admin/support/${id}`, { response, status });
}

export async function fetchContent() {
  const { data } = await api.get('/admin/content');
  return contentBlockSchema.array().parse(data);
}

export async function upsertContent(input: {
  key: string;
  title: string;
  body: string;
  locale: 'bn' | 'en';
}) {
  const { data } = await api.post('/admin/content', input);
  return contentBlockSchema.parse(data);
}

export async function deleteContent(key: string): Promise<void> {
  await api.delete(`/admin/content/${key}`);
}

export async function fetchAttendance(status?: string) {
  const { data } = await api.get('/admin/attendance', { params: { status } });
  return attendanceListSchema.parse(data);
}

export async function changeAdminPassword(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await api.patch('/admin/me/password', input);
}
