// Детерминированная проверка числового ответа (STEM). LLM здесь НЕТ намеренно:
// арифметике модель не доверяем (см. subject-packs-spec §3).
//
// Понимает французские форматы: запятую как десятичный разделитель,
// пробелы-разделители тысяч; единицы измерения с надстрочными ² ³.

export interface NumericSpec {
  /** Канонический ответ. */
  answer: number;
  /** Абсолютный допуск (по умолчанию 0 — точное совпадение с поправкой на float). */
  tolerance?: number;
  /** Требуемая единица (если задана — ответ без неё не принимается). */
  unit?: string;
  /** Другие принимаемые единицы: множитель приведения к канонической (cm² → 0.0001 для m²). */
  acceptedUnits?: Record<string, number>;
}

export interface NumericCheck {
  correct: boolean;
  /** Разобранное значение (после приведения единиц), если ввод удалось разобрать. */
  value?: number;
  /** Причина отказа для подсказки в UI. */
  reason?: 'unparsed' | 'wrong-unit' | 'wrong-value';
}

/** Нормализация единицы: регистр, надстрочные степени, точки. */
export function normalizeUnit(u: string): string {
  return u.trim().toLowerCase()
    .replace(/²/g, '2').replace(/³/g, '3')
    .replace(/\./g, '')
    .replace(/\s+/g, '');
}

/** «3 500,25 m²» → { value: 3500.25, unit: 'm²' }. null — не число. */
export function parseNumericInput(raw: string): { value: number; unit: string } | null {
  const s = raw.trim().replace(/ /g, ' ');
  const m = s.match(/^([-+]?[\d\s]*\d(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return null;
  const numeric = m[1].replace(/\s+/g, '').replace(',', '.');
  const value = Number(numeric);
  if (!Number.isFinite(value)) return null;
  return { value, unit: m[2].trim() };
}

export function checkNumeric(spec: NumericSpec, raw: string): NumericCheck {
  const parsed = parseNumericInput(raw);
  if (!parsed) return { correct: false, reason: 'unparsed' };

  let value = parsed.value;
  const givenUnit = normalizeUnit(parsed.unit);

  if (spec.unit) {
    const canonical = normalizeUnit(spec.unit);
    if (givenUnit === canonical) {
      // единица канонична — без пересчёта
    } else {
      const factorEntry = Object.entries(spec.acceptedUnits ?? {})
        .find(([u]) => normalizeUnit(u) === givenUnit);
      if (!factorEntry) return { correct: false, value, reason: 'wrong-unit' };
      value *= factorEntry[1];
    }
  }
  // Единица не требуется — лишнюю игнорируем (ученик написал «7 m» при ответе «7»).

  const tolerance = (spec.tolerance ?? 0) + 1e-9;
  const correct = Math.abs(value - spec.answer) <= tolerance;
  return { correct, value, reason: correct ? undefined : 'wrong-value' };
}
