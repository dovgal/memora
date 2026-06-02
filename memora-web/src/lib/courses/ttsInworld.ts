// Единая озвучка курсов — ТОЛЬКО через Inworld.ai (бэкенд /api/tts с кэшем).
// Браузерный SpeechSynthesis намеренно НЕ используется (низкое качество).

let currentAudio: HTMLAudioElement | null = null;

/**
 * Озвучить произвольный французский текст через Inworld.
 * @param text  фраза на французском
 * @param voice голос Inworld (по умолчанию Alain — французский)
 */
export async function speakInworld(text: string, voice = "Alain"): Promise<void> {
  const clean = (text || "").trim();
  if (!clean) return;
  try {
    // остановим предыдущее воспроизведение
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const url = `/api/tts?text=${encodeURIComponent(clean)}&voice=${encodeURIComponent(voice)}`;
    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) {
      console.warn("Inworld TTS unavailable:", res.status);
      return; // тихо выходим — браузерный синтез не используем
    }
    const blob = await res.blob();
    if (blob.size === 0) return;
    const audio = new Audio(URL.createObjectURL(blob));
    currentAudio = audio;
    await audio.play();
  } catch (e) {
    console.warn("Inworld TTS error:", e);
  }
}

/** Озвучить карточку лексики из сид-набора (Inworld по UUID карты), с fallback на /api/tts. */
export async function speakCardInworld(cardUuid: string, text: string, voice = "Alain"): Promise<void> {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    const res = await fetch(`/api/audio/${cardUuid}/term_audio`, { cache: "force-cache" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) { const a = new Audio(URL.createObjectURL(blob)); currentAudio = a; await a.play(); return; }
    }
  } catch { /* fallthrough to generic */ }
  await speakInworld(text, voice);
}
