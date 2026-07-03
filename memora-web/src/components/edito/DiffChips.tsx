'use client';
// Пословная подсветка результата сравнения (диктант, shadowing):
// зелёное — верно, замена — зачёркнутое своё + правильное, янтарное — пропуск, красное — лишнее.

import type { DiffOp } from '@/lib/courses/dictation';

export function DiffChips({ ops }: { ops: DiffOp[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 leading-relaxed">
      {ops.map((op, i) => {
        if (op.type === 'ok') {
          return <span key={i} className="px-1.5 py-0.5 rounded dark:bg-emerald-500/15 bg-emerald-50 dark:text-emerald-300 text-emerald-700 text-sm">{op.expected}</span>;
        }
        if (op.type === 'wrong') {
          return (
            <span key={i} className="px-1.5 py-0.5 rounded dark:bg-red-500/15 bg-red-50 text-sm">
              <span className="line-through dark:text-red-300 text-red-600 opacity-70">{op.given}</span>
              {' '}
              <strong className="dark:text-emerald-300 text-emerald-700">{op.expected}</strong>
            </span>
          );
        }
        if (op.type === 'missing') {
          return <span key={i} className="px-1.5 py-0.5 rounded dark:bg-amber-500/15 bg-amber-50 dark:text-amber-300 text-amber-700 text-sm" title="Пропущенное слово">+{op.expected}</span>;
        }
        return <span key={i} className="px-1.5 py-0.5 rounded dark:bg-red-500/15 bg-red-50 dark:text-red-300 text-red-600 text-sm line-through" title="Лишнее слово">{op.given}</span>;
      })}
    </div>
  );
}
