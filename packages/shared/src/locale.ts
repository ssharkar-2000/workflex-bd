import { z } from 'zod';

/**
 * Bangla first: it is the majority language of this market, and defaulting to
 * English quietly signals the product was not built for local users.
 */
export const localeSchema = z.enum(['bn', 'en']);
export type Locale = z.infer<typeof localeSchema>;

export const DEFAULT_LOCALE: Locale = 'bn';

export const LOCALE_LABELS: Record<Locale, string> = {
  bn: 'বাংলা',
  en: 'English',
};
