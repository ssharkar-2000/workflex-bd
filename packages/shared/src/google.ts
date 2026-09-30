import { z } from 'zod';

/**
 * Where this account stands with Google Meet.
 *
 * Three states, and the screen needs all three. `configured` false means this
 * server has no Google credentials at all, so there is nothing to connect and
 * video interviews use a Jitsi room. `configured` true with `connected` false
 * means the recruiter could connect but has not. Both true means their video
 * interviews get a Meet link on their own calendar.
 */
export const googleStatusSchema = z.object({
  configured: z.boolean(),
  connected: z.boolean(),
  /** The Google account it is linked to, so the person knows which one. */
  email: z.string().nullable(),
});
export type GoogleStatus = z.infer<typeof googleStatusSchema>;

export const googleConnectSchema = z.object({
  /**
   * Where to send the browser once Google has finished — the app's own
   * interviews screen, on the web or as a deep link. Checked against the
   * allowed origins on the server, so it cannot be used to bounce somebody
   * to an arbitrary site.
   */
  returnTo: z.string().trim().min(1).max(500),
});
export type GoogleConnectDto = z.infer<typeof googleConnectSchema>;

export const googleConnectUrlSchema = z.object({
  url: z.string().url(),
});
export type GoogleConnectUrl = z.infer<typeof googleConnectUrlSchema>;

/** True for a Google Meet link, so the app can say which service it opens. */
export function isGoogleMeetUrl(url: string | null | undefined): boolean {
  return Boolean(url && /^https:\/\/meet\.google\.com\//.test(url));
}
