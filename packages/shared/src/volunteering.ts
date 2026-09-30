import { z } from 'zod';

/**
 * Volunteering and community events, from two places at once.
 *
 * The board shows what this platform already has — postings in the volunteer
 * category, which are real, dated and from a named organiser — and beside
 * them, ideas for what to look for outside it.
 *
 * The ideas carry a **search**, never an event. A model asked for "blood
 * donation camps in Mirpur this week" will invent one, with a date and a
 * street, and somebody will travel across Dhaka to a camp that was never
 * happening. A search runs against Google at the moment it is tapped, so what
 * comes back is whatever is genuinely on.
 */

export const volunteerIdeaSchema = z.object({
  /** What to look for — "Blood donation camp", "Free tutoring for children". */
  title: z.string(),
  /** Who usually runs this kind of thing here, when it is knowable. */
  organisers: z.string(),
  /** One line on why it suits this person, from their own skills. */
  why: z.string(),
  /** A ready-made Google search, scoped to where they are. */
  searchUrl: z.string().url(),
});
export type VolunteerIdea = z.infer<typeof volunteerIdeaSchema>;

export const volunteerIdeasSchema = z.object({
  ideas: z.array(volunteerIdeaSchema),
  /** The area the searches were built around, so the screen can say so. */
  area: z.string(),
  /** "written" means a model chose them; "assembled" means rules did. */
  source: z.enum(['written', 'assembled']),
});
export type VolunteerIdeas = z.infer<typeof volunteerIdeasSchema>;
