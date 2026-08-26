import { PasswordService } from '../users/password.service';
import { passwordResetConfirmSchema } from '@workflex/shared';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('verifies a password it hashed', async () => {
    const hash = await service.hash('Workflex@2026');
    await expect(service.verify('Workflex@2026', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('Workflex@2026');
    await expect(service.verify('Workflex@2027', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time', async () => {
    const [a, b] = await Promise.all([
      service.hash('Workflex@2026'),
      service.hash('Workflex@2026'),
    ]);
    expect(a).not.toBe(b);
  });

  it('returns false rather than throwing on a malformed stored value', async () => {
    await expect(service.verify('anything', 'not-a-hash')).resolves.toBe(false);
    await expect(service.verify('anything', '')).resolves.toBe(false);
  });
});

describe('passwordResetConfirmSchema', () => {
  const base = {
    phone: '+8801712345678',
    code: '123456',
    password: 'Workflex@2026',
    confirmPassword: 'Workflex@2026',
  };

  it('accepts a valid reset', () => {
    expect(passwordResetConfirmSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a mismatched confirmation', () => {
    const result = passwordResetConfirmSchema.safeParse({
      ...base,
      confirmPassword: 'Different@2026',
    });
    expect(result.success).toBe(false);
  });

  it('applies the same strength rules as registration', () => {
    const result = passwordResetConfirmSchema.safeParse({
      ...base,
      password: 'weakpass',
      confirmPassword: 'weakpass',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a code that is not six digits', () => {
    expect(
      passwordResetConfirmSchema.safeParse({ ...base, code: '12345' }).success,
    ).toBe(false);
  });
});
