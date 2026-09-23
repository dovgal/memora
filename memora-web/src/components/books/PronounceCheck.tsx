'use client';
// Запись произношения и сверка с эталоном — общая логика для двух мест панели
// разбора: выделения (слово/фраза) вверху и предложения внизу. Раньше запись,
// сверка через checkDictation и цветной дифф жили только в блоке предложения;
// вынесено сюда, чтобы не заводить вторую копию той же логики для выделения.
//
// Кнопка и результат отдаются раздельно (хук + два маленьких компонента), а
// не одним блоком: у предложения кнопка стоит в одном ряду с «Озвучить» и
// «Перевести», а результат — отдельной строкой на всю ширину под рядом.
// Слитый компонент такую раскладку не позволил бы без взлома flex-обёртки.

import { useState } from 'react';
import { Mic, MicOff, Lightbulb } from 'lucide-react';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import { checkDictation, bestTranscript, type DiffOp } from '@/lib/courses/dictation';
import { DiffChips } from '@/components/edito/DiffChips';

interface Result {
  score: number;
  heard: string;
  ops: DiffOp[];
}

export interface PronounceCheck {
  recording: boolean;
  error: string | null;
  result: Result | null;
  /** Начать запись или, если уже пишем, остановить и сверить с эталоном. */
  toggle: () => void;
}

/** Запись попытки произнести target (слово, фраза или предложение) и сверка с эталоном. */
export function usePronounceCheck(target: string, speechLang: string): PronounceCheck {
  const speech = useSpeechAttempt(speechLang);
  const [result, setResult] = useState<Result | null>(null);

  const stopAndCheck = async () => {
    const transcript = await speech.stop();
    if (!transcript) {
      speech.setError('Речь не распознана. В Chrome или Safari оценка работает надёжнее.');
      return;
    }
    const heard = bestTranscript(target, transcript, speech.alternatives());
    const check = checkDictation(target, heard, { spoken: true });
    setResult({
      score: check.total > 0 ? Math.round((check.correct / check.total) * 100) : 0,
      heard,
      ops: check.ops,
    });
  };

  const toggle = () => (speech.recording ? void stopAndCheck() : void speech.start());

  return { recording: speech.recording, error: speech.error, result, toggle };
}

/** Кнопка «Произнести» / «Стоп» — та же разметка, что была в блоке предложения. */
export function PronounceButton({ pronounce }: { pronounce: PronounceCheck }) {
  return (
    <button
      onClick={pronounce.toggle}
      className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
        pronounce.recording ? 'bg-red-500 text-white animate-pulse' : 'border border-border text-qz-text-muted hover:text-[#4255ff] hover:border-[#4255ff]/50'
      }`}
    >
      {pronounce.recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      {pronounce.recording ? 'Стоп' : 'Произнести'}
    </button>
  );
}

/** Ошибка записи и результат сверки (оценка + цветной дифф) под кнопкой. */
export function PronounceFeedback({ pronounce }: { pronounce: PronounceCheck }) {
  return (
    <>
      {pronounce.error && <p className="text-amber-500 text-[11px] mt-1.5">{pronounce.error}</p>}
      {pronounce.result && (
        <div className="mt-2">
          <p className="text-xs font-bold flex items-center gap-1.5 mb-1">
            <Lightbulb className={`w-3.5 h-3.5 ${pronounce.result.score >= 80 ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span className={pronounce.result.score >= 80 ? 'text-emerald-500' : 'text-amber-500'}>{pronounce.result.score}%</span>
            <span className="text-qz-text-muted font-normal">распознано: «{pronounce.result.heard}»</span>
          </p>
          <DiffChips ops={pronounce.result.ops} />
        </div>
      )}
    </>
  );
}
