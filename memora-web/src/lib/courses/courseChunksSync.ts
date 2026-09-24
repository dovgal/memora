// Личный набор «Фразы · {курс}»: готовые фразы курса (не отдельные слова) как
// карточки с интервальным повторением. Один набор на курс — пополняется
// идемпотентно, карточки каждого юнита занимают непрерывный диапазон, чтобы
// кнопка на юните могла открыть тренажёр только с его партией
// (см. src/lib/studySelection.ts, /set/{id}/learn?range=a-b).
//
// Порядок в наборе всегда собирается заново по ВСЕМ юнитам курса (в порядке
// course.units), а не только по запрошенному юниту: иначе при первом вызове
// с одного юнита его фразы легли бы в начало набора, а более ранний юнит,
// синхронизированный позже, пришлось бы вставлять перед ними — а вставка
// сдвинула бы уже выданные диапазоны и прогресс FSRS других юнитов.
// Существующие карточки никогда не переставляются — только дописываются
// новые (по canonical-порядку), поэтому диапазon уже пройденного юнита
// стабилен между вызовами, пока состав его фраз не меняется.

import { getCourse, getUnit, type CourseDetail } from './customCoursesApi';
import { collectUnitChunks, normalizeChunkKey, type UnitChunk } from './unitChunks';

const FIELDS_SCHEMA = [
  { id: 'term', name: 'Французский', type: 'text', side: 'front', order: 1, settings: { language: 'fr', ttsEnabled: true } },
  { id: 'definition', name: 'Перевод', type: 'text', side: 'back', order: 1, settings: { language: 'ru' } },
];

function setTitleFor(courseTitle: string): string {
  return `Фразы · ${courseTitle}`;
}

function setDescriptionFor(courseTitle: string): string {
  return `Готовые фразы курса «${courseTitle}» — по одной карточке на фразу, пополняется по мере прохождения юнитов.`;
}

function headers(idToken: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
}

interface ExistingSetCard { id: string; term: string; definition: string; fieldsData?: Record<string, unknown> }
interface ExistingSet { id: string; flashcards: ExistingSetCard[] }

export interface UnitChunkRange {
  /** Место первой и последней карточки юнита в наборе, считая с единицы (как studySelection.parseRange). */
  from: number;
  to: number;
}

export interface CourseChunksSyncResult {
  setId: string;
  /** Добавлено этим вызовом (дубли и уже известные фразы пропущены). */
  added: number;
  /** Всего карточек в наборе после синхронизации. */
  total: number;
  /** Диапазон карточек юнита в наборе; null — если у юнита нет фраз (или все — дубли более ранних юнитов). */
  unitRanges: Record<string, UnitChunkRange | null>;
}

interface UnitWithChunks {
  unitId: string;
  chunks: UnitChunk[];
}

