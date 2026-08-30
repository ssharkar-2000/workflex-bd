import { useCallback } from 'react';
import { ApiErrorCode, type ApiError } from '@workflex/shared';
import { toApiError } from '../api/client';
import { useT, type TranslationKey } from '../i18n';

/**
 * Every ApiErrorCode gets a sentence a person can act on.
 *
 * The server's own `message` is deliberately not shown. It is written in
 * English for developers and log readers, and some paths (a NestJS
 * HttpException, an axios failure) carry text like "Request failed with
 * status code 409" that means nothing to someone trying to sign in. The
 * code is the stable contract — see the comment on ApiErrorCode — so the
 * app translates that instead and stays correct in Bangla too.
 */
const MESSAGE_KEYS: Record<string, TranslationKey> = {
  [ApiErrorCode.VALIDATION_FAILED]: 'error.VALIDATION_FAILED',
  [ApiErrorCode.UNAUTHORIZED]: 'error.UNAUTHORIZED',
  [ApiErrorCode.FORBIDDEN]: 'error.FORBIDDEN',
  [ApiErrorCode.NOT_FOUND]: 'error.NOT_FOUND',
  [ApiErrorCode.RATE_LIMITED]: 'error.RATE_LIMITED',
  [ApiErrorCode.INTERNAL]: 'error.INTERNAL',

  [ApiErrorCode.OTP_INVALID]: 'error.OTP_INVALID',
  [ApiErrorCode.OTP_EXPIRED]: 'error.OTP_EXPIRED',
  [ApiErrorCode.OTP_TOO_MANY_ATTEMPTS]: 'error.OTP_TOO_MANY_ATTEMPTS',
  [ApiErrorCode.OTP_COOLDOWN]: 'error.OTP_COOLDOWN',
  [ApiErrorCode.SMS_DELIVERY_FAILED]: 'error.SMS_DELIVERY_FAILED',

  [ApiErrorCode.ONBOARDING_INCOMPLETE]: 'error.ONBOARDING_INCOMPLETE',
  [ApiErrorCode.ONBOARDING_ALREADY_SUBMITTED]:
    'error.ONBOARDING_ALREADY_SUBMITTED',
  [ApiErrorCode.UPLOAD_TOO_LARGE]: 'error.UPLOAD_TOO_LARGE',
  [ApiErrorCode.UPLOAD_INVALID_TYPE]: 'error.UPLOAD_INVALID_TYPE',

  [ApiErrorCode.TOO_MANY_OPEN_TICKETS]: 'error.TOO_MANY_OPEN_TICKETS',
  [ApiErrorCode.TOO_MANY_OPEN_REPORTS]: 'error.TOO_MANY_OPEN_REPORTS',
  [ApiErrorCode.COMPANY_VERIFICATION_REQUIRED]:
    'error.COMPANY_VERIFICATION_REQUIRED',

  [ApiErrorCode.EMAIL_IN_USE]: 'error.EMAIL_IN_USE',
  [ApiErrorCode.EMAIL_RESERVED]: 'error.EMAIL_RESERVED',
  [ApiErrorCode.EMAIL_CODE_INVALID]: 'error.EMAIL_CODE_INVALID',
  [ApiErrorCode.EMAIL_CODE_EXPIRED]: 'error.EMAIL_CODE_EXPIRED',
  [ApiErrorCode.EMAIL_COOLDOWN]: 'error.EMAIL_COOLDOWN',
  [ApiErrorCode.EMAIL_DELIVERY_FAILED]: 'error.EMAIL_DELIVERY_FAILED',

  [ApiErrorCode.REFRESH_TOKEN_INVALID]: 'error.REFRESH_TOKEN_INVALID',
  [ApiErrorCode.REFRESH_TOKEN_REUSED]: 'error.REFRESH_TOKEN_REUSED',

  [ApiErrorCode.INVALID_CREDENTIALS]: 'error.INVALID_CREDENTIALS',
  [ApiErrorCode.PASSWORD_NOT_SET]: 'error.PASSWORD_NOT_SET',
  [ApiErrorCode.ACCOUNT_SUSPENDED]: 'error.ACCOUNT_SUSPENDED',
  [ApiErrorCode.VERIFICATION_REQUIRED]: 'error.VERIFICATION_REQUIRED',
};

/** Codes whose message reads better with a number the server sent back. */
function paramsFor(error: ApiError): Record<string, string | number> {
  const details = (error.details ?? {}) as {
    retryAfter?: number;
    attemptsRemaining?: number;
  };
  return {
    seconds: details.retryAfter ?? 0,
    attempts: details.attemptsRemaining ?? 0,
  };
}

/**
 * Field-level validation messages come from the shared zod schemas, which are
 * already written for people ("Enter a valid name"), so the first one is more
 * useful than a generic "check your details".
 */
function firstFieldError(error: ApiError): string | null {
  const entries = Object.values(error.fieldErrors ?? {});
  for (const messages of entries) {
    const first = messages?.[0];
    if (first) return first;
  }
  return null;
}

export function useErrorMessage(): (err: unknown) => string {
  const t = useT();

  return useCallback(
    (err: unknown) => {
      const error = toApiError(err);

      // statusCode 0 is set by the client when the request never reached the
      // server at all — a dead Wi-Fi address rather than a rejected request.
      if (error.statusCode === 0) return t('error.network');

      if (error.code === ApiErrorCode.VALIDATION_FAILED) {
        const field = firstFieldError(error);
        if (field) return field;
      }

      const key = MESSAGE_KEYS[error.code];
      return key ? t(key, paramsFor(error)) : t('error.INTERNAL');
    },
    [t],
  );
}
