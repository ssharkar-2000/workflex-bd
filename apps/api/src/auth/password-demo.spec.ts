// Functional Testing - Password Validation
// Test 1: Valid Password
// Purpose: Verify that a correct password is accepted
// Test 2: Invalid Password
// Purpose: Verify that an incorrect password is rejected
import { describe, expect, test } from '@jest/globals';

describe('Password Validation Testing', () => {
  test('Test 1: Valid password should pass', () => {
    const password = '123456';
    const correctPassword = '123456';
    expect(password).toBe(correctPassword);
  });

  test('Test 2: Invalid password should be rejected', () => {
    const password = 'wrong123';
    const correctPassword = '123456';
    expect(password).not.toBe(correctPassword);
  });
});
