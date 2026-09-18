import { ApiError, ApiErrorCode } from './client';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Item 14 — one place that turns anything thrown by the API layer into a
 * sentence a person can act on, in their own language.
 *
 * Screens used to do `RNAlert.alert(title, e.message)`, which meant whatever
 * the server (or the fetch layer) produced went straight onto the screen —
 * "Network request failed", "Internal server error", or a raw Prisma
 * constraint dump. Now every call site passes the error through here: a known
 * `code` becomes a translated string, and anything unrecognised falls back to
 * a generic "try again" rather than leaking internals.
 *
 * Validation messages (INVALID_REQUEST) are the one case where the server's
 * own text is kept — those are written for a person and are specific to the
 * field that failed ("Maximum salary cannot be below the minimum."), so
 * replacing them with a generic line would be a downgrade.
 */
const CODE_KEYS: Record<ApiErrorCode, string> = {
  OFFLINE: 'error.offline',
  TIMEOUT: 'error.timeout',
  SESSION_EXPIRED: 'error.sessionExpired',
  NOT_ALLOWED: 'error.notAllowed',
  NOT_FOUND: 'error.notFound',
  DUPLICATE: 'error.duplicate',
  INVALID_REQUEST: 'error.invalidRequest',
  LINKED_RECORD_MISSING: 'error.linkedRecordMissing',
  TOO_MANY_REQUESTS: 'error.tooManyRequests',
  SERVICE_UNAVAILABLE: 'error.serviceUnavailable',
  SERVER_ERROR: 'error.serverError',
};

/**
 * The `t` the app is currently using, registered by I18nProvider.
 *
 * `useApi` turns a failed request into the string its screen renders, but it
 * is a plain hook with no access to the i18n context, and threading `t`
 * through every one of its ~30 call sites to fix that would be a lot of churn
 * for no behaviour change. Registering the active translator here instead
 * means the hook (and anything else outside the React tree) gets the same
 * translated, friendly text with no call-site changes at all. It updates
 * whenever the language does.
 */
let activeT: TFn | null = null;

export function registerErrorTranslator(t: TFn) {
  activeT = t;
}

/// Same mapping as `friendlyError`, for callers that can't reach `t`.
/// Falls back to the raw message only before the provider has mounted.
export function friendlyErrorAuto(error: unknown): string {
  if (activeT) return friendlyError(error, activeT);
  return error instanceof Error ? error.message : 'Something went wrong. Try again in a moment.';
}

export function friendlyError(error: unknown, t: TFn): string {
  if (error instanceof ApiError) {
    // Keep the server's wording for validation failures — see the note above.
    if (error.code === 'INVALID_REQUEST' && error.message) {
      return error.message;
    }

    const base = t(CODE_KEYS[error.code] ?? 'error.serverError');
    return error.reference ? `${base} (${t('error.reference', { reference: error.reference })})` : base;
  }

  return t('error.serverError');
}
