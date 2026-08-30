/**
 * Registration is four steps for everyone: details → verify → documents →
 * review.
 *
 * It used to be five for a recruiter, who spent step one choosing between an
 * individual and a company account. That question is gone — there is one kind
 * of account, and posting jobs as a company is unlocked later by an approved
 * trade licence rather than declared at signup.
 *
 * The hook is kept, rather than inlining the numbers, so the wizard screens
 * do not each hard-code a step count that would drift apart.
 */
export function useStepCount(): { total: number; offset: number } {
  return { total: 4, offset: 0 };
}
