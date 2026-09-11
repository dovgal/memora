// Проверка построенной фразы моделью: судим смысл, а не буквы.

export interface ProductionVerdictDto {
  isCorrect: boolean;
  /** Мысль передана — даже если сказано не так, как в учебнике. */
  meaningOk: boolean;
  /** Тренируемая грамматика соблюдена. */
  grammarOk: boolean;
  score: number;
  /** Фраза ученика с минимальной правкой — не образец из учебника. */
  corrected: string;
  /** Одна главная ошибка, по-русски. */
  explanation: string;
}

export async function checkProduction(
  payload: { prompt: string; expected: string[]; userAnswer: string; focus?: string },
  idToken?: string,
): Promise<ProductionVerdictDto> {
  const r = await fetch('/api/ai/course/check-production', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`проверка не ответила (${r.status})`);
  return r.json();
}
