// Звук праздников: тумблер «без звука» (localStorage) + короткие мелодии,
// синтезированные WebAudio — аудиофайлы не нужны, и звук одинаково
// работает офлайн. Тумблер — внешнее хранилище для useSyncExternalStore:
// его показывают и карточка праздника, и страница достижений, и оба должны
// переключаться синхронно.

import type { CelebrationEvent } from './celebrationBus';

const MUTE_KEY = 'memora.game.muted';
const muteListeners = new Set<() => void>();

export function isGameSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    // SSR, приватный режим, запрет хранилища — считаем, что звук включён
    return false;
  }
}

export function setGameSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // квота/приватный режим — переживём без запоминания между визитами
  }
  for (const l of muteListeners) l();
}

export function subscribeGameSoundMuted(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => { muteListeners.delete(listener); };
}

type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

/** Короткая мелодия под тип события — две-четыре ноты синусом, тихо. */
export function playChime(kind: CelebrationEvent['kind']): void {
  if (typeof window === 'undefined' || isGameSoundMuted()) return;
  const Ctx = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctx) return;
  try {
    const ctx = new Ctx();
    const notes = kind === 'levelUp'
      ? [523.25, 659.25, 783.99, 1046.5] // до-ми-соль-до — маленькие фанфары
      : kind === 'achievement'
        ? [659.25, 987.77] // ми-си — короткий «дзынь»
        : [440, 554.37, 659.25]; // ля-до#-ми — спокойное «готово» дневной цели
    let t = ctx.currentTime;
    for (const freq of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
      t += 0.11;
    }
    setTimeout(() => { ctx.close().catch(() => {}); }, 1200);
  } catch {
    // звук — украшение, а не обязанность; молча пропускаем
  }
}
