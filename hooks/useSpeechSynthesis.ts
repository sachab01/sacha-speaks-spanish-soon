"use client";

import { useCallback, useEffect, useRef } from "react";

export type SpeechLang = "en-US" | "es-MX";

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

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;

    const langPrefix = lang.slice(0, 2);
    const voice =
      voicesRef.current.find((v) => v.lang === lang) ?? voicesRef.current.find((v) => v.lang.startsWith(langPrefix));
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  }, []);

  return { speak };
}
