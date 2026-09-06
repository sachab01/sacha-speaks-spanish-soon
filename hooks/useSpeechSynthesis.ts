"use client";

import { useCallback, useEffect, useRef } from "react";

export type SpeechLang = "en-US" | "es-MX";

/**
 * Apple (and some other platforms) ship "novelty"/character voices (Albert,
 * Junior, Zarvox, Grandma, etc.) tagged with ordinary language codes like
 * "en-US" — the same as real speaking voices — so naively picking the first
 * voice that matches a language can land on a high-pitched or robotic joke
 * voice instead. Prefer known-good voices by name when installed; only fall
 * back to "first voice matching the language" if none of these are available.
 */
const PREFERRED_VOICE_NAMES: Partial<Record<SpeechLang, string[]>> = {
  "en-US": ["Google US English", "Samantha"],
};

/** Wraps window.speechSynthesis, picking a matching voice for the requested language. */
export function useSpeechSynthesis() {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    function loadVoices() {
      voicesRef.current = window.speechSynthesis.getVoices();
    }
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const speak = useCallback((text: string, lang: SpeechLang) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;

    // Agent-generated text sometimes carries markdown emphasis (**bold**,
    // *italic*, `code`) — strip the markers so the TTS engine doesn't read
    // them aloud as literal "asterisk asterisk".
    const spokenText = text.replace(/[*_`]/g, "");
    if (!spokenText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = lang;

    const langPrefix = lang.slice(0, 2);
    const preferredNames = PREFERRED_VOICE_NAMES[lang] ?? [];
    const voice =
      preferredNames.map((name) => voicesRef.current.find((v) => v.name === name)).find((v) => v !== undefined) ??
      voicesRef.current.find((v) => v.lang === lang) ??
      voicesRef.current.find((v) => v.lang.startsWith(langPrefix));
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
}
