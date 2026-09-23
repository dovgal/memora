// Язык стороны карточки: код ('fr'/'ru'/'en'…), угадывание по тексту и
// перевод в BCP-47 для распознавания речи и озвучки.
//
// Раньше распознавание речи было жёстко на en-US для любой карточки — приз в
// лотерею угадать язык. Схема полей помнит язык стороны явно (SetTemplateEditor
// хранит его двухбуквенным кодом: 'fr','ru','en','es','de' или 'default'); там,
// где схемы нет или язык не указан, угадываем по тексту: латиница без
// кириллицы — французский (основной изучаемый язык сервиса), если только в
// тексте нет явных примет английского. Точнее всех знает профиль карточки с
// сервера (lib/contracts/trainer.ts) — когда он есть, вызывающий код берёт
// язык оттуда, а угадывание остаётся запасным путём.

import type { FlashcardResponse, FieldSchema } from '@/types/schema';
import { getCardText } from '@/lib/studyUtils';

export type Side = 'front' | 'back';

const BCP47_BY_CODE: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-US',
  ru: 'ru-RU',
  es: 'es-ES',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-PT',
  uk: 'uk-UA',
};

/** Код языка карточки ('fr', 'en', 'default'…) → тег для распознавания речи. */
export function bcp47ForLanguageCode(code: string | null | undefined): string {
  if (!code || code === 'default') return 'ru-RU';
  return BCP47_BY_CODE[code] ?? 'ru-RU';
}

/** Служебные слова, которых во французском не бывает, — надёжная примета английского. */
const ENGLISH_MARKERS = /\b(the|to|is|are|was|were|of|and|you|what|with|this|that|have|has|it's|i'm|don't)\b/i;

/** Латиница без кириллицы — французский, если нет явных примет английского. */
export function guessLanguageCode(text: string): string {
  const hasLatin = /[a-zà-öø-ÿœæ]/i.test(text);
  const hasCyrillic = /[а-яё]/i.test(text);
  if (!hasLatin || hasCyrillic) return 'ru';
  if (/[à-öø-ÿœæ]/i.test(text)) return 'fr';
  return ENGLISH_MARKERS.test(text) ? 'en' : 'fr';
}

/** Явный язык поля из схемы (первое текстовое поле этой стороны), если он задан. */
function explicitLanguageCode(schema: FieldSchema[] | undefined, side: Side): string | null {
  const field = schema?.filter(f => f.side === side && f.type === 'text').sort((a, b) => a.order - b.order)[0];
  const lang = field?.settings?.language;
  return lang && lang !== 'default' ? lang : null;
}

/** Код языка стороны карточки: из схемы, если задан явно, иначе — угадан по тексту. */
export function languageCodeForSide(card: FlashcardResponse, side: Side, schema?: FieldSchema[]): string {
  return explicitLanguageCode(schema, side) ?? guessLanguageCode(getCardText(card, side, schema, false));
}

/** BCP-47 для распознавания/озвучки указанной стороны карточки. */
export function bcp47ForSide(card: FlashcardResponse, side: Side, schema?: FieldSchema[]): string {
  return bcp47ForLanguageCode(languageCodeForSide(card, side, schema));
}

/** Языки сторон карточки, уже известные вызывающему коду (из профиля сервера). */
export interface SideLangs { front: string; back: string }

/**
 * Сторона, которую произносят и слушают (для listen/speak): та, что не
 * по-русски. Если по-русски обе или ни одна — front: так же, как и весь
 * остальной код читает term/front как «слово, которое учат».
 */
export function targetSide(card: FlashcardResponse, schema?: FieldSchema[], langs?: SideLangs): Side {
  const front = langs?.front ?? languageCodeForSide(card, 'front', schema);
  const back = langs?.back ?? languageCodeForSide(card, 'back', schema);
  if (front !== 'ru' && back === 'ru') return 'front';
  if (back !== 'ru' && front === 'ru') return 'back';
  return 'front';
}
