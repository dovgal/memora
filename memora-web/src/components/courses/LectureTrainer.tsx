'use client';
// Тренажёр чтения вслух: ученик видит фразу → читает в микрофон → Web Speech
// транскрибирует → пословный diff с эталоном → оценка. Каждое ошибочное слово
// аннотируется правилами чтения (frenchReadingRules) с объяснением.

import { useMemo, useRef, useState } from 'react';
import {
  Mic, MicOff, Volume2, Turtle, ChevronRight, RotateCcw, BookOpenCheck, Trophy, Lightbulb,
} from 'lucide-react';
import { speakInworld } from '@/lib/courses/ttsInworld';
import { checkDictation, type DictationCheck } from '@/lib/courses/dictation';
import { DiffChips } from '@/components/edito/DiffChips';
import { getSpeechRecognition, hasMediaDevices, type SpeechRecognitionLike } from '@/lib/speech';
import { rulesForWord, READING_RULES, type ReadingRule } from '@/lib/courses/frenchReadingRules';

export interface LectureItem {
  text: string;
  ipa?: string;
  translation?: string;
  ruleIds?: string[];
}

interface WordIssue {
  word: string;
  given?: string;
  rules: ReadingRule[];
}

/** Ошибочные слова диффа + правила чтения, задействованные в каждом. */
function collectIssues(check: DictationCheck): WordIssue[] {
  const issues: WordIssue[] = [];
  for (const op of check.ops) {
    if ((op.type === 'wrong' || op.type === 'missing') && op.expected) {
      issues.push({ word: op.expected, given: op.given, rules: rulesForWord(op.expected).slice(0, 4) });
    }
  }
  return issues;
}

