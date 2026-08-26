import { create } from 'zustand';
import type { OnboardingProfileInput } from '@workflex/shared';

interface DraftState {
  /** The validated form, held between "Register Now" and the OTP screen. */
  draft: OnboardingProfileInput | null;
  /** Normalised +8801XXXXXXXXX the code was sent to. */
  phone: string | null;
  set: (draft: OnboardingProfileInput, phone: string) => void;
  clear: () => void;
}

/**
 * Carries the registration form across to the verification screen.
 *
 * Deliberately in memory only, and deliberately not router params: the draft
 * contains the chosen password, and expo-router params end up in the URL,
 * where they would be readable in logs and deep-link history. Nothing here is
 * persisted, so backgrounding the app mid-registration loses the draft — which
 * is the right trade for not writing a plaintext password to disk.
 *
 * The profile cannot be saved before this point anyway: POST /onboarding/profile
 * is authenticated by the session that verifying the code creates.
 */
export const useRegistrationDraft = create<DraftState>((set) => ({
  draft: null,
  phone: null,
  set: (draft, phone) => set({ draft, phone }),
  clear: () => set({ draft: null, phone: null }),
}));
