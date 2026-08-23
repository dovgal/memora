// Общая обёртка Web Speech API (распознавание речи в браузере).
// Серверного STT нет намеренно: whisper-rs раздувал Rust-образ и ломал билд
// на Railway (см. примечание в memora-api/Cargo.toml).

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  /** Не останавливаться после первой фразы — копить речь до ручной остановки. */
  continuous?: boolean;
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

// ---------- Выбор микрофона ----------
//
// Важная граница возможного: Web Speech API НЕ позволяет выбрать устройство —
// распознавание всегда идёт с того входа, который назначен по умолчанию в
// браузере и системе. Страница на это повлиять не может, такого метода в
// спецификации нет.
//
// Что мы всё же контролируем — собственный захват через getUserMedia (запись
// «прослушать себя»). Его прикрепляем к встроенному микрофону: при подключённых
// Bluetooth-наушниках система иначе переводит их в режим гарнитуры, и звук
// портится в обе стороны — и запись, и воспроизведение образца.

const PREFERRED_KEY = 'memora.speech.micId';

/** Встроенный микрофон компьютера. */
const BUILT_IN = /(built[\s-]?in|internal|встроен|внутренн|macbook|imac|mac\s?mini|display audio|microphone array|realtek|smart sound)/i;
/** Наушники, гарнитуры и прочие внешние входы. */
const EXTERNAL = /(bluetooth|airpods|headset|headphone|earbud|наушник|гарнитур|beats|jabra|bose|buds|wh-\d|wf-\d|usb|webcam|камер|iphone|continuity)/i;

export interface MicDevice {
  deviceId: string;
  label: string;
  builtIn: boolean;
}

function classify(label: string): boolean {
  if (EXTERNAL.test(label)) return false;
  return BUILT_IN.test(label);
}

/** Список микрофонов. Названия доступны только после выданного разрешения. */
export async function listMicrophones(): Promise<MicDevice[]> {
  if (!hasMediaDevices() || !navigator.mediaDevices.enumerateDevices) return [];
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
      .map(d => ({ deviceId: d.deviceId, label: d.label || 'Микрофон', builtIn: classify(d.label) }));
  } catch {
    return [];
  }
}

export function getPreferredMic(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(PREFERRED_KEY); } catch { return null; }
}

export function setPreferredMic(deviceId: string | null): void {
  try {
    if (deviceId) window.localStorage.setItem(PREFERRED_KEY, deviceId);
    else window.localStorage.removeItem(PREFERRED_KEY);
  } catch { /* приватный режим */ }
}

/**
 * Какой микрофон использовать для записи: явный выбор пользователя, иначе
 * встроенный, иначе первый непомеченный как внешний.
 */
export async function chooseMic(): Promise<MicDevice | null> {
  const mics = await listMicrophones();
  if (mics.length === 0) return null;
  const preferred = getPreferredMic();
  const exact = preferred ? mics.find(m => m.deviceId === preferred) : undefined;
  if (exact) return exact;
  return mics.find(m => m.builtIn) ?? mics.find(m => !EXTERNAL.test(m.label)) ?? null;
}

/** Название устройства по его идентификатору — для показа в интерфейсе. */
export function micLabelOf(mics: MicDevice[], deviceId: string | undefined): string {
  if (!deviceId) return '';
  return mics.find(m => m.deviceId === deviceId)?.label ?? '';
}

/** Похоже ли устройство на наушники или гарнитуру. */
export function looksExternal(label: string): boolean {
  return EXTERNAL.test(label);
}
