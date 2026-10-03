describe('Login Testing', () => {
  test('Valid login should pass', () => {
    const email = 'user@example.com';
    const password = '123456';
    const correctEmail = 'user@example.com';
    const correctPassword = '123456';
    expect(email).toBe(correctEmail);
    expect(password).toBe(correctPassword);
  });

  test('Invalid login should be rejected', () => {
    const email = 'user@example.com';
    const password = 'wrong123';
    const correctPassword = '123456';
    expect(password).not.toBe(correctPassword);
  });
});
