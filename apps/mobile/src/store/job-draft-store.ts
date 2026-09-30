import { create } from 'zustand';
import type { JobDraft } from '@workflex/shared';

/**
 * A drafted posting, waiting for the form to pick it up.
 *
 * In memory and one-shot: the assistant writes a draft, the posting form
 * reads it once on mount and clears it. Deliberately not persisted — a draft
 * still sitting here next week would quietly overwrite a form somebody had
 * already started filling in by hand.
 *
 * Passed this way rather than through route params because a posting is
 * twenty fields, and twenty fields in a URL is a URL nobody can debug.
 */
interface JobDraftState {
  draft: JobDraft | null;
  hand: (draft: JobDraft) => void;
  take: () => JobDraft | null;
}

export const useJobDraftStore = create<JobDraftState>((set, get) => ({
  draft: null,
  hand: (draft) => set({ draft }),
  take: () => {
    const { draft } = get();
    if (draft) set({ draft: null });
    return draft;
  },
}));
