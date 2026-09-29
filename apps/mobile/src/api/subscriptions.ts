import {
  subscriptionSchema,
  subscriptionStateSchema,
  type Subscription,
  type SubscribeInput,
  type SubscriptionState,
} from '@workflex/shared';
import { api } from './client';

/** The plans on offer, and where this account stands. */
export async function fetchSubscriptions(): Promise<SubscriptionState> {
  const { data } = await api.get('/subscriptions/me');
  return subscriptionStateSchema.parse(data);
}

/** Buy a plan, paid from the wallet balance. */
export async function subscribe(input: SubscribeInput): Promise<Subscription> {
  const { data } = await api.post('/subscriptions', input);
  return subscriptionSchema.parse(data);
}

/** Stop a plan renewing. What was paid for runs to its end date. */
export async function cancelSubscription(id: string): Promise<Subscription> {
  const { data } = await api.post(`/subscriptions/${id}/cancel`);
  return subscriptionSchema.parse(data);
}
