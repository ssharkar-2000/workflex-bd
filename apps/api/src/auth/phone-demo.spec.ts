// Test 3: Phone Number Testing
import { describe, expect, test } from '@jest/globals';

describe('Phone Number Testing', () => {
  test('Bangladesh phone number should contain 11 digits', () => {
    const phone = '01712345678';
    expect(phone).toHaveLength(11);
  });
});
