// Настройки тренажёра, запомненные в браузере.
//
// Три переключателя, не больше: звук, направление вопроса, строгость
// проверки. localStorage может быть недоступен (приватный режим Safari,
// заблокированные cookies) — каждое обращение обёрнуто в try/catch, чтобы
// тренажёр не падал там, где настройки просто негде запомнить.

import { DEFAULT_TRAINER_SETTINGS, type TrainerSettings } from './types';

const STORAGE_KEY = 'memora.trainer.settings';

export function loadTrainerSettings(): TrainerSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TRAINER_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<TrainerSettings>;
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_TRAINER_SETTINGS.sound,
      direction: parsed.direction === 'front-to-back' || parsed.direction === 'back-to-front' || parsed.direction === 'mixed'
        ? parsed.direction
        : DEFAULT_TRAINER_SETTINGS.direction,
      grading: parsed.grading === 'soft' || parsed.grading === 'strict' ? parsed.grading : DEFAULT_TRAINER_SETTINGS.grading,
    };
  } catch {
    return DEFAULT_TRAINER_SETTINGS;
  }
}

export function saveTrainerSettings(settings: TrainerSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Приватный режим или заблокированное хранилище — настройки проживут
    // только эту сессию, и это не повод ломать тренажёр.
  }
}
