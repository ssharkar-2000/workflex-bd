/**
 * Where a payer may be sent back to after the gateway.
 *
 * The address comes from the app, and the API redirects to it from a page
 * the payer arrived at straight from a payment — the moment they are most
 * inclined to trust whatever loads next. An open redirect there would let a
 * crafted request land them on a lookalike "enter your PIN again" page. So
 * only addresses that are unmistakably this app are accepted:
 *
 *   - workflex://…            the app itself, always;
 *   - APP_WEB_ORIGINS         the web app, as configured;
 *   - outside production only: localhost and LAN addresses (the web app and
 *     a phone on the same Wi-Fi while developing) and Expo Go's exp:// links.
 */
export interface ReturnUrlRules {
  production: boolean;
  /** Exact origins, e.g. "https://app.workflex.com.bd". */
  webOrigins: readonly string[];
}

export function isAllowedReturnUrl(raw: string, rules: ReturnUrlRules): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  // "https://app.example@evil.test" reads as the first and goes to the second.
  if (url.username || url.password) return false;

  if (url.protocol === 'workflex:') return true;

  if (url.protocol === 'http:' || url.protocol === 'https:') {
    if (rules.webOrigins.includes(url.origin)) return true;
    return !rules.production && isLocalAddress(url.hostname);
  }

  if (url.protocol === 'exp:' || url.protocol === 'exps:') {
    return !rules.production;
  }

  return false;
}

/** The loopback and private ranges a development machine is reached on. */
function isLocalAddress(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/** APP_WEB_ORIGINS as a list of origins, ignoring blanks and stray paths. */
export function parseWebOrigins(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      try {
        return [new URL(part).origin];
      } catch {
        return [];
      }
    });
}

/** The return address with the top-up it concerns, for the wallet to look up. */
export function withTopUpParam(returnUrl: string, topUpId: string): string {
  const url = new URL(returnUrl);
  url.searchParams.set('topUp', topUpId);
  return url.toString();
}
