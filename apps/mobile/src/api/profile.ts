import {
  myProfileSchema,
  type MyProfile,
  type ProfileUpdateInput,
} from '@workflex/shared';
import { api } from './client';

export async function fetchMyProfile(): Promise<MyProfile> {
  const { data } = await api.get('/me/profile');
  return myProfileSchema.parse(data);
}

export async function updateMyProfile(
  input: ProfileUpdateInput,
): Promise<MyProfile> {
  const { data } = await api.patch('/me/profile', input);
  return myProfileSchema.parse(data);
}
