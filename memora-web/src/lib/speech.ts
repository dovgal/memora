// Общая обёртка Web Speech API (распознавание речи в браузере).
// Серверного STT нет намеренно: whisper-rs раздувал Rust-образ и ломал билд
// на Railway (см. примечание в memora-api/Cargo.toml).

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  // event.error: 'not-allowed' | 'service-not-allowed' | 'no-speech' | 'audio-capture' | 'network' | …
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

/** Есть ли доступ к записи звука (для явного запроса разрешения на микрофон). */
export function hasMediaDevices(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/**
 * Явно запрашивает разрешение на микрофон (открывает системный запрос) и сразу
 * освобождает поток. Возвращает true, если доступ дан. Так ошибка «нет
 * разрешения» ловится заранее и понятно, а не молчаливым сбоем распознавания.
 */
export async function ensureMicPermission(): Promise<boolean> {
  if (!hasMediaDevices()) return true; // нет API проверки — полагаемся на само распознавание
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch {
    return false;
  }
}

export function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}
