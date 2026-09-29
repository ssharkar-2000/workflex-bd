import { create } from 'zustand';

/**
 * Which set of colours the app is currently wearing.
 *
 * `classic` is the indigo and cream the app has always used. `brand` is the
 * terracotta palette, and it applies from the dashboard onwards — the landing
 * animation, the welcome screen, sign-in, registration and the password steps
 * keep the classic one by request.
 *
 * A store rather than a React context, for one reason: the animated page wash
 * behind every screen is mounted once at the root, above the signed-in
 * layout, so a context provided inside that layout could never reach it. The
 * dashboard would have turned terracotta while the page behind it stayed
 * lavender. Global state is what both of them can read.
 *
 * The signed-in layout sets this on mount and puts it back on unmount, so
 * signing out returns the sign-in flow to the colours it had.
 */
export type PaletteSet = 'classic' | 'brand';

interface PaletteSetState {
  set: PaletteSet;
  use: (set: PaletteSet) => void;
}

export const usePaletteSetStore = create<PaletteSetState>((set) => ({
  set: 'classic',
  use: (next) => set({ set: next }),
}));
