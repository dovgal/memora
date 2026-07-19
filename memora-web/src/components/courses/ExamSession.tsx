'use client';
// Экзамен юнита: все интерактивные упражнения подряд, с таймером.
// Проходной балл — 80% правильных ответов. Успешная сдача отмечает
// упражнения юнита выполненными в прогрессе курса.

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, Timer, Award, XCircle, RotateCcw, Play, GraduationCap,
} from 'lucide-react';
import type { EditoExercise, ExerciseResult } from '@/lib/courses/edito-a1';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';
import { recordExerciseProgress } from '@/lib/courses/customCoursesApi';

const PASS_THRESHOLD = 0.8;

interface Props {
  courseId: string;
  unitId: string;
  unitTitle: string;
  exercises: EditoExercise[];
  backHref: string;
  /** Опциональный переключатель языка (показывается на стартовом экране экзамена). */
  langToggle?: React.ReactNode;
}

function fmtTime(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ExamSession({ courseId, unitId, unitTitle, exercises, backHref, langToggle }: Props) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const interactive = useMemo(() => exercises.filter(e => e.type !== 'theory'), [exercises]);

  const [phase, setPhase] = useState<'intro' | 'exam' | 'result'>('intro');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Array<{ id: string; correct: number; total: number }>>([]);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === 'exam') {
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const start = () => {
    setResults([]);
    setIndex(0);
    setSeconds(0);
    setPhase('exam');
  };

  const handleComplete = (id: string, result?: ExerciseResult) => {
    const entry = { id, correct: result?.correct ?? 1, total: result?.total ?? 1 };
    const next = [...results, entry];
    setResults(next);
    if (index + 1 >= interactive.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setPhase('result');
      // Засчитываем прогресс при сдаче
      const totalCorrect = next.reduce((a, r) => a + r.correct, 0);
      const totalAll = next.reduce((a, r) => a + r.total, 0);
      if (totalAll > 0 && totalCorrect / totalAll >= PASS_THRESHOLD && idToken) {
        for (const r of next) {
          recordExerciseProgress(courseId, unitId, r.id, idToken);
        }
      }
    } else {
      setIndex(i => i + 1);
    }
  };

  const totalCorrect = results.reduce((a, r) => a + r.correct, 0);
  const totalAll = results.reduce((a, r) => a + r.total, 0);
  const pct = totalAll > 0 ? totalCorrect / totalAll : 0;
  const passed = pct >= PASS_THRESHOLD;

  if (interactive.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-xl font-bold mb-2">В юните нет упражнений для экзамена</p>
        <Link href={backHref} className="text-[#4255ff] hover:underline">← Назад</Link>
      </div>
    );
  }

  if (phase === 'intro') {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-2xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
              <ChevronLeft className="w-4 h-4" /> Назад
            </Link>
            {langToggle}
          </div>
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#ffcd1f]/15 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-7 h-7 text-qz-accent" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Экзамен: {unitTitle}</h1>
            <p className="text-qz-text-muted text-sm max-w-md mx-auto mb-6">
              {interactive.length} упражнений подряд, с таймером. Проходной балл — 80%.
              Сдадите — юнит будет зачтён целиком.
            </p>
            <button
              onClick={start}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold text-base px-6 py-3.5 rounded-2xl transition-colors"
            >
              <Play className="w-5 h-5" /> Начать экзамен
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          {passed ? (
            <Award className="w-14 h-14 text-qz-accent mx-auto mb-4" />
          ) : (
            <XCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {passed ? 'Экзамен сдан!' : 'Пока не сдан'}
          </h1>
          <p className="text-qz-text-muted text-sm mb-6">
            Правильных ответов: {totalCorrect} из {totalAll} ({Math.round(pct * 100)}%) · Время: {fmtTime(seconds)}
          </p>
          <div className="bg-qz-card border border-border rounded-2xl p-5 mb-6 text-left">
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${passed ? 'bg-emerald-500' : 'bg-red-400'}`}
                style={{ width: `${Math.round(pct * 100)}%` }}
              />
            </div>
            <p className="text-qz-text-muted text-xs mt-2">Проходной балл: 80%</p>
          </div>
          <div className="flex items-center justify-center gap-4">
            {!passed && (
              <button
                onClick={start}
                className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Пересдать
              </button>
            )}
            <Link href={backHref} className="text-[#4255ff] hover:underline text-sm">
              {passed ? 'Вернуться к курсу' : 'Повторить материал'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const current = interactive[index];

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        <div className="flex items-center justify-between mb-6">
          <span className="inline-flex items-center gap-1.5 text-qz-accent text-sm font-semibold">
            <GraduationCap className="w-4 h-4" /> Экзамен · {unitTitle}
          </span>
          <span className="inline-flex items-center gap-1.5 text-qz-text-muted text-sm font-mono">
            <Timer className="w-4 h-4" /> {fmtTime(seconds)}
          </span>
        </div>

        <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground text-sm font-medium">Задание {index + 1} из {interactive.length}</span>
            <span className="text-qz-text-muted text-xs">верно: {totalCorrect} / {totalAll}</span>
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div
              className="h-full bg-[#ffcd1f] rounded-full transition-all duration-500"
              style={{ width: `${Math.round((index / interactive.length) * 100)}%` }}
            />
          </div>
        </div>

        <ExerciseRenderer
          key={`exam-${current.id}-${index}`}
          exercise={current}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}
