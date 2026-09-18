/**
 * Bangladeshi mobile number handling.
 *
 * Users type numbers every possible way: 01712345678, 8801712345678,
 * +8801712345678, 01712-345678. We normalise everything to E.164
 * (+8801XXXXXXXXX) so a phone number is a stable primary identity.
 */

/** Operator prefixes currently issued in BD: 013-019. */
const BD_MOBILE = /^(?:\+?880|0)?1[3-9]\d{8}$/;

export class InvalidPhoneError extends Error {
  constructor(input: string) {
    super(`Not a valid Bangladeshi mobile number: ${input}`);
    this.name = 'InvalidPhoneError';
  }
}

/** Strip spaces, dashes, parentheses and a leading +. */
function stripFormatting(input: string): string {
  return input.replace(/[\s\-()]/g, '');
}

export function isValidBdPhone(input: string): boolean {
  return BD_MOBILE.test(stripFormatting(input));
}

/**
 * Normalise any accepted form to +8801XXXXXXXXX.
 * Throws InvalidPhoneError if the input is not a BD mobile number.
 */
export function normalizeBdPhone(input: string): string {
  const cleaned = stripFormatting(input);
  if (!BD_MOBILE.test(cleaned)) throw new InvalidPhoneError(input);

  // Reduce to the 10 significant digits after the country code: 1XXXXXXXXX
  const withoutPlus = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  const national = withoutPlus.startsWith('880')
    ? withoutPlus.slice(3)
    : withoutPlus.startsWith('0')
      ? withoutPlus.slice(1)
      : withoutPlus;

  return `+880${national}`;
}

/** Display form for UI and logs: +8801712345678 -> +8801712***678 */
export function maskPhone(e164: string): string {
  if (e164.length < 8) return '***';
  return `${e164.slice(0, 9)}***${e164.slice(-3)}`;
}
