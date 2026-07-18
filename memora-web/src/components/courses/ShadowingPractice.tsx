'use client';
// Shadowing: услышал фразу → повторил вслух → пословное сравнение распознанного
// с эталоном (тот же diff, что в диктанте). Тренирует произношение и беглость:
// если Web Speech распознал сказанное как эталон — произношение читаемо для носителя.

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, Mic, MicOff, Volume2, Turtle, Eye, EyeOff, ChevronRight, RotateCcw, AudioLines, Trophy,
} from 'lucide-react';
import { speakInworld } from '@/lib/courses/ttsInworld';
import { checkDictation, type DictationCheck } from '@/lib/courses/dictation';
import { DiffChips } from '@/components/edito/DiffChips';
import { getSpeechRecognition, type SpeechRecognitionLike } from '@/lib/speech';

export interface ShadowPhrase {
  text: string;
  translation?: string;
}

interface Props {
  title: string;
  backHref: string;
  phrases: ShadowPhrase[];
  /** Код языка для распознавания речи, например 'fr-FR' */
  speechLang: string;
  /** Голос Inworld для озвучки */
  voice: string;
}

export function ShadowingPractice({ title, backHref, phrases, speechLang, voice }: Props) {
  const [index, setIndex] = useState(0);
  const [check, setCheck] = useState<DictationCheck | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechSupported = !!getSpeechRecognition();
  const phrase = phrases[index];

  const avgScore = useMemo(
    () => scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    [scores],
  );

  const play = () => { void speakInworld(phrase.text, voice); };
  const playSlow = () => {
    const words = phrase.text.split(/\s+/).filter(Boolean);
    let i = 0;
    const step = () => {
      if (i < words.length) { void speakInworld(words[i], voice); i++; setTimeout(step, 1100); }
    };
    step();
  };

  const listen = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = speechLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (!transcript) return;
      const result = checkDictation(phrase.text, transcript);
      setHeard(transcript);
      setCheck(result);
      const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
      setScores(prev => [...prev, pct]);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const next = () => {
    if (index + 1 >= phrases.length) {
      setFinished(true);
      return;
    }
    setIndex(i => i + 1);
    setCheck(null);
    setHeard(null);
    setRevealed(false);
  };

  const restart = () => {
    setIndex(0);
    setCheck(null);
    setHeard(null);
    setRevealed(false);
    setScores([]);
    setFinished(false);
  };

  const retryPhrase = () => {
    setCheck(null);
    setHeard(null);
  };

  if (!speechSupported) {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Mic className="w-10 h-10 text-qz-text-muted mx-auto mb-3" />
          <p className="text-foreground font-semibold mb-1">Распознавание речи недоступно</p>
          <p className="text-qz-text-muted text-sm mb-4">
            Ваш браузер не поддерживает Web Speech API. Попробуйте Chrome или Safari.
          </p>
          <Link href={backHref} className="text-[#4255ff] hover:underline text-sm">← Вернуться к курсу</Link>
        </div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Trophy className="w-10 h-10 text-qz-accent mx-auto mb-3" />
          <p className="text-foreground font-bold text-lg mb-1">Shadowing завершён!</p>
          <p className="text-qz-text-muted text-sm mb-4">
            {phrases.length} фраз · средняя точность {avgScore}%
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={restart}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Ещё круг
            </button>
            <Link href={backHref} className="text-[#4255ff] hover:underline text-sm">К курсу</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> {title}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[#4255ff] text-sm font-semibold">
            <AudioLines className="w-4 h-4" /> Shadowing
          </span>
        </div>

        {/* Прогресс */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-qz-text-muted text-xs">Фраза {index + 1} / {phrases.length}</span>
          {scores.length > 0 && <span className="text-qz-text-muted text-xs">средняя точность {avgScore}%</span>}
        </div>
        <div className="h-2 bg-muted rounded-full mb-6">
          <div className="h-full bg-[#4255ff] rounded-full transition-all" style={{ width: `${Math.round((index / phrases.length) * 100)}%` }} />
        </div>

        <div className="bg-qz-card border border-border rounded-2xl p-6">
          {/* Эталон: скрыт по умолчанию — тренируем слух, не чтение */}
          <div className="mb-4">
            {revealed ? (
              <p className="text-foreground text-lg font-medium leading-relaxed">{phrase.text}</p>
            ) : (
              <p className="text-qz-text-muted text-lg select-none tracking-wider">{'•'.repeat(Math.min(40, phrase.text.length))}</p>
            )}
            {phrase.translation && <p className="text-qz-text-muted text-sm mt-1">{phrase.translation}</p>}
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-5">
            <button onClick={play} className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <Volume2 className="w-4 h-4" /> Прослушать
            </button>
            <button onClick={playSlow} className="inline-flex items-center gap-2 border border-border text-qz-text-muted hover:text-foreground text-sm px-4 py-2.5 rounded-xl transition-colors" title="По одному слову">
              <Turtle className="w-4 h-4" /> Медленно
            </button>
            <button onClick={() => setRevealed(r => !r)} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-xs font-semibold transition-colors">
              {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {revealed ? 'Скрыть текст' : 'Показать текст'}
            </button>
          </div>

          {!check ? (
            <button
              onClick={listen}
              className={`w-full inline-flex items-center justify-center gap-2 font-bold text-base px-6 py-4 rounded-2xl transition-colors ${
                listening
                  ? 'bg-red-500/15 border border-red-500/50 text-red-400 animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {listening ? <><MicOff className="w-5 h-5" /> Говорите… (нажмите, чтобы остановить)</> : <><Mic className="w-5 h-5" /> Повторить вслух</>}
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-qz-text-muted mb-2">
                  Распознано: точность {check.total > 0 ? Math.round((check.correct / check.total) * 100) : 0}%
                </p>
                <DiffChips ops={check.ops} />
                {heard && <p className="text-qz-text-muted text-xs mt-2">Услышано: «{heard}»</p>}
              </div>
              <div className="flex items-center justify-end gap-3">
                <button onClick={retryPhrase} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
                  <RotateCcw className="w-4 h-4" /> Ещё раз
                </button>
                <button onClick={next} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors">
                  {index + 1 >= phrases.length ? 'Результат' : 'Дальше'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
