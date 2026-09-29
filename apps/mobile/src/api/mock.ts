import {
  mockProgressSchema,
  mockResultSchema,
  mockSubjectsSchema,
  mockTestSchema,
  type MockLevel,
  type MockProgress,
  type MockResult,
  type MockSubjects,
  type MockTest,
} from '@workflex/shared';
import { api } from './client';

export async function fetchSubjects(): Promise<MockSubjects> {
  const { data } = await api.get('/mock-tests/subjects');
  return mockSubjectsSchema.parse(data);
}

/** Generating questions is the slow part, so this waits longer than usual. */
export async function startTest(subject: string, level?: MockLevel): Promise<MockTest> {
  const { data } = await api.post('/mock-tests', { subject, level }, { timeout: 90_000 });
  return mockTestSchema.parse(data);
}

export async function submitTest(
  id: string,
  answers: (number | null)[],
): Promise<MockResult> {
  const { data } = await api.post(`/mock-tests/${id}/submit`, { answers }, { timeout: 60_000 });
  return mockResultSchema.parse(data);
}

export async function fetchResult(id: string): Promise<MockResult> {
  const { data } = await api.get(`/mock-tests/${id}/result`);
  return mockResultSchema.parse(data);
}

export async function fetchProgress(): Promise<MockProgress> {
  const { data } = await api.get('/mock-tests/progress');
  return mockProgressSchema.parse(data);
}
