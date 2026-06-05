'use client';
import { EditoExercise } from '@/lib/courses/edito-a1';

export function Theory({ exercise }: { exercise: EditoExercise }) {
  return (
    <div className="bg-[#13162a] border border-[#262c40] rounded-2xl p-6">
      <div
        className="prose prose-invert prose-sm max-w-none
          [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm
          [&_th]:bg-[#1e2640] [&_th]:text-[#8e95ae] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold
          [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-[#262c40]
          [&_tr:last-child_td]:border-0
          [&_h3]:text-[#ffcd1f] [&_h3]:font-bold [&_h3]:mb-3 [&_h3]:mt-0
          [&_h4]:text-white [&_h4]:font-semibold [&_h4]:mb-2
          [&_p]:text-[#c8cce0] [&_p]:leading-relaxed
          [&_strong]:text-white [&_em]:text-[#8e95ae]
          [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[#c8cce0]
          [&_li]:mb-1
          [&_blockquote]:border-l-4 [&_blockquote]:border-[#4255ff] [&_blockquote]:pl-4 [&_blockquote]:text-[#8e95ae]
          [&_code]:bg-[#1e2640] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[#ffcd1f] [&_code]:text-xs
          [&_div]:mb-3"
        dangerouslySetInnerHTML={{ __html: exercise.content || '' }}
      />
    </div>
  );
}
