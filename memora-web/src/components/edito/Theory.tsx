'use client';
import { EditoExercise } from '@/lib/courses/edito-a1';

export function Theory({ exercise }: { exercise: EditoExercise }) {
  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div
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
          [&_div]:mb-3"
        dangerouslySetInnerHTML={{ __html: exercise.content || '' }}
      />
    </div>
  );
}
