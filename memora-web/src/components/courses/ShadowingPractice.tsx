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
import { getSpeechRecognition, hasMediaDevices, type SpeechRecognitionLike } from '@/lib/speech';

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
  const [error, setError] = useState<string | null>(null);
  const [selfUrl, setSelfUrl] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');
  const recordingRef = useRef(false);

  const recorderSupported = hasMediaDevices() && typeof window !== 'undefined' && 'MediaRecorder' in window;
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
  const playSelf = () => { if (selfUrl) void new Audio(selfUrl).play().catch(() => {}); };
  const clearSelf = () => { if (selfUrl) { URL.revokeObjectURL(selfUrl); setSelfUrl(null); } };

  const applyTranscript = (transcript: string) => {
    const result = checkDictation(phrase.text, transcript);
    setHeard(transcript);
    setCheck(result);
    const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
    setScores(prev => [...prev, pct]);
  };

  // Запись микрофона (надёжно вызывает запрос доступа) + непрерывное
  // распознавание, которое копит речь и оценивается ТОЛЬКО по ручной остановке.
  const startListening = async () => {
    setError(null);
    clearSelf();
    if (!recorderSupported) { setError('Этот браузер не поддерживает запись с микрофона.'); return; }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? '';
      setError(name === 'NotFoundError' || name === 'DevicesNotFoundError'
        ? 'Микрофон не найден. Проверьте, что он подключён и выбран в системе.'
        : 'Доступ к микрофону не выдан. Разрешите его в запросе браузера (или в настройках сайта — значок слева в адресной строке) и перезагрузите страницу. В macOS также: Системные настройки → Конфиденциальность → Микрофон.');
      return;
    }
    streamRef.current = stream;

    chunksRef.current = [];
    try {
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (ev) => { if (ev.data.size > 0) chunksRef.current.push(ev.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });
        if (blob.size > 0) setSelfUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };
      mediaRecRef.current = mr;
      mr.start();
    } catch {
      stream.getTracks().forEach(t => t.stop());
      setError('Не удалось начать запись. Попробуйте Chrome или Safari.');
      return;
    }

    transcriptRef.current = '';
    const SR = getSpeechRecognition();
    if (SR) {
      try {
        const rec = new SR();
        rec.lang = speechLang;
        rec.interimResults = false;
        rec.continuous = true;
        rec.maxAlternatives = 1;
        rec.onresult = (event) => {
          let full = '';
          const results = event.results;
          for (let i = 0; i < results.length; i++) full += (results[i]?.[0]?.transcript ?? '') + ' ';
          transcriptRef.current = full.trim();
        };
        rec.onend = () => { if (recordingRef.current) { try { rec.start(); } catch { /* noop */ } } };
        rec.onerror = () => {};
        recognitionRef.current = rec;
        rec.start();
      } catch { /* распознавание недоступно — останется запись */ }
    }

    recordingRef.current = true;
    setListening(true);
  };

  const stopListening = () => {
    recordingRef.current = false;
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    try { mediaRecRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
    setTimeout(() => {
      const transcript = transcriptRef.current.trim();
      if (transcript) applyTranscript(transcript);
      else setError('Автопроверка недоступна в этом браузере. Прослушайте свою запись и сравните с образцом. Для автооценки откройте курс в Chrome или Safari.');
    }, 1200);
  };

  const toggleListen = () => { if (listening) stopListening(); else void startListening(); };

  const next = () => {
    if (index + 1 >= phrases.length) {
      setFinished(true);
      return;
    }
    setIndex(i => i + 1);
    setCheck(null);
    setHeard(null);
    setRevealed(false);
    setError(null);
    clearSelf();
  };

  const restart = () => {
    setIndex(0);
    setCheck(null);
    setHeard(null);
    setRevealed(false);
    setScores([]);
    setFinished(false);
    setError(null);
    clearSelf();
  };

  const retryPhrase = () => {
    setCheck(null);
    setHeard(null);
    setError(null);
    clearSelf();
  };

  if (!recorderSupported) {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Mic className="w-10 h-10 text-qz-text-muted mx-auto mb-3" />
          <p className="text-foreground font-semibold mb-1">Микрофон недоступен</p>
          <p className="text-qz-text-muted text-sm mb-4">
            Этот браузер не поддерживает запись с микрофона. Откройте курс по HTTPS в Chrome или Safari.
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
            <>
              <button
                onClick={toggleListen}
                className={`w-full inline-flex items-center justify-center gap-2 font-bold text-base px-6 py-4 rounded-2xl transition-colors ${
                  listening
                    ? 'bg-red-500/15 border border-red-500/50 text-red-400 animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {listening ? <><MicOff className="w-5 h-5" /> Идёт запись… (нажмите, чтобы остановить)</> : <><Mic className="w-5 h-5" /> Повторить вслух</>}
              </button>
              {selfUrl && (
                <button onClick={playSelf} className="mt-3 w-full inline-flex items-center justify-center gap-2 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                  <Volume2 className="w-4 h-4" /> Прослушать себя
                </button>
              )}
              {!speechSupported && (
                <p className="mt-2 text-qz-text-muted text-xs text-center">
                  Автооценка работает в Chrome и Safari. Здесь можно записать себя и сравнить с образцом.
                </p>
              )}
              {error && (
                <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <MicOff className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-amber-600 dark:text-amber-300 text-sm">{error}</p>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-qz-text-muted mb-2">
                  Распознано: точность {check.total > 0 ? Math.round((check.correct / check.total) * 100) : 0}%
                </p>
                <DiffChips ops={check.ops} />
                {heard && <p className="text-qz-text-muted text-xs mt-2">Услышано: «{heard}»</p>}
              </div>
              <div className="flex items-center justify-between gap-3">
                {selfUrl ? (
                  <button onClick={playSelf} className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-sm font-semibold transition-colors">
                    <Volume2 className="w-4 h-4" /> Прослушать себя
                  </button>
                ) : <span />}
                <div className="flex items-center gap-3">
                  <button onClick={retryPhrase} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
                    <RotateCcw className="w-4 h-4" /> Ещё раз
                  </button>
                  <button onClick={next} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors">
                    {index + 1 >= phrases.length ? 'Результат' : 'Дальше'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