export function LectureTrainer({ items, voice = 'Alain', speechLang = 'fr-FR', onExit }: {
  items: LectureItem[];
  voice?: string;
  speechLang?: string;
  onExit?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [check, setCheck] = useState<DictationCheck | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [ruleErrors, setRuleErrors] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [selfUrl, setSelfUrl] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const gotResultRef = useRef(false);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef('');       // накопленная речь за сессию чтения
  const recordingRef = useRef(false);     // синхронный флаг записи (state async)

  // Запись микрофона поддерживается почти везде (в т.ч. Comet); Web Speech —
  // не всегда (в некоторых Chromium-форках облачный бэкенд распознавания молчит).
  const recorderSupported = hasMediaDevices() && typeof window !== 'undefined' && 'MediaRecorder' in window;
  const speechSupported = !!getSpeechRecognition();
  const item = items[index];
  const issues = useMemo(() => (check ? collectIssues(check) : []), [check]);
  const avgScore = useMemo(
    () => (scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0),
    [scores],
  );
  const mainRules = useMemo(
    () => (item?.ruleIds ?? []).map(id => READING_RULES.find(r => r.id === id)).filter(Boolean) as ReadingRule[],
    [item],
  );

  const play = () => { void speakInworld(item.text, voice); };
  const playSlow = () => {
    const words = item.text.split(/\s+/).filter(Boolean);
    let i = 0;
    const step = () => {
      if (i < words.length) { void speakInworld(words[i], voice); i++; setTimeout(step, 1100); }
    };
    step();
  };

  const applyTranscript = (transcript: string) => {
    gotResultRef.current = true;
    const result = checkDictation(item.text, transcript);
    setHeard(transcript);
    setCheck(result);
    const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
    setScores(prev => [...prev, pct]);
    setRuleErrors(prev => {
      const next = { ...prev };
      for (const issue of collectIssues(result)) {
        for (const r of issue.rules) next[r.id] = (next[r.id] ?? 0) + 1;
      }
      return next;
    });
  };

  // Запускаем запись микрофона (надёжно вызывает системный запрос доступа) и
  // ПАРАЛЛЕЛЬНО — распознавание речи (best-effort: где облачный STT работает,
  // будет автооценка; где нет — останется запись для самопроверки).
  const startListening = async () => {
    setError(null);
    if (selfUrl) { URL.revokeObjectURL(selfUrl); setSelfUrl(null); }
    if (!recorderSupported) { setError('Этот браузер не поддерживает запись с микрофона.'); return; }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const name = (e as { name?: string })?.name ?? '';
      setError(name === 'NotFoundError' || name === 'DevicesNotFoundError'
        ? 'Микрофон не найден. Проверьте, что он подключён и выбран в системе.'
        : 'Доступ к микрофону не выдан. Нажмите «Разрешить» в запросе браузера, а если запроса нет — откройте настройки сайта (значок слева в адресной строке) и включите микрофон, затем перезагрузите страницу. В macOS также проверьте: Системные настройки → Конфиденциальность → Микрофон.');
      return;
    }
    streamRef.current = stream;

    // MediaRecorder — реальная запись, доступна и в Comet.
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
      setError('Не удалось начать запись. Попробуйте другой браузер (Chrome/Safari).');
      return;
    }

    // Параллельно — распознавание. НЕПРЕРЫВНЫЙ режим: копим всю речь и выносим
    // вердикт ТОЛЬКО после ручной остановки, чтобы не оборвать на первой паузе.
    gotResultRef.current = false;
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
          // Собираем полный текст из всех финальных сегментов (continuous).
          let full = '';
          const results = event.results;
          for (let i = 0; i < results.length; i++) full += (results[i]?.[0]?.transcript ?? '') + ' ';
          transcriptRef.current = full.trim();
        };
        // В continuous-режиме движок может завершиться по длинной тишине —
        // пока пользователь не остановил запись, перезапускаем распознавание.
        rec.onend = () => { if (recordingRef.current) { try { rec.start(); } catch { /* noop */ } } };
        rec.onerror = () => {};
        recognitionRef.current = rec;
        rec.start();
      } catch { /* распознавание недоступно — останется запись */ }
    }

    recordingRef.current = true;
    setRecording(true);
    setListening(true);
  };

  const stopListening = () => {
    recordingRef.current = false; // чтобы onend распознавания больше не перезапускался
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    try { mediaRecRef.current?.stop(); } catch { /* noop */ }
    setRecording(false);
    setListening(false);
    // Даём распознаванию время доотдать финальные сегменты, затем оцениваем ОДИН раз.
    setTimeout(() => {
      const transcript = transcriptRef.current.trim();
      if (transcript) applyTranscript(transcript);
      else setError('Автопроверка произношения недоступна в этом браузере. Прослушайте свою запись ниже и сравните с образцом и транскрипцией. Для автоматической оценки откройте курс в Chrome или Safari.');
    }, 1200);
  };

  const toggleListen = () => { if (recording) stopListening(); else void startListening(); };
  const playSelf = () => { if (selfUrl) void new Audio(selfUrl).play().catch(() => {}); };

  const clearSelf = () => { if (selfUrl) { URL.revokeObjectURL(selfUrl); setSelfUrl(null); } };
  const next = () => {
    if (index + 1 >= items.length) { setFinished(true); return; }
    setIndex(i => i + 1);
    setCheck(null); setHeard(null); setError(null); clearSelf();
  };
  const retry = () => { setCheck(null); setHeard(null); setError(null); clearSelf(); };
  const restart = () => {
    setIndex(0); setCheck(null); setHeard(null); setScores([]); setRuleErrors({}); setFinished(false); clearSelf();
  };

  if (!recorderSupported) {
    return (
      <div className="text-center max-w-sm mx-auto py-16">
        <Mic className="w-10 h-10 text-qz-text-muted mx-auto mb-3" />
        <p className="text-foreground font-semibold mb-1">Микрофон недоступен</p>
        <p className="text-qz-text-muted text-sm">Этот браузер не поддерживает запись с микрофона. Откройте курс по HTTPS в Chrome или Safari.</p>
      </div>
    );
  }

  // ---- итоговый экран ----
  if (finished) {
    const worst = Object.entries(ruleErrors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => ({ rule: READING_RULES.find(r => r.id === id)!, n }))
      .filter(x => x.rule);
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="bg-qz-card border border-border rounded-2xl p-8 text-center">
          <Trophy className="w-10 h-10 text-qz-accent mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-foreground mb-1">Сессия чтения завершена!</h2>
          <p className="text-qz-text-muted mb-6">Фраз прочитано: {scores.length} · средняя точность {avgScore}%</p>
          {worst.length > 0 && (
            <div className="text-left bg-background border border-border rounded-xl p-4 mb-6">
              <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-qz-accent" /> Правила, где чаще всего были ошибки:
              </p>
              <div className="space-y-3">
                {worst.map(({ rule, n }) => (
                  <div key={rule.id} className="text-sm">
                    <span className="font-semibold text-foreground">{rule.spelling} → {rule.sound}</span>
                    <span className="text-qz-text-muted text-xs ml-2">({n} слов)</span>
                    <p className="text-qz-text-muted text-xs mt-0.5">{rule.explanation} <em>{rule.example}</em></p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={restart} className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
              <RotateCcw className="w-4 h-4" /> Ещё раз
            </button>
            {onExit && (
              <button onClick={onExit} className="inline-flex items-center gap-2 border border-border text-foreground font-semibold text-sm px-5 py-2.5 rounded-xl">
                Выйти
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const pct = check && check.total > 0 ? Math.round((check.correct / check.total) * 100) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3 text-xs text-qz-text-muted">
        <span>Фраза {index + 1} / {items.length}</span>
        {scores.length > 0 && <span>средняя точность {avgScore}%</span>}
      </div>

      {/* Фраза */}
      <div className="bg-qz-card border border-border rounded-2xl p-6 mb-4">
        <p className="text-2xl md:text-3xl font-semibold text-foreground leading-relaxed mb-2">{item.text}</p>
        {item.ipa && <p className="text-qz-text-muted font-mono text-sm mb-1">[{item.ipa}]</p>}
        {item.translation && <p className="text-qz-text-muted text-sm">{item.translation}</p>}

        {mainRules.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {mainRules.map(r => (
              <span key={r.id} title={`${r.explanation} ${r.example}`}
                className="text-xs bg-[#4255ff]/10 text-[#4255ff] px-2 py-1 rounded-lg font-semibold cursor-help">
                {r.spelling} → {r.sound}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <button onClick={play} className="inline-flex items-center gap-1.5 border border-border hover:border-[#4255ff]/50 text-foreground text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors">
            <Volume2 className="w-4 h-4" /> Прослушать
          </button>
          <button onClick={playSlow} className="inline-flex items-center gap-1.5 border border-border hover:border-[#4255ff]/50 text-foreground text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors">
            <Turtle className="w-4 h-4" /> Медленно
          </button>
          <button onClick={toggleListen}
            className={`inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-colors ${
              recording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#4255ff] hover:bg-[#3144e0] text-white'}`}>
            {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {recording ? 'Идёт запись… (нажмите, чтобы остановить)' : 'Читать вслух'}
          </button>
          {selfUrl && (
            <button onClick={playSelf} className="inline-flex items-center gap-1.5 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors">
              <Volume2 className="w-4 h-4" /> Прослушать себя
            </button>
          )}
        </div>
        {!speechSupported && (
          <p className="mt-2 text-qz-text-muted text-xs">
            Автооценка произношения работает в Chrome и Safari. Здесь можно записать себя и сравнить с образцом и транскрипцией.
          </p>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            <MicOff className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-amber-600 dark:text-amber-300 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Результат */}
      {check && (
        <div className="bg-qz-card border border-border rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
              <BookOpenCheck className="w-4 h-4 text-qz-accent" /> Результат
            </span>
            <span className={`text-lg font-bold ${pct !== null && pct >= 80 ? 'text-emerald-500' : pct !== null && pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {pct}%
            </span>
          </div>
          {heard && <p className="text-qz-text-muted text-xs mb-2">Распознано: «{heard}»</p>}
          <DiffChips ops={check.ops} />

          {issues.length > 0 && (
            <div className="mt-5 border-t border-border pt-4 space-y-4">
              <p className="text-sm font-bold text-foreground flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-qz-accent" /> Разбор ошибок — правила чтения:
              </p>
              {issues.map((issue, i) => (
                <div key={i} className="bg-background border border-border rounded-xl p-3">
                  <p className="text-sm mb-1.5">
                    <strong className="text-foreground">{issue.word}</strong>
                    {issue.given && <span className="text-qz-text-muted text-xs"> — распознано как «{issue.given}»</span>}
                  </p>
                  {issue.rules.length > 0 ? (
                    <ul className="space-y-1">
                      {issue.rules.map(r => (
                        <li key={r.id} className="text-xs text-qz-text-muted">
                          <span className="font-semibold text-foreground">{r.spelling} → {r.sound}:</span>{' '}
                          {r.explanation} <em>{r.example}</em>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-qz-text-muted">Прослушайте образец и повторите, следя за каждым звуком.</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex gap-3">
            <button onClick={retry} className="inline-flex items-center gap-1.5 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-xl">
              <RotateCcw className="w-4 h-4" /> Ещё попытка
            </button>
            <button onClick={next} className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              Дальше <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {!check && (
        <div className="flex justify-end">
          <button onClick={next} className="text-qz-text-muted hover:text-foreground text-sm transition-colors">
            Пропустить фразу →
          </button>
        </div>
      )}
    </div>
  );
}
