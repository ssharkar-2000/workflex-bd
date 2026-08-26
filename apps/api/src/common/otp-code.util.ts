import { randomInt } from 'node:crypto';

export const OTP_LENGTH = 6;

/**
 * Generates the one-time code used for both SMS and email verification.
 *
 * `crypto.randomInt` rather than `Math.random`: Math.random is a fast PRNG
 * whose output is predictable from previous values, which for a login code is
 * the whole ballgame. randomInt draws from the OS entropy pool and is
 * rejection-sampled, so every value in the range is equally likely — no bias
 * toward low numbers the way `% 1000000` would give.
 *
 * Padded rather than range-limited, so codes beginning with zero ("004821")
 * stay possible. Excluding them would quietly cut the keyspace by a tenth.
 */
export function generateOtpCode(length: number = OTP_LENGTH): string {
  const max = 10 ** length;
  return randomInt(0, max)
    .toString()
    .padStart(length, '0');
}

/** Pulls a code back out of a rendered message, for the dev outbox and logs. */
export function extractOtpCode(text: string): string | null {
  const match = new RegExp(`\\b(\\d{${OTP_LENGTH}})\\b`).exec(text);
  return match?.[1] ?? null;
}
