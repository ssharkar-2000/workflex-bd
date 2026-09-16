import { create } from 'zustand';
import * as Linking from 'expo-linking';

interface LaunchState {
  /**
   * Whether the user has passed through the welcome screen this launch.
   *
   * Deliberately in memory only, so it resets on every cold start: the app
   * always opens on the landing page and walks the same sequence, rather than
   * dropping someone into the middle of a half-finished registration with no
   * idea how they got there. A returning user with a live session clears it
   * in one tap.
   */
  gateOpen: boolean;
  open: () => void;
}

export const useLaunchStore = create<LaunchState>((set) => ({
  gateOpen: false,
  open: () => set({ gateOpen: true }),
}));

/**
 * Coming back from the payment gateway — the one entry that skips the landing
 * page.
 *
 * The gateway sends the payer back to /wallet?topUp=…, and often into a cold
 * start: the web app reloading in the tab that went to the payment page, or a
 * phone that closed the app while its browser was open. Walking them through
 * the welcome sequence first would hide the one thing they came back to see —
 * whether the money arrived.
 *
 * Only the gate opens. The wallet still needs a signed-in session, which the
 * routing in app/_layout.tsx enforces as it does everywhere else. Awaited
 * before the session is restored, so the routing never runs with the gate
 * still shut and sends them to the landing page first.
 */
export async function openGateForPaymentReturn(): Promise<void> {
  const url = await Linking.getInitialURL().catch(() => null);
  if (!url) return;

  // "workflex://wallet" puts the route in the host; "http://…/wallet" and
  // Expo Go's "exp://…/--/wallet" put it in the path.
  const { hostname, path, queryParams } = Linking.parse(url);
  const route = (path || hostname || '').replace(/^\/+|\/+$/g, '');

  if (route === 'wallet' && typeof queryParams?.topUp === 'string') {
    useLaunchStore.getState().open();
  }
}
