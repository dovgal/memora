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

/** Результат озвучки: ok=false + причина, чтобы UI мог показать её вместо тишины. */
export interface SpeakResult { ok: boolean; error?: string }

async function playInworld(text: string, voice: string, waitEnd: boolean, language?: string): Promise<SpeakResult> {
  const clean = (text || "").trim();
  if (!clean) return { ok: true };
  try {
    // остановим предыдущее воспроизведение
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    // language задан — голос выбирает предметный пак на бэкенде; иначе явный voice.
    const url = language
      ? `/api/tts?text=${encodeURIComponent(clean)}&language=${encodeURIComponent(language)}`
      : `/api/tts?text=${encodeURIComponent(clean)}&voice=${encodeURIComponent(voice)}`;
    const headers = await getAuthHeaders();
    // ВАЖНО: не force-cache. Он отдаёт запись из кэша независимо от свежести, и
    // однажды закэшированный пустой/битый ответ (например, когда на бэкенде
    // слетал ключ Inworld) залипал навсегда — озвучка «пропадала» молча, и её
    // не чинили ни передеплой, ни перезагрузка. Обычный кэш работает и так:
    // бэкенд отдаёт Cache-Control: public, max-age=31536000.
    let res = await fetch(url, { headers });
    if (!res.ok) {
      const detail = res.status === 401
        ? "нужно войти заново (сессия истекла)"
        : res.status === 400
          ? "текст слишком длинный для одного запроса"
          : `сервер ответил ${res.status}`;
      console.warn("Inworld TTS unavailable:", res.status);
      return { ok: false, error: detail };
    }
    let blob = await res.blob();
    if (blob.size === 0) {
      // Пустое тело почти всегда означает отравленную запись в кэше браузера —
      // перезапрашиваем в обход кэша, чтобы не залипнуть в тишине.
      res = await fetch(url, { cache: "reload", headers });
      if (!res.ok) return { ok: false, error: `сервер ответил ${res.status}` };
      blob = await res.blob();
      if (blob.size === 0) return { ok: false, error: "пустой аудиоответ" };
    }
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
    return { ok: true };
  } catch (e) {
    console.warn("Inworld TTS error:", e);
    // Частая причина здесь — автоплей заблокирован до жеста пользователя.
    const name = (e as { name?: string })?.name ?? "";
    return { ok: false, error: name === "NotAllowedError" ? "браузер заблокировал воспроизведение" : "не удалось воспроизвести звук" };
  }
}

/**
 * Озвучить произвольный текст через Inworld (резолв — на старте воспроизведения).
 * @param text  фраза на изучаемом языке
 * @param voice голос Inworld (по умолчанию Alain — французский)
 */
export async function speakInworld(text: string, voice = "Alain"): Promise<SpeakResult> {
  speakSeq++; // прерываем многочастную читку, если она шла
  return playInworld(text, voice, false);
}

/**
 * Прервать текущую озвучку. Нужна режиму чтения вслух: страница листается
 * посреди предложения, и голос обязан замолчать сразу, а не дочитывать в пустоту.
 */
export function stopInworld(): void {
  speakSeq++; // многочастная читка прекратится на следующем куске
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}

/** То же, но промис резолвится по ОКОНЧАНИИ воспроизведения (для голосового диалога). */
export async function speakInworldAndWait(text: string, voice = "Alain"): Promise<SpeakResult> {
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
export async function speakInworldLanguage(text: string, language: string): Promise<SpeakResult> {
  return playInworld(text, "", false, language || undefined);
}

/** Озвучить карточку лексики из сид-набора (Inworld по UUID карты), с fallback на /api/tts. */
export async function speakCardInworld(cardUuid: string, text: string, voice = "Alain"): Promise<void> {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/audio/${cardUuid}/term_audio`, { headers });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) { const a = new Audio(URL.createObjectURL(blob)); currentAudio = a; await a.play(); return; }
    }
  } catch { /* fallthrough to generic */ }
  await speakInworld(text, voice);
}
