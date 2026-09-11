'use client';
// Построение фраз: замена в шаблоне, преобразование, из смысла в форму.
//
// Одно упражнение на все три случая, потому что их устройство одинаково:
// показано задание — человек сам говорит или пишет фразу целиком — видит
// разбор. Различаются только задание и способ проверки.
//
// Главное здесь — никогда не пустой лист и никогда не выбор из готового.
// Выбор тренирует узнавание, а проблема как раз в том, что узнавать человек
// умеет, а собирать фразу сам — нет.

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowRight, CheckCircle2, Lightbulb, Loader2, Mic, MicOff, RotateCcw, XCircle } from 'lucide-react';
import type { ExerciseResult } from '@/lib/courses/edito-a1';
import { matchProduction } from '@/lib/courses/production';
import { checkProduction } from '@/lib/courses/productionApi';
import { heardSomething } from '@/lib/courses/heardCheck';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import type { DiffOp } from '@/lib/courses/dictation';
import { DiffChips } from './DiffChips';

export interface DrillItem {
  /** Что видно на карточке: исходная фраза или мысль по-русски. */
  prompt: string;
  /** Что с ней сделать: «Замените на: ponctuel», «Поставьте в отрицание». */
  task?: string;
  answers: string[];
  /** Опора на случай ступора — скрыта, пока не попросят. */
  hint?: string;
  /**
   * exact — ответ однозначен, хватает пословного сравнения;
   * meaning — проверяет модель по смыслу: верная, но другая фраза засчитывается.
   */
  judge: 'exact' | 'meaning';
}

interface Verdict {
  ok: boolean;
  /** Верно, но потерян акцент — засчитано с пометкой. */
  accents?: boolean;
  /** Своя фраза с минимальной правкой (от модели). */
  corrected?: string;
  explanation?: string;
  /** Ближайший верный ответ и пословный разбор (при пословной проверке). */
  best?: string;
  ops?: DiffOp[];
}

