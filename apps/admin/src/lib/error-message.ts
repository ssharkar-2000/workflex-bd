import { ApiErrorCode } from '@workflex/shared';
import { toApiError } from '../api/client';

/**
 * Same principle as the worker app: show a sentence, never a code or an axios
 * string. The admin portal has a smaller surface so this is a plain function
 * rather than a hook — there is no translation layer here, the portal is
 * English-only by design (its users are staff, not the public).
 */
const MESSAGES: Record<string, string> = {
  [ApiErrorCode.VALIDATION_FAILED]: 'Please check the details you entered.',
  [ApiErrorCode.UNAUTHORIZED]: 'Your session has ended. Please sign in again.',
  [ApiErrorCode.FORBIDDEN]: 'You do not have permission to do that.',
  [ApiErrorCode.NOT_FOUND]: 'That record could not be found.',
  [ApiErrorCode.RATE_LIMITED]: 'Too many attempts. Please wait a moment.',
  [ApiErrorCode.INVALID_CREDENTIALS]: 'Incorrect email or password.',
  [ApiErrorCode.ACCOUNT_SUSPENDED]: 'This account is not active.',
  [ApiErrorCode.INTERNAL]: 'Something went wrong. Please try again.',
};

export function errorText(err: unknown): string {
  const error = toApiError(err);

  if (error.statusCode === 0) {
    return 'Cannot reach the server. Check your connection and try again.';
  }

  // Field messages come from the shared zod schemas and are already written
  // for a person, so they beat any generic sentence.
  for (const messages of Object.values(error.fieldErrors ?? {})) {
    const first = messages?.[0];
    if (first) return first;
  }

  return MESSAGES[error.code] ?? MESSAGES[ApiErrorCode.INTERNAL]!;
}
