// Единая озвучка курсов — ТОЛЬКО через Inworld.ai (бэкенд /api/tts с кэшем).
// Браузерный SpeechSynthesis намеренно НЕ используется (низкое качество).
// /api/tts защищён авторизацией — передаём JWT из next-auth сессии.

import { getSession } from "next-auth/react";

let currentAudio: HTMLAudioElement | null = null;
// Номер текущей последовательности озвучки: любая новая озвучка увеличивает
// счётчик, и запущенная ранее многочастная читка прекращается на следующем куске.
let speakSeq = 0;

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
  speakSeq++; // прерываем многочастную читку, если она шла
  return playInworld(text, voice, false);
}

/** То же, но промис резолвится по ОКОНЧАНИИ воспроизведения (для голосового диалога). */
export async function speakInworldAndWait(text: string, voice = "Alain"): Promise<void> {
  return playInworld(text, voice, true);
}

// Бэкенд /api/tts отклоняет текст длиннее 600 символов ("Text too long"), поэтому
// длинные тексты (история, статья) режем на куски по границам предложений.
const TTS_CHUNK_LIMIT = 480;

/** Режет текст на куски ≤ limit символов по границам предложений (запасной вариант — по словам). */
export function splitForTts(text: string, limit = TTS_CHUNK_LIMIT): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= limit) return [clean];

  // Куски-предложения (точка/!/?/…/: с последующим пробелом), затем добираем до лимита.
  const sentences = clean.match(/[^.!?…]+[.!?…]*\s*/g) ?? [clean];
  const chunks: string[] = [];
  let buf = "";
  const push = () => { const t = buf.trim(); if (t) chunks.push(t); buf = ""; };

  for (const s of sentences) {
    if (s.trim().length > limit) {
      // Одно очень длинное предложение — добираем по словам.
      push();
      let wordBuf = "";
      for (const w of s.split(" ")) {
        if ((wordBuf + " " + w).trim().length > limit) { const t = wordBuf.trim(); if (t) chunks.push(t); wordBuf = w; }
        else wordBuf = (wordBuf + " " + w).trim();
      }
      if (wordBuf.trim()) chunks.push(wordBuf.trim());
      continue;
    }
    if ((buf + s).length > limit) push();
    buf += s;
  }
  push();
  return chunks;
}

/**
 * Озвучить длинный текст: режем на куски и проигрываем подряд, дожидаясь конца
 * каждого. Нужно для историй/статей — цельным запросом бэкенд отвечает 400.
 * Новая озвучка (любая) прерывает начатую последовательность.
 */
export async function speakInworldLong(text: string, voice = "Alain"): Promise<void> {
  const chunks = splitForTts(text);
  if (chunks.length === 0) return;
  const mySeq = ++speakSeq;
  for (const chunk of chunks) {
    if (mySeq !== speakSeq) return; // началась другая озвучка — прекращаем
    await playInworld(chunk, voice, true);
  }
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
