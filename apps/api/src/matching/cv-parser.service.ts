import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
// zod/v4, not the package root: @anthropic-ai/sdk's zodOutputFormat is typed
// against zod v4, and the rest of this repo is still on the v3 API. Zod 3.25
// ships both, so the two coexist as long as the schema handed to the SDK is
// built with the v4 entry point. Only this file needs it.
import * as z from 'zod/v4';
import { JOB_CATEGORIES } from '@workflex/shared';
import type { Env } from '../config/env.schema';

/**
 * What the model is asked to return. Kept separate from the shared
 * `cvProfileSchema` because that one carries `parsedAt`, which is ours to set
 * rather than the model's to invent.
 */
const CATEGORY_KEYS = JOB_CATEGORIES.map((c) => c.key) as [string, ...string[]];

const extractionSchema = z.object({
  skills: z
    .array(z.string())
    .describe(
      'Concrete, checkable skills — tools, trades, languages, certifications. ' +
        'Not personality traits like "hard working".',
    ),
  yearsExperience: z
    .number()
    .int()
    .min(0)
    .max(60)
    .nullable()
    .describe('Total years of paid work evidenced. Null if not derivable.'),
  categories: z
    .array(z.enum(CATEGORY_KEYS))
    .describe('Job categories this person could plausibly be hired into.'),
  titles: z.array(z.string()).describe('Job titles actually held.'),
  summary: z
    .string()
    .nullable()
    .describe('One or two plain sentences describing this person as a worker.'),
});

export type CvExtraction = z.infer<typeof extractionSchema>;

const CATEGORY_LIST = JOB_CATEGORIES.map(
  (c) => `${c.key} (${c.en}) e.g. ${c.roles.slice(0, 3).join(', ')}`,
).join('\n');

const SYSTEM = `You read CVs for WorkFlex BD, a Bangladeshi work marketplace that
carries everything from a three-hour cleaning shift to a permanent software role.

Extract only what the CV actually evidences. Do not infer skills from an
aspirational objective statement, and do not pad the list to look thorough — a
short accurate list matches better than a long speculative one.

CVs here are often in Bangla, English, or a mix of both. Return skills and
titles in English so they can be matched against job postings, but read either
language. Many applicants have no formal CV structure at all; a handwritten
list of past work is normal and still worth extracting.

Map the person onto these categories, using the exact keys:
${CATEGORY_LIST}

If the CV is unreadable or contains no work information, return empty arrays
and a null summary rather than guessing.`;

/**
 * Turns CV text into a structured profile.
 *
 * This is the only part of matching that uses a model, and it runs once per
 * upload. The input is free-form prose in two languages with no consistent
 * layout, which is precisely the job a language model is better at than a
 * parser — and precisely the job that scoring against a hundred and fifty
 * postings is *not*.
 */
@Injectable()
export class CvParserService {
  private readonly logger = new Logger(CvParserService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const enabled = this.config.get('CV_PARSER', { infer: true }) === 'claude';
    const apiKey = this.config.get('ANTHROPIC_API_KEY', { infer: true });
    this.model = this.config.get('CV_PARSER_MODEL', { infer: true });

    // Env validation already refuses to boot with CV_PARSER=claude and no key,
    // so reaching here without one means the parser is deliberately off.
    this.client = enabled && apiKey ? new Anthropic({ apiKey }) : null;
    if (!this.client) {
      this.logger.warn('CV parsing is off — uploads will store but not parse');
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Returns null when parsing is off or the model could not produce a valid
   * profile. Callers treat that as "no match data", never as an empty profile
   * — an empty profile would score every job as a poor fit.
   */
  async parse(text: string): Promise<CvExtraction | null> {
    if (!this.client) return null;

    const trimmed = text.trim();
    if (trimmed.length < 40) {
      this.logger.warn('CV text too short to parse');
      return null;
    }

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 8000,
        // The hard part is judgement about what counts as evidence, not
        // volume — adaptive thinking at low effort keeps that judgement
        // without spending on a task that is ultimately extraction.
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'low',
          format: zodOutputFormat(extractionSchema),
        },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Extract the work profile from this CV.\n\n<cv>\n${trimmed.slice(0, 60_000)}\n</cv>`,
          },
        ],
      });

      // A safety decline returns 200 with no usable content; guard before use.
      if (response.stop_reason === 'refusal') {
        this.logger.warn(
          `CV extraction declined: ${response.stop_details?.category ?? 'unknown'}`,
        );
        return null;
      }

      const parsed = response.parsed_output;
      if (!parsed) {
        this.logger.warn('CV extraction returned no parsable output');
        return null;
      }

      return {
        ...parsed,
        // Normalised here rather than trusting the model to be consistent —
        // the matcher intersects these directly and casing would silently
        // halve the hit rate.
        skills: dedupe(parsed.skills.map((s) => s.trim().toLowerCase())),
        titles: dedupe(parsed.titles.map((t) => t.trim())),
      };
    } catch (err) {
      // A failed parse must not fail the upload — the CV is stored either way
      // and can be re-parsed later.
      this.logger.error(
        `CV extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter((v) => v.length > 0))];
}
