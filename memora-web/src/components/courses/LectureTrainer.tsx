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
import { getSpeechRecognition, ensureMicPermission, type SpeechRecognitionLike } from '@/lib/speech';
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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const gotResultRef = useRef(false);

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

  const ERR: Record<string, string> = {
    'not-allowed': 'Нет доступа к микрофону. Разрешите его для сайта: значок 🔒/микрофон в адресной строке → «Разрешить», затем перезагрузите страницу.',
    'service-not-allowed': 'Браузер заблокировал распознавание речи. Разрешите доступ к микрофону в настройках сайта.',
    'no-speech': 'Речь не распознана — говорите чуть громче и ближе к микрофону, затем нажмите «Читать вслух» снова.',
    'audio-capture': 'Микрофон не найден. Проверьте, что он подключён и выбран в системе.',
    'network': 'Нет связи с сервисом распознавания. Проверьте интернет (Web Speech требует онлайн).',
    'mic-denied': 'Доступ к микрофону не выдан. Нажмите «Разрешить» в запросе браузера или включите его в настройках сайта.',
  };

  const listen = async () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = getSpeechRecognition();
    if (!SR) return;
    setError(null);

    // Явно запрашиваем микрофон — так системный запрос точно появляется,
    // а отказ виден сразу понятным сообщением, а не молчаливым сбоем.
    const allowed = await ensureMicPermission();
    if (!allowed) { setError(ERR['mic-denied']); return; }

    const rec = new SR();
    rec.lang = speechLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    gotResultRef.current = false;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (!transcript) return;
      gotResultRef.current = true;
      const result = checkDictation(item.text, transcript);
      setHeard(transcript);
      setCheck(result);
      const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
      setScores(prev => [...prev, pct]);
      // копим статистику проблемных правил для итогового экрана
      setRuleErrors(prev => {
        const next = { ...prev };
        for (const issue of collectIssues(result)) {
          for (const r of issue.rules) next[r.id] = (next[r.id] ?? 0) + 1;
        }
        return next;
      });
    };
    rec.onend = () => {
      setListening(false);
      // распознавание завершилось без результата — подсказываем повторить
      if (!gotResultRef.current) setError(ERR['no-speech']);
    };
    rec.onerror = (event) => {
      setListening(false);
      setError(ERR[event?.error ?? ''] ?? 'Не удалось распознать речь. Попробуйте ещё раз.');
    };
    recognitionRef.current = rec;
    setListening(true);
    try { rec.start(); }
    catch { setListening(false); setError('Распознавание уже идёт — подождите пару секунд и попробуйте снова.'); }
  };

  const next = () => {
    if (index + 1 >= items.length) { setFinished(true); return; }
    setIndex(i => i + 1);
    setCheck(null); setHeard(null); setError(null);
  };
  const retry = () => { setCheck(null); setHeard(null); setError(null); };
  const restart = () => {
    setIndex(0); setCheck(null); setHeard(null); setScores([]); setRuleErrors({}); setFinished(false);
  };

  if (!speechSupported) {
    return (
      <div className="text-center max-w-sm mx-auto py-16">
        <Mic className="w-10 h-10 text-qz-text-muted mx-auto mb-3" />
        <p className="text-foreground font-semibold mb-1">Распознавание речи недоступно</p>
        <p className="text-qz-text-muted text-sm">Ваш браузер не поддерживает Web Speech API. Попробуйте Chrome или Safari.</p>
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
          <button onClick={listen}
            className={`inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-colors ${
              listening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#4255ff] hover:bg-[#3144e0] text-white'}`}>
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {listening ? 'Говорите… (нажмите, чтобы остановить)' : 'Читать вслух'}
          </button>
        </div>

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
