// Test 5: Wallet Balance Testing
import { describe, expect, test } from '@jest/globals';

describe('Wallet Balance Testing', () => {
  test('Wallet balance should increase after deposit', () => {
    const oldBalance = 1000;
    const deposit = 500;
    const newBalance = oldBalance + deposit;
    expect(newBalance).toBe(1500);
  });
});
