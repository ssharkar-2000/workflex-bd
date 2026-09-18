import { DevOutbox, extractCode } from './dev-outbox';

describe('extractCode', () => {
  it('pulls the code out of the real OTP message', () => {
    const message =
      '483920 is your WorkFlex BD verification code. It expires in 5 minutes. Never share this code with anyone.';
    expect(extractCode(message)).toBe('483920');
  });

  it('ignores numbers that are not six digits', () => {
    expect(extractCode('Your code expires in 5 minutes')).toBeNull();
    expect(extractCode('reference 1234567 for support')).toBeNull();
  });
});

describe('DevOutbox', () => {
  it('returns newest first', () => {
    const outbox = new DevOutbox();
    outbox.record('+8801712345678', '111111 is your code');
    outbox.record('+8801712345679', '222222 is your code');

    expect(outbox.recent.map((r) => r.code)).toEqual(['222222', '111111']);
  });

  it('discards the oldest entries beyond the limit', () => {
    const outbox = new DevOutbox(2);
    outbox.record('+8801712345678', '111111 is your code');
    outbox.record('+8801712345678', '222222 is your code');
    outbox.record('+8801712345678', '333333 is your code');

    expect(outbox.recent.map((r) => r.code)).toEqual(['333333', '222222']);
  });

  it('does not leak a mutable reference to its buffer', () => {
    const outbox = new DevOutbox();
    outbox.record('+8801712345678', '111111 is your code');

    outbox.recent.push({
      phone: 'x',
      message: 'x',
      code: 'x',
      sentAt: 'x',
    });

    expect(outbox.recent).toHaveLength(1);
  });
});
