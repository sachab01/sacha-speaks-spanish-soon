"use client";

import { useCallback } from "react";

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
  // Paulina is macOS's standard, natural-sounding Mexican Spanish voice —
  // preferred first. It was intermittently broken on one real machine earlier
  // (correctly tagged es-MX, actually played Dutch — a local voice-pack issue,
  // not a code bug, since a raw utterance bypassing this hook reproduced it
  // too) but later started working correctly again there without any code
  // change, likely once a pending voice download finished. Reed (one of
  // Apple's "character" voices) is the confirmed-reliable fallback if Paulina
  // ever misbehaves again.
  "es-MX": ["Paulina", "Reed", "Google español de Estados Unidos", "Google español"],
};

type SpeakHandlers = {
  /** Fires as each word is reached — charIndex is into the (markdown-stripped) spoken text actually passed to the engine. */
  onBoundary?: (charIndex: number) => void;
  onEnd?: () => void;
};

function pickVoice(voices: SpeechSynthesisVoice[], lang: SpeechLang): SpeechSynthesisVoice | undefined {
  const langPrefix = lang.slice(0, 2);
  const preferredNames = PREFERRED_VOICE_NAMES[lang] ?? [];

  // Check each preferred name fully (exact match, or prefix match for
  // platforms that localize the display name with a suffix, e.g.
  // "Reed (Spaans (Mexico))" on a Dutch-locale OS) before moving to the next
  // name — otherwise a lower-priority name that happens to match exactly
  // (no suffix) can win over a higher-priority one that only matches via
  // prefix, which is the wrong order. The lang check keeps a prefix match
  // from grabbing the wrong country's variant of a shared base name (e.g.
  // "Reed" also exists tagged es-ES).
  for (const name of preferredNames) {
    const match = voices.find((v) => v.lang === lang && (v.name === name || v.name.startsWith(name)));
    if (match) return match;
  }

  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith(langPrefix));
}

function speakNow(spokenText: string, lang: SpeechLang, handlers: SpeakHandlers | undefined) {
  const utterance = new SpeechSynthesisUtterance(spokenText);
  utterance.lang = lang;

  const voice = pickVoice(window.speechSynthesis.getVoices(), lang);
  if (voice) utterance.voice = voice;
  console.log(`[speech] "${spokenText.slice(0, 40)}${spokenText.length > 40 ? "…" : ""}" → voice:`, voice ? `${voice.name} (${voice.lang})` : "none matched — using browser default");

  if (handlers?.onBoundary) {
    utterance.onboundary = (event) => handlers.onBoundary?.(event.charIndex);
  }
  if (handlers?.onEnd) {
    utterance.onend = () => handlers.onEnd?.();
  }

  window.speechSynthesis.speak(utterance);
}

/** Wraps window.speechSynthesis, picking a matching voice for the requested language. */
export function useSpeechSynthesis() {
  const speak = useCallback((text: string, lang: SpeechLang, handlers?: SpeakHandlers) => {
    if (typeof window === "undefined" || !window.speechSynthesis || !text) return;

    // Agent-generated text sometimes carries markdown emphasis (**bold**,
    // *italic*, `code`) — strip the markers so the TTS engine doesn't read
    // them aloud as literal "asterisk asterisk".
    const spokenText = text.replace(/[*_`]/g, "");
    if (!spokenText) return;

    window.speechSynthesis.cancel();

    // getVoices() can return [] on the very first call after a page load —
    // the browser loads the voice list asynchronously and only fires
    // "voiceschanged" once it's ready. Speaking immediately in that window
    // (most likely right on mount, e.g. Listening's auto-play) leaves the
    // utterance's voice unset, and the engine can silently fall back to the
    // OS's default UI-language voice instead of the requested language. Wait
    // for that one event before speaking if the list isn't ready yet.
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        speakNow(spokenText, lang, handlers);
      };
    } else {
      speakNow(spokenText, lang, handlers);
    }
  }, []);

  /** Pauses mid-utterance; resume() continues from the same point (native browser behavior). */
  const pause = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.pause();
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.resume();
  }, []);

  return { speak, pause, resume };
}
