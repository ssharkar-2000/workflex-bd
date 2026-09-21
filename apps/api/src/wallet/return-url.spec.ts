import { isAllowedReturnUrl, parseWebOrigins, withTopUpParam } from './return-url';

const dev = { production: false, webOrigins: [] };
const prod = { production: true, webOrigins: ['https://app.workflex.com.bd'] };

describe('isAllowedReturnUrl', () => {
  it('always accepts the app scheme', () => {
    expect(isAllowedReturnUrl('workflex://wallet', dev)).toBe(true);
    expect(isAllowedReturnUrl('workflex://wallet', prod)).toBe(true);
  });

  it('accepts local and LAN addresses only outside production', () => {
    for (const url of [
      'http://localhost:8081/wallet',
      'http://127.0.0.1:8081/wallet',
      'http://192.168.0.14:8081/wallet',
      'http://10.0.2.2:8081/wallet',
      'http://172.20.1.5:8081/wallet',
    ]) {
      expect(isAllowedReturnUrl(url, dev)).toBe(true);
      expect(isAllowedReturnUrl(url, prod)).toBe(false);
    }
  });

  it('accepts Expo Go links only outside production', () => {
    const url = 'exp://192.168.0.14:8081/--/wallet';
    expect(isAllowedReturnUrl(url, dev)).toBe(true);
    expect(isAllowedReturnUrl(url, prod)).toBe(false);
  });

  it('accepts configured web origins, and nothing that merely resembles them', () => {
    expect(isAllowedReturnUrl('https://app.workflex.com.bd/wallet', prod)).toBe(true);
    expect(isAllowedReturnUrl('https://app.workflex.com.bd.evil.test/wallet', prod)).toBe(false);
    expect(isAllowedReturnUrl('http://app.workflex.com.bd/wallet', prod)).toBe(false);
  });

  it('refuses credentials in the address, other schemes and garbage', () => {
    expect(isAllowedReturnUrl('https://app.workflex.com.bd@evil.test/', prod)).toBe(false);
    expect(isAllowedReturnUrl('http://user:pw@localhost:8081/', dev)).toBe(false);
    expect(isAllowedReturnUrl('javascript:alert(1)', dev)).toBe(false);
    expect(isAllowedReturnUrl('https://evil.test/wallet', dev)).toBe(false);
    expect(isAllowedReturnUrl('not a url', dev)).toBe(false);
  });
});

describe('parseWebOrigins', () => {
  it('keeps origins and drops blanks, paths and junk', () => {
    expect(
      parseWebOrigins(' https://app.workflex.com.bd/wallet , ,nonsense, http://localhost:8081'),
    ).toEqual(['https://app.workflex.com.bd', 'http://localhost:8081']);
  });
});

describe('withTopUpParam', () => {
  it('adds the top-up id to web and app links alike', () => {
    expect(withTopUpParam('http://localhost:8081/wallet', 'abc')).toBe(
      'http://localhost:8081/wallet?topUp=abc',
    );
    expect(withTopUpParam('workflex://wallet', 'abc')).toBe('workflex://wallet?topUp=abc');
    expect(withTopUpParam('exp://192.168.0.14:8081/--/wallet?x=1', 'abc')).toBe(
      'exp://192.168.0.14:8081/--/wallet?x=1&topUp=abc',
    );
  });
});
