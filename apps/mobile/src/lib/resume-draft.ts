import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'workflex.resumeDraft';

export type ResumeTemplate = 'CLASSIC' | 'MODERN' | 'COMPACT';

/**
 * The one colour a CV gets to have.
 *
 * `AUTO` keeps whatever the chosen template leads with, which is what most
 * people want and nobody has to decide. The five named colours are for the
 * person who wants their CV to look like theirs — all dark enough to read as
 * text on white paper and to survive a black-and-white printer, which is
 * what a CV in Bangladesh still meets most days.
 */
export type ResumeAccent = 'AUTO' | 'INK' | 'INDIGO' | 'GREEN' | 'ORANGE' | 'PLUM';

export const ACCENT_COLOURS: Record<Exclude<ResumeAccent, 'AUTO'>, string> = {
  INK: '#1A1A2E',
  INDIGO: '#3A34A0',
  GREEN: '#0F6B4F',
  ORANGE: '#B4430E',
  PLUM: '#6B21A8',
};

export type ResumeEntry = {
  id: string;
  title: string;
  org: string;
  place: string;
  from: string;
  to: string;
  detail: string;
};

export type ResumeDraft = {
  template: ResumeTemplate;
  accent: ResumeAccent;
  fullName: string;
  headline: string;
  /** Years in the work — what the summary writer leans on most. */
  years: string;
  email: string;
  phone: string;
  location: string;
  link: string;
  summary: string;
  experience: ResumeEntry[];
  education: ResumeEntry[];
  certificates: ResumeEntry[];
  /**
   * Work somebody did that was not a job: a stall they ran, a house they
   * wired, a site they built. For a first CV it is often the only section
   * with anything in it.
   */
  projects: ResumeEntry[];
  skills: string[];
  languages: string[];
};

export const EMPTY_DRAFT: ResumeDraft = {
  template: 'CLASSIC',
  accent: 'AUTO',
  fullName: '',
  headline: '',
  years: '',
  email: '',
  phone: '',
  location: '',
  link: '',
  summary: '',
  experience: [],
  education: [],
  certificates: [],
  projects: [],
  skills: [],
  languages: [],
};

export function newEntry(): ResumeEntry {
  return {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    title: '',
    org: '',
    place: '',
    from: '',
    to: '',
    detail: '',
  };
}

/**
 * The CV being written, kept on the phone.
 *
 * A half-finished CV is a draft, not a record: it belongs to the person
 * writing it and nobody else needs to read it, so it stays on the device
 * until they choose to do something with it. That also means no round trip
 * on every keystroke, which is what makes typing in the builder feel
 * immediate.
 *
 * Saves are debounced and failures are swallowed — storage can be full or
 * blocked, and losing a draft is bad but crashing mid-sentence is worse.
 */
export function useResumeDraft() {
  const [draft, setDraft] = useState<ResumeDraft>(EMPTY_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  /**
   * What is on the device right now.
   *
   * Held as the serialized string rather than a flag so "unsaved" survives a
   * re-render and, more usefully, goes back to "saved" when someone types a
   * character and deletes it again.
   */
  const savedJson = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (alive && raw) {
          const stored = { ...EMPTY_DRAFT, ...(JSON.parse(raw) as ResumeDraft) };
          setDraft(stored);
          savedJson.current = JSON.stringify(stored);
          setSavedAt(Date.now());
        }
      } catch {
        // No draft, or storage unavailable: start from an empty one.
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const json = JSON.stringify(draft);
  const dirty = loaded && savedJson.current !== null && savedJson.current !== json;

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      void AsyncStorage.setItem(KEY, json)
        .then(() => {
          savedJson.current = json;
          setSavedAt(Date.now());
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [json, loaded]);

  const update = useCallback((patch: Partial<ResumeDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  /** Wholesale: rebuilding from the profile, or loading the example. */
  const replace = useCallback((next: ResumeDraft) => {
    setDraft({ ...EMPTY_DRAFT, ...next });
  }, []);

  const clear = useCallback(() => {
    setDraft(EMPTY_DRAFT);
    savedJson.current = null;
    setSavedAt(null);
    void AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  return { draft, update, replace, clear, loaded, dirty, savedAt };
}
