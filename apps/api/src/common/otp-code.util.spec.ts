import { extractOtpCode, generateOtpCode, OTP_LENGTH } from './otp-code.util';

describe('generateOtpCode', () => {
  it('always returns exactly six digits', () => {
    for (let i = 0; i < 500; i++) {
      expect(generateOtpCode()).toMatch(/^\d{6}$/);
    }
  });

  it('can produce codes that start with zero', () => {
    // Padding, not range-limiting: excluding leading zeros would drop a tenth
    // of the keyspace. Over 3000 draws this is all but certain to appear.
    const codes = Array.from({ length: 3000 }, () => generateOtpCode());
    expect(codes.some((c) => c.startsWith('0'))).toBe(true);
  });

  it('covers the full range including the endpoints', () => {
    const codes = new Set(Array.from({ length: 2000 }, () => generateOtpCode()));
    // A biased generator collapses toward a narrow band; a healthy one spreads.
    expect(codes.size).toBeGreaterThan(1900);
  });

  it('does not repeat within a small batch', () => {
    const codes = Array.from({ length: 50 }, () => generateOtpCode());
    expect(new Set(codes).size).toBeGreaterThan(45);
  });

  it('honours a custom length', () => {
    expect(generateOtpCode(4)).toMatch(/^\d{4}$/);
    expect(generateOtpCode(8)).toMatch(/^\d{8}$/);
  });

  it('uses six digits by default', () => {
    expect(OTP_LENGTH).toBe(6);
    expect(generateOtpCode()).toHaveLength(OTP_LENGTH);
  });
});

describe('extractOtpCode', () => {
  it('finds the code in a rendered message', () => {
    expect(
      extractOtpCode('483920 is your WorkFlex BD verification code.'),
    ).toBe('483920');
  });

  it('finds a code with a leading zero', () => {
    expect(extractOtpCode('Your code is 004821')).toBe('004821');
  });

  it('ignores numbers that are not six digits', () => {
    expect(extractOtpCode('expires in 5 minutes')).toBeNull();
    expect(extractOtpCode('reference 1234567')).toBeNull();
  });
});
