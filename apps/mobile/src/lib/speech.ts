import { useCallback, useEffect, useState } from 'react';
import * as Speech from 'expo-speech';
import type { Locale } from '@workflex/shared';
import { useLocale } from '../i18n';

/**
 * Reading content aloud.
 *
 * The audience includes people who find a screen of text slow going, so the
 * app should be able to say a notice out loud rather than only display it.
 *
 * The hard part is not speaking — it is knowing whether the device *can*
 * speak Bangla. `Speech.speak` accepts any language tag and, if no matching
 * voice is installed, silently reads the text with whatever engine it does
 * have. Bengali script through an English voice is not wrong-sounding, it is
 * unintelligible noise. So availability is checked up front and the control
 * is hidden when the answer is no, rather than offering a button that
 * produces gibberish.
 */

/**
 * Bangla ships under several tags depending on the engine — `bn-BD` on some
 * Google TTS builds, `bn-IN` on others, bare `bn` on a few. Matching the
 * prefix covers all of them; matching the exact tag would miss most devices.
 */
const LANGUAGE_PREFIX: Record<Locale, string> = { bn: 'bn', en: 'en' };

/** What we ask the engine for when we have no specific voice id to use. */
const SPOKEN_TAG: Record<Locale, string> = { bn: 'bn-BD', en: 'en-US' };

interface VoiceSupport {
  /** Undefined until the device has been asked. */
  available?: boolean;
  /** A concrete voice id, when one was found for the locale. */
  voice?: string;
}

/**
 * Cached per locale for the app's lifetime. Enumerating voices costs a bridge
 * call and the answer only changes if the user installs a TTS engine, which
 * they cannot do without leaving the app.
 */
const cache = new Map<Locale, VoiceSupport>();

async function resolveVoice(locale: Locale): Promise<VoiceSupport> {
  const cached = cache.get(locale);
  if (cached) return cached;

  let support: VoiceSupport;
  try {
    let voices = await Speech.getAvailableVoicesAsync();

    // Browsers fill this list asynchronously and hand back an empty array on
    // the first read, which would look identical to "this device has no
    // voices at all" and wrongly pass the check below. One retry settles it.
    if (voices.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      voices = await Speech.getAvailableVoicesAsync();
    }

    const prefix = LANGUAGE_PREFIX[locale];
    const match = voices.find(
      (v) => v.language?.toLowerCase().startsWith(prefix) ?? false,
    );

    support = match
      ? { available: true, voice: match.identifier }
      : // Still empty after the retry means the platform does not enumerate
        // voices rather than that it cannot speak. Assume it works and let
        // the language tag decide; a populated list with no match is a real
        // "no voice for this language".
        { available: voices.length === 0 };
  } catch {
    support = { available: false };
  }

  cache.set(locale, support);
  return support;
}

/**
 * Speak-aloud control for a screen.
 *
 * One utterance at a time across the whole app: `Speech.speak` queues by
 * default, so tapping three notices in a row would read all three back to
 * back with no way to skip. Starting a new one stops whatever is running.
 */
export function useSpeech() {
  const [locale] = useLocale();
  const [support, setSupport] = useState<VoiceSupport>({});
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void resolveVoice(locale).then((s) => {
      if (active) setSupport(s);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  // Nothing should keep talking after the screen is gone.
  useEffect(() => {
    return () => {
      void Speech.stop();
    };
  }, []);

  const stop = useCallback(() => {
    void Speech.stop();
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id: string, text: string) => {
      if (speakingId === id) {
        stop();
        return;
      }

      void Speech.stop();
      setSpeakingId(id);

      Speech.speak(text, {
        language: SPOKEN_TAG[locale],
        voice: support.voice,
        // Slightly under normal. The default clip is brisk for a second
        // language and for anyone who is listening because reading is hard.
        rate: 0.92,
        onDone: () => setSpeakingId((current) => (current === id ? null : current)),
        onStopped: () =>
          setSpeakingId((current) => (current === id ? null : current)),
        onError: () =>
          setSpeakingId((current) => (current === id ? null : current)),
      });
    },
    [locale, speakingId, stop, support.voice],
  );

  return {
    speak,
    stop,
    /** Which utterance is playing, so a row can show its own state. */
    speakingId,
    /** False once the device has been asked and has no voice for this locale. */
    supported: support.available !== false,
  };
}
