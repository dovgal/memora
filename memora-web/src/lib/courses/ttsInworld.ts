// Единая озвучка курсов — ТОЛЬКО через Inworld.ai (бэкенд /api/tts с кэшем).
// Браузерный SpeechSynthesis намеренно НЕ используется (низкое качество).
// /api/tts защищён авторизацией — передаём JWT из next-auth сессии.

import { getSession } from "next-auth/react";

let currentAudio: HTMLAudioElement | null = null;

// Кэшируем токен на минуту, чтобы не дёргать getSession() на каждый клик.
let cachedToken: string | null = null;
let cachedAt = 0;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  if (!cachedToken || now - cachedAt > 60_000) {
    try {
      const session = await getSession();
      cachedToken = (session as { id_token?: string } | null)?.id_token ?? null;
      cachedAt = now;
    } catch {
      cachedToken = null;
    }
  }
  return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {};
}

async function playInworld(text: string, voice: string, waitEnd: boolean, language?: string): Promise<void> {
  const clean = (text || "").trim();
  if (!clean) return;
  try {
    // остановим предыдущее воспроизведение
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    // language задан — голос выбирает предметный пак на бэкенде; иначе явный voice.
    const url = language
      ? `/api/tts?text=${encodeURIComponent(clean)}&language=${encodeURIComponent(language)}`
      : `/api/tts?text=${encodeURIComponent(clean)}&voice=${encodeURIComponent(voice)}`;
    const headers = await getAuthHeaders();
    const res = await fetch(url, { cache: "force-cache", headers });
    if (!res.ok) {
      console.warn("Inworld TTS unavailable:", res.status);
      return; // тихо выходим — браузерный синтез не используем
    }
    const blob = await res.blob();
    if (blob.size === 0) return;
    const audio = new Audio(URL.createObjectURL(blob));
    currentAudio = audio;
    if (waitEnd) {
      // Резолвимся по КОНЦУ воспроизведения (или прерыванию) — нужно голосовому
      // режиму, чтобы включать микрофон только после того, как реплика дозвучала.
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.onpause = () => resolve(); // прервали другой озвучкой — не висим
        audio.play().catch(() => resolve());
      });
    } else {
      await audio.play();
    }
  } catch (e) {
    console.warn("Inworld TTS error:", e);
  }
}

/**
 * Озвучить произвольный текст через Inworld (резолв — на старте воспроизведения).
 * @param text  фраза на изучаемом языке
 * @param voice голос Inworld (по умолчанию Alain — французский)
 */
export async function speakInworld(text: string, voice = "Alain"): Promise<void> {
  return playInworld(text, voice, false);
}

/** То же, но промис резолвится по ОКОНЧАНИИ воспроизведения (для голосового диалога). */
export async function speakInworldAndWait(text: string, voice = "Alain"): Promise<void> {
  return playInworld(text, voice, true);
}

/**
 * Озвучить текст голосом изучаемого языка курса ('fr'/'en'/'de'/'es'…) —
 * конкретный голос выбирает предметный пак на бэкенде.
 */
export async function speakInworldLanguage(text: string, language: string): Promise<void> {
  return playInworld(text, "", false, language || undefined);
}

/** Озвучить карточку лексики из сид-набора (Inworld по UUID карты), с fallback на /api/tts. */
export async function speakCardInworld(cardUuid: string, text: string, voice = "Alain"): Promise<void> {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/audio/${cardUuid}/term_audio`, { cache: "force-cache", headers });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) { const a = new Audio(URL.createObjectURL(blob)); currentAudio = a; await a.play(); return; }
    }
  } catch { /* fallthrough to generic */ }
  await speakInworld(text, voice);
}
