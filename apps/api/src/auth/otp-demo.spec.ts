// Test 4: OTP Testing
import { describe, expect, test } from '@jest/globals';

describe('OTP Testing', () => {
  test('OTP should contain exactly 6 digits', () => {
    const otp = '483920';
    expect(otp).toHaveLength(6);
    expect(otp).toMatch(/^\d{6}$/);
  });
});
