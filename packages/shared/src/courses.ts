import { z } from 'zod';

/**
 * Free courses for the gaps in somebody's CV, and what they did about them.
 *
 * The skill-gap card says what is missing and proves it with live postings.
 * This is the next question — "where do I go and learn that?" — and it is a
 * harder one to answer honestly, for two reasons.
 *
 * Nothing here can confirm a course is still free, still running, or any
 * good. So a suggestion carries a title, who runs it and why it was picked,
 * and it links to a **search** rather than to a URL: a model asked for links
 * invents them, and a dead link is worse than no link. The search always
 * leads to whatever is actually on offer today.
 *
 * And nothing here verifies that anyone finished anything. A completion is
 * the person's own word, with a certificate attached when the course issued
 * one. The screens say so rather than dressing a self-declared claim up as a
 * qualification.
 */

export const courseSuggestionSchema = z.object({
  /** What to search for — a course name, not a subject. */
  title: z.string(),
  /** Who runs it: "Google Digital Garage", "YouTube", "freeCodeCamp". */
  provider: z.string(),
  /** The gap from the skill path this serves. */
  skill: z.string(),
  /** One line tying it to the demand that justified suggesting it. */
  why: z.string(),
  /** Rough length in minutes, when it is knowable. Null rather than guessed. */
  minutes: z.number().int().positive().nullable(),
  /** A ready-made Google search for the course. */
  searchUrl: z.string().url(),
});
export type CourseSuggestion = z.infer<typeof courseSuggestionSchema>;

export const courseSuggestionsSchema = z.object({
  courses: z.array(courseSuggestionSchema),
  /**
   * How they were chosen. "written" means a model picked them from the CV and
   * the gaps; "assembled" means the model is off and these are searches built
   * from the gaps themselves. The screen says which, as the CV writer does.
   */
  source: z.enum(['written', 'assembled']),
  /** The gaps these answer, so the section can explain itself. */
  forSkills: z.array(z.string()),
});
export type CourseSuggestions = z.infer<typeof courseSuggestionsSchema>;

/** What the person says they finished, and the paper for it if there is any. */
export const courseCompletionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  provider: z.string(),
  url: z.string().nullable(),
  skill: z.string(),
  declaredAt: z.string(),
  /**
   * Present once a certificate has been uploaded. The file itself is served
   * from an authenticated endpoint, never a public URL.
   */
  certificate: z
    .object({
      name: z.string().nullable(),
      mimeType: z.string(),
      sizeBytes: z.number().int().nonnegative(),
    })
    .nullable(),
});
export type CourseCompletion = z.infer<typeof courseCompletionSchema>;

export const courseCompletionsSchema = z.object({
  completions: z.array(courseCompletionSchema),
});
export type CourseCompletions = z.infer<typeof courseCompletionsSchema>;

/** "I finished this one." */
export const declareCourseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  provider: z.string().trim().min(1).max(120),
  url: z.string().trim().max(500).optional().or(z.literal('')),
  skill: z.string().trim().min(1).max(80),
});
export type DeclareCourseDto = z.output<typeof declareCourseSchema>;
export type DeclareCourseInput = z.input<typeof declareCourseSchema>;
