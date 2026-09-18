/**
 * Keystroke filters for text inputs.
 *
 * These run on every change so a disallowed character never appears at all,
 * rather than being accepted and rejected on submit. They mirror the zod
 * schemas exactly — the filter stops the typing, the schema is still the
 * authority, and the API validates independently of both.
 */

/** Letters (any script), spaces, apostrophes, dots, hyphens. No digits. */
export function sanitizePersonName(value: string): string {
  return value.replace(/[^\p{L}\p{M}\s.'-]/gu, '').slice(0, 60);
}

/** Adds digits and business punctuation to the personal-name set. */
export function sanitizeOrganisationName(value: string): string {
  return value.replace(/[^\p{L}\p{M}\p{N}\s.,&'()\-/]/gu, '').slice(0, 120);
}

export function sanitizeDesignation(value: string): string {
  return value.replace(/[^\p{L}\p{M}\s.&'()\-/]/gu, '').slice(0, 80);
}

/** Registration, licence and similar reference numbers. */
export function sanitizeReferenceNumber(value: string): string {
  return value.replace(/[^A-Za-z0-9\-/ ]/g, '').toUpperCase().slice(0, 60);
}

export function sanitizeAddress(value: string): string {
  return value.replace(/[^\p{L}\p{M}\p{N}\s.,#\-/()'&]/gu, '').slice(0, 255);
}

/** Digits only — TIN, and the national part of a phone number. */
export function sanitizeDigits(value: string, maxLength = 20): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/** Emails never contain spaces or capitals worth preserving. */
export function sanitizeEmail(value: string): string {
  return value.replace(/\s/g, '').toLowerCase().slice(0, 254);
}
