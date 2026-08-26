import { useIntentStore } from '../store/intent-store';

/**
 * A job seeker skips the individual/company question entirely, so their wizard
 * is one step shorter. The progress bar has to reflect that or it stalls at
 * "step 2 of 4" and looks broken.
 */
export function useStepCount(): { total: number; offset: number } {
  const intent = useIntentStore((s) => s.intent);
  const isRecruiter = intent === 'HIRE';

  return {
    total: isRecruiter ? 4 : 3,
    // Recruiters spend step 1 choosing an account type; seekers start at
    // details, so every later step shifts down by one for them.
    offset: isRecruiter ? 1 : 0,
  };
}
