import { z } from 'zod';

/**
 * What a subscription costs and what it is called.
 *
 * Prices live here rather than in a table because they are a product
 * decision, not data someone edits at runtime: a price that can change
 * behind the app's back is a price the app cannot state honestly. A change
 * here ships with a release, and old subscriptions keep the price they were
 * actually sold at, which is stored on the row.
 *
 * In paisa, like every other amount in this system.
 */
export const SUBSCRIPTION_PLANS = {
  MONTHLY: { price: 50_100, days: 30 },
  YEARLY: { price: 500_100, days: 365 },
  LIFETIME: { price: 1_000_100, days: null },
} as const;

export const subscriptionPlanSchema = z.enum(['MONTHLY', 'YEARLY', 'LIFETIME']);
export type SubscriptionPlan = z.infer<typeof subscriptionPlanSchema>;

export const subscriptionStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  plan: subscriptionPlanSchema,
  status: subscriptionStatusSchema,
  price: z.number().int(),
  startedAt: z.string(),
  /** Null on a lifetime plan, which does not end. */
  expiresAt: z.string().nullable(),
  cancelledAt: z.string().nullable(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

/** What the plans screen needs: the offer, and where this account stands. */
export const subscriptionStateSchema = z.object({
  /** The one in force, if any. */
  current: subscriptionSchema.nullable(),
  /** Past purchases, newest first. */
  history: z.array(subscriptionSchema),
  plans: z.array(
    z.object({
      plan: subscriptionPlanSchema,
      price: z.number().int(),
      /** Null for lifetime. */
      days: z.number().int().nullable(),
    }),
  ),
});
export type SubscriptionState = z.infer<typeof subscriptionStateSchema>;

export const subscribeSchema = z.object({
  plan: subscriptionPlanSchema,
  /** One per confirmation, so a double tap buys one subscription. */
  requestId: z.string().uuid(),
});
export type SubscribeDto = z.output<typeof subscribeSchema>;
export type SubscribeInput = z.input<typeof subscribeSchema>;
