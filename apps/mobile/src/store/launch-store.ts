import { create } from 'zustand';

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
