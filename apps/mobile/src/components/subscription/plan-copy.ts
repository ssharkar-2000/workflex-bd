import type { SubscriptionPlan } from '@workflex/shared';

/**
 * What each plan is called and what it gives you.
 *
 * The benefits name features that exist in this app — the CV builder, mock
 * tests, the skill radar, the learning lab — rather than invented marketing
 * lines. A plan that promises "premium support" the product does not have is
 * a refund request three weeks later.
 *
 * The plans themselves stay the system's own MONTHLY / YEARLY / LIFETIME,
 * priced in SUBSCRIPTION_PLANS. They are not renamed here: a screen saying
 * "Pro" while the receipt, the API and the database all say "MONTHLY" makes
 * every support conversation harder.
 */
export type PlanCopy = {
  nameKey: string;
  tagKey: string;
  /** Marked on the card. Only one plan carries it. */
  popular: boolean;
  benefits: string[];
  /** Who it suits, for the detail screen. */
  suitsKey: string;
};

export const FREE_BENEFITS = [
  'sub.b.browse',
  'sub.b.apply',
  'sub.b.basicRecs',
  'sub.b.cvUpload',
];

export const PLAN_COPY: Record<SubscriptionPlan, PlanCopy> = {
  MONTHLY: {
    nameKey: 'sub.plan.MONTHLY',
    tagKey: 'sub.tag.MONTHLY',
    popular: true,
    benefits: [
      'sub.b.everythingFree',
      'sub.b.cvBuilder',
      'sub.b.mockTests',
      'sub.b.skillGap',
      'sub.b.learningPath',
      'sub.b.priorityRecs',
    ],
    suitsKey: 'sub.suits.MONTHLY',
  },
  YEARLY: {
    nameKey: 'sub.plan.YEARLY',
    tagKey: 'sub.tag.YEARLY',
    popular: false,
    benefits: [
      'sub.b.everythingMonthly',
      'sub.b.twoMonthsFree',
      'sub.b.unlimitedTests',
      'sub.b.featuredProfile',
      'sub.b.earlyJobs',
    ],
    suitsKey: 'sub.suits.YEARLY',
  },
  LIFETIME: {
    nameKey: 'sub.plan.LIFETIME',
    tagKey: 'sub.tag.LIFETIME',
    popular: false,
    benefits: [
      'sub.b.everythingYearly',
      'sub.b.never',
      'sub.b.allFuture',
      'sub.b.featuredProfile',
    ],
    suitsKey: 'sub.suits.LIFETIME',
  },
};

/**
 * How a subscription can be paid for.
 *
 * All of these reach the same place: the wallet. WorkFlex BD already takes
 * money through one gateway, and that gateway is what offers bKash, Nagad, a
 * card or a bank transfer. Listing them and then charging the wallet is not
 * a shortcut — it is the only honest arrangement, because the app itself
 * never touches a payment credential and should not appear to.
 *
 * A method is offered only when the gateway is configured. With no gateway
 * the screen says the balance is the only way to pay, rather than showing
 * five buttons that cannot work.
 */
export const PAYMENT_METHODS = [
  { key: 'WALLET', labelKey: 'sub.pay.wallet', needsGateway: false },
  { key: 'BKASH', labelKey: 'sub.pay.bkash', needsGateway: true },
  { key: 'NAGAD', labelKey: 'sub.pay.nagad', needsGateway: true },
  { key: 'CARD', labelKey: 'sub.pay.card', needsGateway: true },
  { key: 'BANK', labelKey: 'sub.pay.bank', needsGateway: true },
] as const;

export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number]['key'];