/** Фразы всех юнитов курса, в порядке юнитов, без повторов между юнитами (первое вхождение побеждает). */
async function collectCourseChunks(course: CourseDetail, idToken: string): Promise<UnitWithChunks[]> {
  const units = [...course.units].sort((a, b) => a.position - b.position);
  const details = await Promise.all(units.map(u => getUnit(course.id, u.id, idToken)));

  const seen = new Set<string>();
  return units.map((u, i) => {
    const raw = collectUnitChunks(details[i]);
    const chunks = raw.filter(c => {
      const key = normalizeChunkKey(c.fr);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { unitId: u.id, chunks };
  });
}

/**
 * Идемпотентно собирает фразы всех юнитов курса в личный набор «Фразы · {курс}»
 * и возвращает диапазон карточек для каждого юнита (для кнопки «Фразы юнита → карточки»).
 */
export async function syncCourseChunksToSet(courseId: string, idToken: string | undefined): Promise<CourseChunksSyncResult> {
  if (!idToken) throw new Error('Нужно войти, чтобы собрать фразы в карточки');

  const course = await getCourse(courseId, idToken);
  const perUnit = await collectCourseChunks(course, idToken);
  const canonical = perUnit.flatMap(u => u.chunks);
  if (canonical.length === 0) throw new Error('В этом курсе пока нет готовых фраз для карточек');

  const title = setTitleFor(course.title);
  const description = setDescriptionFor(course.title);

  const listR = await fetch('/api/sets', { headers: headers(idToken) });
  if (!listR.ok) throw new Error('Не удалось получить список наборов');
  const sets: Array<{ id: string; title: string }> = await listR.json();
  const found = sets.find(s => s.title === title);

  let setId: string;
  let finalTerms: string[]; // порядок карточек в итоговом наборе (для расчёта диапазонов)
  let added: number;

  if (!found) {
    const r = await fetch('/api/sets', {
      method: 'POST',
      headers: headers(idToken),
      body: JSON.stringify({
        title, description, isPublic: false,
        fieldsSchema: FIELDS_SCHEMA,
        flashcards: canonical.map(c => ({ term: c.fr, definition: c.ru, fieldsData: {} })),
      }),
    });
    if (!r.ok) throw new Error('Не удалось создать набор');
    const created: { id: string } = await r.json();
    setId = created.id;
    finalTerms = canonical.map(c => c.fr);
    added = canonical.length;
  } else {
    const fullR = await fetch(`/api/sets/${found.id}`, { headers: headers(idToken) });
    if (!fullR.ok) throw new Error('Не удалось открыть набор');
    const full: ExistingSet = await fullR.json();

    const existingKeys = new Set(full.flashcards.map(f => normalizeChunkKey(f.term)));
    const fresh = canonical.filter(c => !existingKeys.has(normalizeChunkKey(c.fr)));

    setId = found.id;
    added = fresh.length;
    if (fresh.length > 0) {
      const r = await fetch(`/api/sets/${found.id}`, {
        method: 'PUT',
        headers: headers(idToken),
        body: JSON.stringify({
          title, description, isPublic: false,
          fieldsSchema: FIELDS_SCHEMA,
          flashcards: [
            ...full.flashcards.map(f => ({ id: f.id, term: f.term, definition: f.definition, fieldsData: f.fieldsData || {} })),
            ...fresh.map(c => ({ term: c.fr, definition: c.ru, fieldsData: {} })),
          ],
        }),
      });
      if (!r.ok) throw new Error('Не удалось обновить набор');
    }
    finalTerms = [...full.flashcards.map(f => f.term), ...fresh.map(c => c.fr)];
  }

  // Диапазон юнита = первая..последняя позиция его (сохранившихся после de-dup) фраз
  // в итоговом наборе. Ищем по нормализованному ключу — карточки уже не переставляются,
  // поэтому для только что созданного или чисто дописанного набора диапазон непрерывен;
  // если юнит редактировали и его новая фраза дописалась в хвост набора, диапазон может
  // расшириться и захватить более поздние юниты — известное ограничение (см. отчёт).
  const indexByKey = new Map<string, number>();
  finalTerms.forEach((term, i) => {
    const key = normalizeChunkKey(term);
    if (!indexByKey.has(key)) indexByKey.set(key, i + 1);
  });

  const unitRanges: Record<string, UnitChunkRange | null> = {};
  for (const u of perUnit) {
    const positions = u.chunks
      .map(c => indexByKey.get(normalizeChunkKey(c.fr)))
      .filter((p): p is number => typeof p === 'number');
    unitRanges[u.unitId] = positions.length > 0
      ? { from: Math.min(...positions), to: Math.max(...positions) }
      : null;
  }

  return { setId, added, total: finalTerms.length, unitRanges };
}

/** Ссылка на тренажёр карточек с отбором по диапазону и возвратом на `backHref`. */
export function trainerHref(setId: string, range: UnitChunkRange | null, backHref: string): string {
  const params = new URLSearchParams();
  if (range) params.set('range', `${range.from}-${range.to}`);
  params.set('back', backHref);
  return `/set/${setId}/learn?${params.toString()}`;
}
