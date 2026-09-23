// Прогрев озвучки для ближайших пунктов очереди.
//
// Без прогрева человек, ответив на карточку, ждёт секунду тишины, пока
// следующая озвучка сходит на бэкенд Inworld. /api/tts кэширует ответ на год
// (Cache-Control: public, max-age=31536000) — если запрос на тот же текст уже
// был сделан заранее, браузер отдаёт его из собственного HTTP-кэша мгновенно,
// когда до карточки дойдёт очередь. Тело ответа здесь не нужно — только факт,
// что он осел в кэше.

import { trainerHeaders } from './authToken';

const prefetched = new Set<string>();

export async function prefetchAudio(text: string, languageCode: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  const key = `${languageCode}:${clean}`;
  if (prefetched.has(key)) return;
  prefetched.add(key);
  try {
    const url = `/api/tts?text=${encodeURIComponent(clean)}&language=${encodeURIComponent(languageCode)}`;
    const res = await fetch(url, { headers: await trainerHeaders(false) });
    // Ошибку не запоминаем как «прогрето»: иначе в кэше браузера осела бы она.
    if (!res.ok) prefetched.delete(key);
  } catch {
    // Не получилось прогреть — не беда, озвучка всё равно сработает по клику,
    // просто с обычной задержкой сети.
    prefetched.delete(key);
  }
}
