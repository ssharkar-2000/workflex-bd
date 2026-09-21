import { formatTaka, type TopUpStatus } from '@workflex/shared';
import type { SimulatorOutcome } from './gateway/simulator.gateway';

/**
 * The few pages the API serves itself: the development payment simulator,
 * and the page a phone lands on after paying, which hands it back to the app.
 *
 * No scripts anywhere. The policy below forbids them, allows inline styles,
 * and lets forms post onwards — the simulator's forms post to the payment
 * callbacks, which then redirect to the web app on another origin, and
 * browsers apply form-action to that redirect as well.
 */
export const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action *; base-uri 'none'; frame-ancestors 'none'";

function escape(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
  );
}

const STYLE = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #FAF8F5; color: #1A1A2E;
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 440px; margin: 0 auto; padding: 32px 20px; }
  h1 { font-size: 24px; margin: 8px 0 4px; }
  p { margin: 8px 0; }
  .muted { color: #585873; font-size: 14px; }
  .flag { display: inline-block; background: #FDF1DC; color: #95610A;
    border: 1px solid #F0D5A4; border-radius: 999px; padding: 3px 10px;
    font-size: 12px; font-weight: 700; }
  .amount { font-size: 40px; font-weight: 800; margin: 16px 0 4px; }
  form { margin: 10px 0 0; }
  button, .button { display: block; width: 100%; padding: 14px; border-radius: 12px;
    border: 1px solid #3A34A0; background: #3A34A0; color: #FFFFFF;
    font: inherit; font-weight: 700; text-align: center; text-decoration: none;
    cursor: pointer; }
  button.secondary { background: #FFFFFF; color: #3A34A0; }
  button.quiet { background: transparent; border-color: #E6E1DA; color: #585873; }
  .bn { color: #585873; }
`;

function page(title: string, body: string, head = ''): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
${head}
<style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`;
}

const OUTCOME_BUTTONS: { outcome: SimulatorOutcome; label: string; tone: string }[] = [
  { outcome: 'bkash', label: 'Pay with bKash', tone: '' },
  { outcome: 'nagad', label: 'Pay with Nagad', tone: '' },
  { outcome: 'card', label: 'Pay by card', tone: '' },
  {
    outcome: 'risky',
    label: 'Pay, but have the gateway flag it as risky',
    tone: 'secondary',
  },
  { outcome: 'fail', label: 'Payment fails', tone: 'secondary' },
  { outcome: 'cancel', label: 'Cancel', tone: 'quiet' },
];

/** The simulated gateway page. `actionBase` is this page's own URL. */
export function simulatorPage(tranId: string, amount: number, actionBase: string): string {
  const buttons = OUTCOME_BUTTONS.map(
    ({ outcome, label, tone }) => `
    <form method="post" action="${escape(`${actionBase}/${outcome}`)}">
      <button type="submit" class="${tone}">${escape(label)}</button>
    </form>`,
  ).join('');

  return page(
    'Payment simulator',
    `<span class="flag">Development only — no real money moves</span>
    <h1>Payment simulator</h1>
    <p class="muted">Standing in for SSLCommerz while the API runs with
      PAYMENT_PROVIDER=simulator. Choose what the payer does.</p>
    <div class="amount">${escape(formatTaka(amount))}</div>
    <p class="muted">Reference ${escape(tranId)}</p>
    ${buttons}`,
  );
}

/**
 * What the gateway shows before sending the payer back: the fields it would
 * post, in a form, one button press from the merchant.
 */
export function simulatorContinuePage(
  paid: boolean,
  outcome: SimulatorOutcome,
  action: string,
  fields: Record<string, string>,
): string {
  const heading = paid
    ? 'Payment made'
    : outcome === 'fail'
      ? 'Payment failed'
      : 'Payment cancelled';
  const inputs = Object.entries(fields)
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`,
    )
    .join('');

  return page(
    heading,
    `<span class="flag">Development only — no real money moves</span>
    <h1>${escape(heading)}</h1>
    <p class="muted">The gateway now sends you back to WorkFlex BD with the
      result, exactly as SSLCommerz would.</p>
    <form method="post" action="${escape(action)}">
      ${inputs}
      <button type="submit">Return to WorkFlex BD</button>
    </form>`,
  );
}

/** Headline for each outcome, in both languages — the payer's own may be either. */
const RESULT_COPY: Record<'paid' | 'held' | 'unpaid' | 'pending', { en: string; bn: string; title: string }> = {
  paid: {
    title: 'Payment received',
    en: 'The money is in your wallet.',
    bn: 'টাকা আপনার ওয়ালেটে জমা হয়েছে।',
  },
  held: {
    title: 'Payment received',
    en: 'Our team is checking it before it reaches your wallet.',
    bn: 'ওয়ালেটে জমা হওয়ার আগে আমাদের টিম এটি যাচাই করছে।',
  },
  pending: {
    title: 'Checking your payment',
    en: 'Open the app to see when it arrives.',
    bn: 'টাকা কখন জমা হলো তা দেখতে অ্যাপটি খুলুন।',
  },
  unpaid: {
    title: 'Payment not completed',
    en: 'No money was taken for this top-up.',
    bn: 'এই টপ-আপের জন্য কোনো টাকা কাটা হয়নি।',
  },
};

function resultKind(status: TopUpStatus): keyof typeof RESULT_COPY {
  if (status === 'PAID') return 'paid';
  if (status === 'HELD') return 'held';
  if (status === 'PENDING') return 'pending';
  return 'unpaid';
}

/**
 * The page a phone lands on after paying, with the app's own link.
 *
 * A redirect straight to workflex:// from the payment callback is at the
 * mercy of the browser — some refuse to open an app without a fresh tap — so
 * this page tries once by itself and keeps a button for the tap.
 */
export function returnPage(target: string, status: TopUpStatus, amount: number): string {
  const copy = RESULT_COPY[resultKind(status)];
  return page(
    copy.title,
    `<div class="amount">${escape(formatTaka(amount))}</div>
    <h1>${escape(copy.title)}</h1>
    <p>${escape(copy.en)}</p>
    <p class="bn" lang="bn">${escape(copy.bn)}</p>
    <p><a class="button" href="${escape(target)}">Open WorkFlex BD · অ্যাপে ফিরুন</a></p>`,
    `<meta http-equiv="refresh" content="0;url=${escape(target)}">`,
  );
}

/** A callback naming a transaction this API never started. */
export function noMatchPage(reference: string | null): string {
  return page(
    'Payment not recognised',
    `<h1>Payment not recognised</h1>
    <p>This payment does not match any top-up we started. If money left your
      account, contact WorkFlex BD support${reference ? ` and quote ${escape(reference)}` : ''}.</p>
    <p class="bn" lang="bn">এই পেমেন্টটি আমাদের কোনো টপ-আপের সাথে মিলছে না। আপনার অ্যাকাউন্ট থেকে টাকা কাটা হলে সাপোর্টে যোগাযোগ করুন।</p>`,
  );
}
