import { z } from 'zod';

/**
 * The note that goes with an application, written from what the account
 * already holds.
 *
 * Applying here sends a name and a CV and, optionally, a short message. Most
 * people send nothing, because writing one means opening a keyboard on a
 * phone and finding something to say about yourself — and an application with
 * nothing on it is the one an employer skips.
 *
 * This writes that note from the CV and the profile: the work they have
 * actually done on this platform, the skills read from their CV, where they
 * live. It invents no experience, and the person sends it themselves.
 */
export const applyDraftSchema = z.object({
  /** Ready to send, under the 500 characters the application allows. */
  message: z.string(),
  /**
   * The facts it was built from, in the person's own record. Shown under the
   * note so somebody can see why it says what it says — and notice when it
   * has nothing to work with.
   */
  from: z.array(z.string()),
  /** "written" means a model phrased it; "assembled" means a template did. */
  source: z.enum(['written', 'assembled']),
  /** False when the account has no CV, which is worth saying out loud. */
  usedCv: z.boolean(),
});
export type ApplyDraft = z.infer<typeof applyDraftSchema>;
