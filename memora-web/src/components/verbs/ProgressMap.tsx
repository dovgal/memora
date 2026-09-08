'use client';
// Карта прогресса: 125 клеток пятью рядами по 25 — как страницы школьной
// таблицы. Родитель должен одним взглядом понять, готова ли партия к
// пятнице, поэтому цвет клетки — это прочность, а не что-либо ещё, а
// текущая партия обведена рамкой отдельно от цвета.

import { SOLID_STEP, type IrregularVerb, type VerbState } from '@/lib/courses/verbs/types';

export type Strength = 'new' | 'learning' | 'know' | 'solid';

/**
 * Ступень лесенки — в одну из четырёх бытовых категорий.
 *
 * Границы взяты не произвольно: 0–1 — первые два дня, ответ ещё непрочный;
 * 2–3 — продержался неделю с лишним, но до SOLID_STEP не дотянул; дальше —
 * прочно, ступень уже не пускает глагол в занятие, пока срок не подошёл.
 */
export function strengthOf(state: VerbState | undefined): Strength {
  if (!state) return 'new';
  if (state.step >= SOLID_STEP) return 'solid';
  if (state.step >= 2) return 'know';
  return 'learning';
}

const STRENGTH_META: Record<Strength, { label: string; className: string }> = {
  new:      { label: 'не начат', className: 'bg-qz-bg border-border text-qz-text-muted' },
  learning: { label: 'учу',      className: 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300' },
  know:     { label: 'знаю',     className: 'bg-blue-500/20 border-blue-500/50 text-blue-700 dark:text-blue-300' },
  solid:    { label: 'прочно',   className: 'bg-emerald-500/25 border-emerald-500/60 text-emerald-800 dark:text-emerald-300' },
};

export function ProgressMap({
  verbs, states, assignment,
}: {
  verbs: IrregularVerb[];
  states: Map<number, VerbState>;
  /** Текущая партия — подсвечивается рамкой, чтобы её было видно поверх цвета. */
  assignment: { from: number; to: number } | null;
}) {
  const byPage = new Map<number, IrregularVerb[]>();
  for (const v of verbs) {
    if (!byPage.has(v.page)) byPage.set(v.page, []);
    byPage.get(v.page)!.push(v);
  }
  const pages = [...byPage.entries()].sort(([a], [b]) => a - b);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 flex-wrap text-xs text-qz-text-muted">
        {(Object.keys(STRENGTH_META) as Strength[]).map(k => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-sm border ${STRENGTH_META[k].className}`} />
            {STRENGTH_META[k].label}
          </span>
        ))}
        {assignment && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border-2 border-[#4255ff]" />
            текущая партия
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {pages.map(([page, pageVerbs]) => (
          <div key={page} className="flex gap-1 flex-wrap">
            {pageVerbs
              .slice()
              .sort((a, b) => a.n - b.n)
              .map(v => {
                const strength = strengthOf(states.get(v.n));
                const inAssignment = !!assignment && v.n >= assignment.from && v.n <= assignment.to;
                return (
                  <div
                    key={v.n}
                    title={`${v.n}. ${v.inf} — ${STRENGTH_META[strength].label}`}
                    className={`w-7 h-7 shrink-0 rounded-md border flex items-center justify-center text-[10px] font-semibold
                      ${STRENGTH_META[strength].className}
                      ${inAssignment ? 'border-2 border-[#4255ff]' : ''}`}
                  >
                    {v.n}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
