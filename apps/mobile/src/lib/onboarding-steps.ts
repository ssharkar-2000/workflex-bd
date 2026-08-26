import { useIntentStore } from '../store/intent-store';

/**
 * A job seeker skips the individual/company question entirely, so their wizard
 * is one step shorter. The progress bar has to reflect that or it stalls at
 * "step 2 of 4" and looks broken.
 *
 * Counts: details → verify → documents → review, plus account type for a
 * recruiter. Verification became its own step when the SMS check moved off
 * the registration form.
 */
export function useStepCount(): { total: number; offset: number } {
  const intent = useIntentStore((s) => s.intent);
  const isRecruiter = intent === 'HIRE';

  return {
    total: isRecruiter ? 5 : 4,
    // Recruiters spend step 1 choosing an account type; seekers start at
    // details, so every later step shifts down by one for them.
    offset: isRecruiter ? 1 : 0,
  };
}
