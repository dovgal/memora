'use client';
import { useRef, useState } from 'react';
import { CheckCircle2, VideoIcon } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';

const VIDEO_BASE_URL = process.env.NEXT_PUBLIC_VIDEO_BASE_URL || '';

export function VideoExercise({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: (result?: { correct: number; total: number }) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [watched, setWatched] = useState(false);

  const src = `${VIDEO_BASE_URL}/${exercise.videoFile}`;

  const handleEnded = () => {
    setWatched(true);
    onComplete?.();
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#4255ff]/15 flex items-center justify-center shrink-0">
          <VideoIcon className="w-4 h-4 text-[#4255ff]" />
        </div>
        <div>
          <h4 className="text-foreground font-semibold text-sm">{exercise.title}</h4>
          {exercise.description && (
            <p className="text-qz-text-muted text-xs mt-0.5">{exercise.description}</p>
          )}
        </div>
      </div>

      {!VIDEO_BASE_URL ? (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Видео недоступно: не настроена переменная NEXT_PUBLIC_VIDEO_BASE_URL
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            src={src}
            controls
            preload="metadata"
            playsInline
            onEnded={handleEnded}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => { setWatched(true); onComplete?.(); }}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            watched
              ? 'bg-emerald-500 text-white cursor-default'
              : 'bg-muted text-foreground hover:bg-[#4255ff]/10 hover:text-[#4255ff]'
          }`}
        >
          {watched ? <><CheckCircle2 className="w-4 h-4" /> Просмотрено</> : 'Посмотрел ✔'}
        </button>
      </div>
    </div>
  );
}
