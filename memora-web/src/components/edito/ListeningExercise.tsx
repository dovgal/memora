'use client';
import { useRef, useState } from 'react';
import { Play, Pause, Headphones, CheckCircle2 } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { GrammarQuiz } from './GrammarQuiz';

const BASE_URL = process.env.NEXT_PUBLIC_MEDIA_BASE_URL || '';
const LIVRE_URL = process.env.NEXT_PUBLIC_LIVRE_AUDIO_BASE_URL || '';

export function ListeningExercise({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [listened, setListened] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const src = exercise.source === 'livre' && LIVRE_URL
    ? `${LIVRE_URL}/${exercise.audioFile}`
    : `${BASE_URL}/${exercise.source}/${exercise.audioFile}`;
  const hasQuestions = (exercise.questions?.length ?? 0) > 0;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(p => !p);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const { currentTime, duration: d } = audioRef.current;
    if (d > 0) setProgress(currentTime / d);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setPlaying(false);
    setListened(true);
    if (!hasQuestions) onComplete?.();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = pos * duration;
    setProgress(pos);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#4255ff]/15 flex items-center justify-center shrink-0">
          <Headphones className="w-4 h-4 text-[#4255ff]" />
        </div>
        <h4 className="text-foreground font-semibold text-sm">{exercise.title}</h4>
      </div>

      {!BASE_URL ? (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
          Аудио недоступно: не настроена переменная NEXT_PUBLIC_MEDIA_BASE_URL
        </div>
      ) : (
        <>
          <audio
            ref={audioRef}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />

          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-11 h-11 rounded-full bg-[#4255ff] hover:bg-[#3144e0] flex items-center justify-center shrink-0 transition-colors"
            >
              {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
            </button>

            <div className="flex-1 space-y-1">
              <div
                className="h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
                onClick={handleSeek}
              >
                <div
                  className="h-full bg-[#4255ff] rounded-full transition-[width] duration-100"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-qz-text-muted">
                <span>{fmt(progress * duration)}</span>
                {duration > 0 && <span>{fmt(duration)}</span>}
              </div>
            </div>
          </div>

          {!hasQuestions && (
            <div className="flex justify-end">
              <button
                onClick={() => { setListened(true); onComplete?.(); }}
                disabled={quizDone}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  listened
                    ? 'bg-emerald-500 text-white cursor-default'
                    : 'bg-muted text-foreground hover:bg-[#4255ff]/10 hover:text-[#4255ff]'
                }`}
              >
                {listened ? <><CheckCircle2 className="w-4 h-4" /> Прослушано</> : 'Прослушал ✔'}
              </button>
            </div>
          )}
        </>
      )}

      {exercise.transcript && (
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setShowTranscript(s => !s)}
            className="inline-flex items-center gap-1.5 text-sm text-qz-text-muted hover:text-foreground transition-colors"
          >
            <span>{showTranscript ? '▲' : '▼'}</span>
            {showTranscript ? 'Скрыть транскрипт' : 'Показать транскрипт'}
          </button>
          {showTranscript && (
            <div className="mt-3 p-4 bg-muted/50 rounded-xl text-sm leading-relaxed whitespace-pre-wrap border-l-2 border-[#4255ff]/40 text-foreground">
              {exercise.transcript}
            </div>
          )}
        </div>
      )}

      {hasQuestions && (
        <div className="border-t border-border pt-4">
          <GrammarQuiz
            exercise={{ ...exercise, title: 'Ответьте на вопросы:' }}
            onComplete={() => { setQuizDone(true); onComplete?.(); }}
          />
        </div>
      )}
    </div>
  );
}