export function ProductionDrill({
  items, focus, speechLang = 'fr-FR', onComplete,
}: {
  items: DrillItem[];
  focus?: string;
  speechLang?: string;
  onComplete?: (result?: ExerciseResult) => void;
}) {
  const { data: session } = useSession();
  const idToken = (session as { id_token?: string } | null)?.id_token;
  const speech = useSpeechAttempt(speechLang);

  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [spoken, setSpoken] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // Счёт ведём по первой попытке: повтор после разбора — это тренировка,
  // и засчитывать его как успех значило бы приукрашивать результат.
  const [firstTry, setFirstTry] = useState(true);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);

  const item = items[idx];
  if (!item) return null;

  const record = async () => {
    if (speech.recording) {
      const text = await speech.stop();
      // Не расслышали — не подсовываем выдуманные слова, а честно говорим.
      if (!text || !heardSomething(item.answers[0] ?? '', text, speech.confidence(), speech.quality())) {
        speech.setError('Не расслышал — повторите ближе к микрофону или напишите фразу.');
        return;
      }
      setInput(text);
      setSpoken(true);
      return;
    }
    speech.reset();
    await speech.start();
  };

  const check = async () => {
    const answer = input.trim();
    if (!answer || checking) return;
    setChecking(true);

    let v: Verdict;
    const exact = matchProduction(item.answers, answer, { spoken });
    if (exact.verdict !== 'wrong') {
      // Совпало с одним из верных ответов — модель спрашивать незачем.
      v = { ok: true, accents: exact.verdict === 'accents' };
    } else if (item.judge === 'meaning') {
      try {
        const r = await checkProduction(
          { prompt: item.prompt, expected: item.answers, userAnswer: answer, focus },
          idToken,
        );
        v = { ok: r.isCorrect, corrected: r.corrected, explanation: r.explanation };
      } catch {
        // Модель не ответила — не оставляем человека без разбора.
        v = { ok: false, best: exact.best, ops: exact.check.ops };
      }
    } else {
      v = { ok: false, best: exact.best, ops: exact.check.ops };
    }

    if (firstTry) {
      if (v.ok) setCorrect(c => c + 1);
      else setWrong(w => [...w, answer]);
      setFirstTry(false);
    }
    setVerdict(v);
    setChecking(false);
  };

  const retry = () => {
    setInput('');
    setSpoken(false);
    setVerdict(null);
    speech.reset();
  };

  const next = () => {
    if (idx + 1 >= items.length) {
      setFinished(true);
      onComplete?.({ correct, total: items.length, wrongAnswers: wrong.length ? wrong : undefined });
      return;
    }
    setIdx(i => i + 1);
    setInput('');
    setSpoken(false);
    setShowHint(false);
    setVerdict(null);
    setFirstTry(true);
    speech.reset();
  };

  if (finished) {
    return (
      <div className="bg-qz-card border border-border rounded-2xl p-6 text-center space-y-2">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
        <p className="text-lg font-bold text-foreground">С первой попытки: {correct} из {items.length}</p>
        <p className="text-sm text-qz-text-muted">Что не вышло сразу — вернётся в повторении.</p>
      </div>
    );
  }

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between text-xs text-qz-text-muted">
        <span>{idx + 1} из {items.length}</span>
        {focus && <span>{focus}</span>}
      </div>

      <div className="space-y-1">
        <p className="text-xl font-semibold text-foreground">{item.prompt}</p>
        {item.task && <p className="text-sm text-[#4255ff] font-semibold">{item.task}</p>}
      </div>

      {item.hint && (
        showHint
          ? <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><Lightbulb className="w-4 h-4" />{item.hint}</p>
          : <button onClick={() => setShowHint(true)} className="text-sm text-qz-text-muted hover:text-foreground inline-flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" /> Подсказка
            </button>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => { setInput(e.target.value); setSpoken(false); }}
          onKeyDown={e => e.key === 'Enter' && (verdict ? next() : void check())}
          disabled={!!verdict}
          placeholder="Скажите или напишите фразу целиком"
          className="flex-1 bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-foreground outline-none focus:border-[#4255ff]/60"
        />
        <button
          onClick={() => void record()}
          disabled={!!verdict}
          title={speech.recording ? 'Остановить' : 'Сказать вслух'}
          className={`px-3 rounded-xl border transition-colors disabled:opacity-40 ${
            speech.recording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'border-border text-foreground hover:border-[#4255ff]/60'
          }`}
        >
          {speech.recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
      </div>
      {speech.error && <p className="text-sm text-amber-600 dark:text-amber-400">{speech.error}</p>}

      {!verdict && (
        <button
          onClick={() => void check()}
          disabled={!input.trim() || checking}
          className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white font-semibold text-sm px-4 py-2.5 rounded-xl"
        >
          {checking && <Loader2 className="w-4 h-4 animate-spin" />} Проверить
        </button>
      )}

      {verdict && (
        <div className="space-y-3">
          {verdict.ok ? (
            <p className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="w-5 h-5" />
              {verdict.accents ? 'Верно — только проверьте акценты' : 'Верно'}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-red-500 font-semibold"><XCircle className="w-5 h-5" /> Не совсем</p>
          )}
          {verdict.explanation && <p className="text-sm text-foreground">{verdict.explanation}</p>}
          {!verdict.ok && verdict.corrected && (
            <p className="text-sm">Ваша фраза с правкой: <span className="font-semibold text-foreground">{verdict.corrected}</span></p>
          )}
          {!verdict.ok && verdict.ops && <DiffChips ops={verdict.ops} />}
          {!verdict.ok && verdict.best && !verdict.corrected && (
            <p className="text-sm">Верно: <span className="font-semibold text-foreground">{verdict.best}</span></p>
          )}
          <div className="flex gap-2">
            {!verdict.ok && (
              <button onClick={retry} className="inline-flex items-center gap-1.5 border border-border text-foreground text-sm font-semibold px-4 py-2.5 rounded-xl">
                <RotateCcw className="w-4 h-4" /> Ещё раз
              </button>
            )}
            <button onClick={next} className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
              Дальше <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
