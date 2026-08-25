// Звуковой сигнал окончания упражнения.
//
// Половина упражнений делается с закрытыми глазами — пальминг, повороты,
// расслабление. Без звука человек либо подглядывает на таймер, чем сводит
// упражнение на нет, либо считает про себя и сбивается.
//
// Звук синтезируется на месте, а не берётся файлом: он мгновенный, ничего не
// грузит по сети и работает офлайн — в том числе на планшете без интернета.

const KEY = 'memora.vision.sound';

let ctx: AudioContext | null = null;
let muted: boolean | null = null;
const listeners = new Set<() => void>();

/**
 * Подготовить звук. Браузеры разрешают воспроизведение только в ответ на
 * действие человека, а сигнал нужен через несколько минут после нажатия —
 * поэтому звуковой контекст создаётся сразу при запуске упражнения и просто
 * ждёт своего часа.
 */
export function armChime(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    void ctx.resume();
  } catch { /* звук недоступен — упражнение всё равно работает */ }
}

export function playChime(): void {
  if (!soundSnapshot()) return;
  try {
    if (!ctx) return;
    void ctx.resume();
    const audio = ctx;
    const now = audio.currentTime;
    // Две ноты подряд, а не одна: одиночный писк с закрытыми глазами легко
    // принять за посторонний звук в комнате.
    for (const [freq, at] of [[660, 0], [880, 0.18]] as const) {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      // Мягкое нарастание и затухание: резкий щелчок пугает, особенно ребёнка.
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.3, now + at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.34);
      osc.connect(gain).connect(audio.destination);
      osc.start(now + at);
      osc.stop(now + at + 0.36);
    }
  } catch { /* не вышло — не беда */ }
}

/** Короткая вибрация вдобавок к звуку: выручает, когда звук выключен в системе. */
export function buzz(): void {
  try { navigator.vibrate?.([120, 80, 120]); } catch { /* не поддерживается */ }
}

// ---------- Включён ли звук ----------

export function subscribeSound(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function soundSnapshot(): boolean {
  if (muted === null) {
    try { muted = window.localStorage.getItem(KEY) === 'off'; } catch { muted = false; }
  }
  return !muted;
}

/** На сервере звука нет — считаем включённым, чтобы значок не прыгал. */
export function soundServerSnapshot(): boolean {
  return true;
}

export function setSound(on: boolean): void {
  muted = !on;
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* приватный режим */ }
  listeners.forEach(fn => fn());
}
