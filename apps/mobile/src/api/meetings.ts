import { z } from 'zod';
import {
  joinMeetingResultSchema,
  meetingContactsSchema,
  meetingSchema,
  meetingTemplateSchema,
  meetingsOverviewSchema,
  physicalRoomSchema,
  type CreateRoomInput,
  type JoinMeetingResult,
  type Meeting,
  type MeetingPerson,
  type MeetingResponse,
  type MeetingTab,
  type MeetingTemplate,
  type MeetingsOverview,
  type PhysicalRoom,
  type ScheduleMeetingInput,
} from '@workflex/shared';
import { api } from './client';

/** One tab of the Meetings screen, with the counts for all of them. */
export async function fetchMeetings(tab: MeetingTab): Promise<MeetingsOverview> {
  const { data } = await api.get('/meetings', { params: { tab } });
  return meetingsOverviewSchema.parse(data);
}

export async function fetchMeeting(id: string): Promise<Meeting> {
  const { data } = await api.get(`/meetings/${id}`);
  return meetingSchema.parse(data);
}

export async function scheduleMeeting(input: ScheduleMeetingInput): Promise<Meeting> {
  const { data } = await api.post('/meetings', input);
  return meetingSchema.parse(data);
}

/** A pass into the video room. Asked for at the moment of joining, never kept. */
export async function joinMeeting(id: string): Promise<JoinMeetingResult> {
  const { data } = await api.post(`/meetings/${id}/join`);
  return joinMeetingResultSchema.parse(data);
}

export async function leaveMeeting(id: string): Promise<void> {
  await api.post(`/meetings/${id}/leave`);
}

export async function respondToMeeting(id: string, response: Exclude<MeetingResponse, 'PENDING'>): Promise<Meeting> {
  const { data } = await api.post(`/meetings/${id}/respond`, { response });
  return meetingSchema.parse(data);
}

export async function cancelMeeting(id: string, scope: 'ONE' | 'SERIES'): Promise<Meeting> {
  const { data } = await api.post(`/meetings/${id}/cancel`, { scope });
  return meetingSchema.parse(data);
}

export async function endMeeting(id: string): Promise<Meeting> {
  const { data } = await api.post(`/meetings/${id}/end`);
  return meetingSchema.parse(data);
}

/** People the host can pick from without typing an ID. */
export async function fetchContacts(): Promise<MeetingPerson[]> {
  const { data } = await api.get('/meetings/contacts');
  return meetingContactsSchema.parse(data).contacts;
}

export async function fetchTemplates(): Promise<MeetingTemplate[]> {
  const { data } = await api.get('/meetings/templates');
  return z.array(meetingTemplateSchema).parse(data);
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/meetings/templates/${id}`);
}

export async function fetchRooms(): Promise<PhysicalRoom[]> {
  const { data } = await api.get('/meetings/rooms');
  return z.array(physicalRoomSchema).parse(data);
}

export async function createRoom(input: CreateRoomInput): Promise<PhysicalRoom> {
  const { data } = await api.post('/meetings/rooms', input);
  return physicalRoomSchema.parse(data);
}

export async function deleteRoom(id: string): Promise<void> {
  await api.delete(`/meetings/rooms/${id}`);
}
