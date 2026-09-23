// Озвучка в тренажёре: сперва то, что автор набора записал или включил в
// поле карточки (как и в прежнем «Заучивании»), иначе — Inworld голосом языка
// стороны. Русский текст не озвучиваем: голос изучаемого языка читает его
// бессмысленно, а родной язык ученику слушать незачем.

import type { FieldSchema, FlashcardResponse } from '@/types/schema';
import { fetchAuthedAudioUrl } from '@/lib/authedAudio';
import { speakInworldLanguage, stopInworld } from '@/lib/courses/ttsInworld';
import type { Side } from './lang';

/** Медленный повтор: 0.75 — заметно медленнее, но слово ещё не рассыпается. */
export const SLOW_RATE = 0.75;

let current: HTMLAudioElement | null = null;
let playSeq = 0;

/** Записанная или серверная озвучка полей стороны карточки (если автор набора её включил). */
function recordedAudioUrls(card: FlashcardResponse, side: Side, schema?: FieldSchema[]): string[] {
  const fields = schema?.filter(f => f.side === side && f.type === 'text').sort((a, b) => a.order - b.order) ?? [];
  const urls: string[] = [];
  for (const field of fields) {
    const d = card.fieldsData?.[`${field.id}_audio`];
    if (typeof d === 'string' && d.startsWith('data:')) urls.push(d);
    else if (field.settings?.ttsEnabled) urls.push(`/api/audio/${card.id}/${field.id}_audio`);
  }
  return urls;
}

async function playUrls(urls: string[], rate: number, seq: number): Promise<boolean> {
  for (const url of urls) {
    if (seq !== playSeq) return true; // началась другая озвучка
    try {
      const objUrl = await fetchAuthedAudioUrl(url);
      if (seq !== playSeq) { URL.revokeObjectURL(objUrl); return true; }
      const audio = new Audio(objUrl);
      audio.playbackRate = rate;
      current = audio;
      await new Promise<void>(resolve => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.onpause = () => resolve();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(objUrl);
    } catch {
      return false;
    }
  }
  return true;
}

export function stopTrainerAudio(): void {
  playSeq++;
  if (current) { current.pause(); current = null; }
  stopInworld();
}

/**
 * Озвучить текст. Если это целиком сторона карточки и у неё есть своя
 * запись — играем запись, иначе синтез. Ошибки глотаем: озвучка — помощь,
 * а не условие продолжить занятие.
 */
export async function playTrainerAudio(opts: {
  text: string;
  lang: string;
  card?: FlashcardResponse | null;
  side?: Side;
  schema?: FieldSchema[];
  slow?: boolean;
}): Promise<void> {
  const { text, lang, card, side, schema, slow } = opts;
  if (!text.trim() || lang === 'ru') return;
  stopTrainerAudio();
  const seq = playSeq;
  const rate = slow ? SLOW_RATE : 1;

  if (card && side) {
    const urls = recordedAudioUrls(card, side, schema);
    if (urls.length > 0 && await playUrls(urls, rate, seq)) return;
  }
  if (seq !== playSeq) return;
  await speakInworldLanguage(text, lang, rate);
}
