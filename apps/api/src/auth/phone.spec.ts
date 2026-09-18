import { InvalidPhoneError, maskPhone, normalizeBdPhone } from '@workflex/shared';

describe('normalizeBdPhone', () => {
  it.each([
    ['01712345678', '+8801712345678'],
    ['+8801712345678', '+8801712345678'],
    ['8801712345678', '+8801712345678'],
    ['01712-345678', '+8801712345678'],
    ['+880 1712 345678', '+8801712345678'],
    ['1712345678', '+8801712345678'],
  ])('normalises %s to %s', (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it.each([
    ['01212345678', 'operator prefix 012 is not issued'],
    ['0171234567', 'too short'],
    ['017123456789', 'too long'],
    ['+919812345678', 'Indian number'],
    ['not a phone', 'garbage'],
  ])('rejects %s (%s)', (input) => {
    expect(() => normalizeBdPhone(input)).toThrow(InvalidPhoneError);
  });

  it('is idempotent', () => {
    const once = normalizeBdPhone('01712345678');
    expect(normalizeBdPhone(once)).toBe(once);
  });
});

describe('maskPhone', () => {
  it('hides the middle digits for logs', () => {
    expect(maskPhone('+8801712345678')).toBe('+88017123***678');
  });
});
