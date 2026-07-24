'use client';
import { useMemo } from 'react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { speakInworld } from '@/lib/courses/ttsInworld';

// Делает кликабельными примеры вида «слово [ipa]»: озвучиваем «слово» через TTS.
// Работает поверх статичного HTML теории — оживляет все таблицы-примеры.
// Слово = латинские буквы (в т.ч. с акцентами), апострофы, дефис, пробелы;
// сразу за ним пробел и транскрипция в квадратных скобках. Транскрипция [ ]
// встречается только в тексте (в тегах/стилях скобок нет), поэтому безопасно.
const LINKIFY = /([A-Za-zÀ-ÿŒœ][A-Za-zÀ-ÿŒœ'’ \-]*?)\s(\[[^\]]+\])/g;

function linkify(html: string): string {
  return html.replace(LINKIFY, (_m, word: string, ipa: string) => {
    const say = word.trim().replace(/"/g, '');
    if (!say) return `${word} ${ipa}`;
    return `<span class="say" role="button" tabindex="0" data-say="${say}">${word}</span> ${ipa}`;
  });
}

export function Theory({ exercise, voice = 'Alain' }: { exercise: EditoExercise; voice?: string }) {
  const html = useMemo(() => linkify(exercise.content || ''), [exercise.content]);

  const onActivate = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.('[data-say]') as HTMLElement | null;
    const say = el?.dataset?.say;
    if (say) void speakInworld(say, voice);
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div
        onClick={(e) => onActivate(e.target)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { const t = e.target as HTMLElement; if (t.closest?.('[data-say]')) { e.preventDefault(); onActivate(t); } } }}
        className="prose prose-sm max-w-none
          [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
          [&_th]:bg-background [&_th]:text-qz-text-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-border
          [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border [&_td]:text-foreground
          [&_tr:last-child_td]:border-0
          [&_h3]:text-[#4255ff] [&_h3]:font-bold [&_h3]:mb-3 [&_h3]:mt-0
          [&_h4]:text-foreground [&_h4]:font-semibold [&_h4]:mb-2
          [&_p]:text-qz-text-muted [&_p]:leading-relaxed
          [&_strong]:text-foreground [&_em]:text-qz-text-muted
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-qz-text-muted
          [&_li]:mb-1
          [&_blockquote]:border-l-4 [&_blockquote]:border-[#4255ff] [&_blockquote]:pl-4 [&_blockquote]:text-qz-text-muted
          [&_code]:bg-background [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[#4255ff] [&_code]:text-xs
          [&_div]:mb-3
          [&_.say]:cursor-pointer [&_.say]:text-[#4255ff] [&_.say]:border-b [&_.say]:border-dotted [&_.say]:border-[#4255ff]/50 [&_.say:hover]:bg-[#4255ff]/10 [&_.say]:rounded-sm [&_.say]:transition-colors"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="text-qz-text-muted text-xs mt-4 flex items-center gap-1.5">
        🔊 Нажмите на любой <span className="text-[#4255ff] border-b border-dotted border-[#4255ff]/50">пример</span> в тексте — услышите, как он звучит.
      </p>
    </div>
  );
}
