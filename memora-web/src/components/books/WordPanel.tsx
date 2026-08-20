'use client';
// Панель разбора: слово или выделенная фраза, перевод, статус, карточка,
// словарная статья и работа с предложением (озвучка + проверка произношения).
//
// Панель, а не всплывающее окно поверх текста: разбирая слово, читатель должен
// видеть строку, из которой оно взято, — иначе контекст теряется.

import { useCallback, useState } from 'react';
import {
  X, Volume2, Turtle, Plus, Check, BookOpen, Loader2, Mic, MicOff, Lightbulb,
} from 'lucide-react';
import { dictionary as fetchDictionary, type DictionaryEntry, type VocabStatus } from '@/lib/books/api';
import { STATUS_HINT, STATUS_LABEL } from '@/lib/books/vocab';
import { speakInworld, speakInworldAndWait } from '@/lib/courses/ttsInworld';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import { checkDictation, bestTranscript } from '@/lib/courses/dictation';
import { DiffChips } from '@/components/edito/DiffChips';

export interface Selection {
  /** Слово из текста или произвольно выделенная фраза. */
  kind: 'word' | 'phrase';
  /** Как показано в книге. */
  text: string;
  /** Нормализованная форма — ключ словаря (только для слова). */
  key: string;
  /** Предложение, в котором встретилось. */
  sentence: string;
}

const STATUSES: VocabStatus[] = [0, 1, 2, 3, 4];

const STATUS_BTN: Record<VocabStatus, string> = {
  0: 'border-[#4255ff]/60 text-[#4255ff]',
  1: 'border-amber-500/70 text-amber-600 dark:text-amber-400',
  2: 'border-amber-400/50 text-amber-600 dark:text-amber-400',
  3: 'border-emerald-500/70 text-emerald-600 dark:text-emerald-400',
  4: 'border-border text-qz-text-muted',
};

export function WordPanel({
  selection, lang, targetLang, voice, speechLang, translation, translating,
  status, onStatus, onAddCard, cardAdded, onClose, sentenceTranslation, onTranslateSentence,
}: {
  selection: Selection;
  lang: string;
  targetLang: string;
  voice: string;
  speechLang: string;
  translation: string | null;
  translating: boolean;
  status: VocabStatus | undefined;
  onStatus: (s: VocabStatus) => void;
  onAddCard: () => void;
  cardAdded: boolean;
  onClose: () => void;
  sentenceTranslation: string | null;
  onTranslateSentence: () => void;
}) {
  const [entry, setEntry] = useState<DictionaryEntry | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  const loadDictionary = useCallback(async () => {
    setEntryLoading(true);
    setEntryError(null);
    try {
      setEntry(await fetchDictionary({
        word: selection.text, sentence: selection.sentence, sourceLang: lang, targetLang,
      }));
    } catch (e) {
      setEntryError(e instanceof Error ? e.message : 'не удалось разобрать');
    } finally {
      setEntryLoading(false);
    }
  }, [selection.text, selection.sentence, lang, targetLang]);

  const speak = (text: string) => void speakInworld(text, voice);
  const speakSlow = async (text: string) => {
    for (const w of text.split(/\s+/).filter(Boolean)) {
      await speakInworldAndWait(w, voice);
      await new Promise(r => setTimeout(r, 200));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xl font-bold text-foreground break-words">{selection.text}</p>
          {translating
            ? <p className="text-qz-text-muted text-sm flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> перевожу…</p>
            : <p className="text-[#0b7355] dark:text-emerald-400 text-base font-semibold break-words">{translation ?? '—'}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => speak(selection.text)} title="Прослушать"
            className="p-2 rounded-lg border border-border text-qz-text-muted hover:text-[#4255ff] hover:border-[#4255ff]/50 transition-colors">
            <Volume2 className="w-4 h-4" />
          </button>
          <button onClick={() => void speakSlow(selection.text)} title="Медленно, по словам"
            className="p-2 rounded-lg border border-border text-qz-text-muted hover:text-[#4255ff] hover:border-[#4255ff]/50 transition-colors">
            <Turtle className="w-4 h-4" />
          </button>
          <button onClick={onClose} title="Закрыть (Esc)"
            className="p-2 rounded-lg border border-border text-qz-text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {selection.kind === 'word' && (
        <div>
          <p className="text-[11px] uppercase tracking-wider font-bold text-qz-text-muted mb-1.5">
            Насколько знаете слово <span className="font-normal normal-case">— клавиши 1…5</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s, i) => (
              <button
                key={s}
                onClick={() => onStatus(s)}
                title={STATUS_HINT[s]}
                className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                  status === s || (status === undefined && s === 0)
                    ? `${STATUS_BTN[s]} bg-current/10`
                    : 'border-border text-qz-text-muted hover:text-foreground'
                }`}
              >
                <span className="opacity-50 mr-1">{i + 1}</span>{STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onAddCard}
        disabled={cardAdded}
        className={`inline-flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors ${
          cardAdded
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-default'
            : 'bg-[#4255ff] hover:bg-[#3144e0] text-white'
        }`}
      >
        {cardAdded ? <><Check className="w-4 h-4" /> В наборе книги</> : <><Plus className="w-4 h-4" /> В карточки книги</>}
      </button>

      <SentenceBlock
        // key по тексту: со сменой предложения прежняя оценка произношения
        // к нему уже не относится — компонент начинает с чистого листа.
        key={selection.sentence}
        sentence={selection.sentence}
        voice={voice}
        speechLang={speechLang}
        translation={sentenceTranslation}
        onTranslate={onTranslateSentence}
      />

      {selection.kind === 'word' && (
        <div className="border-t border-border pt-3">
          {!entry && !entryLoading && (
            <button
              onClick={() => void loadDictionary()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4255ff] hover:underline"
            >
              <BookOpen className="w-4 h-4" /> Разобрать слово
            </button>
          )}
          {entryLoading && (
            <p className="text-qz-text-muted text-sm flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin" /> собираю словарную статью…
            </p>
          )}
          {entryError && <p className="text-amber-500 text-xs">Словарь недоступен: {entryError}</p>}
          {entry && (
            <div className="text-sm space-y-2">
              <p>
                <span className="font-bold text-foreground">{entry.lemma}</span>
                {entry.pos && <span className="text-qz-text-muted"> · {entry.pos}</span>}
              </p>
              <p className="text-foreground">
                <span className="text-qz-text-muted text-xs uppercase tracking-wider">здесь: </span>
                {entry.inContext}
              </p>
              {entry.meanings.length > 0 && (
                <ul className="space-y-1">
                  {entry.meanings.map((m, i) => (
                    <li key={i} className="text-qz-text-muted text-xs">
                      <span className="text-foreground">{i + 1}. {m.gloss}</span>
                      {m.example && <span className="italic"> — {m.example}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {entry.note && <p className="text-qz-text-muted text-xs italic">{entry.note}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Предложение целиком: перевод, озвучка и проверка собственного произношения. */
function SentenceBlock({ sentence, voice, speechLang, translation, onTranslate }: {
  sentence: string;
  voice: string;
  speechLang: string;
  translation: string | null;
  onTranslate: () => void;
}) {
  const speech = useSpeechAttempt(speechLang);
  const [result, setResult] = useState<{ score: number; heard: string; ops: ReturnType<typeof checkDictation>['ops'] } | null>(null);

  const stopAndCheck = async () => {
    const transcript = await speech.stop();
    if (!transcript) {
      speech.setError('Речь не распознана. В Chrome или Safari оценка работает надёжнее.');
      return;
    }
    const heard = bestTranscript(sentence, transcript, speech.alternatives());
    const check = checkDictation(sentence, heard, { spoken: true });
    setResult({
      score: check.total > 0 ? Math.round((check.correct / check.total) * 100) : 0,
      heard,
      ops: check.ops,
    });
  };

  if (!sentence) return null;

  return (
    <div className="border-t border-border pt-3">
      <p className="text-[11px] uppercase tracking-wider font-bold text-qz-text-muted mb-1.5">Предложение</p>
      <p className="text-sm text-foreground leading-relaxed mb-2">{sentence}</p>
      {translation && <p className="text-sm text-[#0b7355] dark:text-emerald-400 mb-2">{translation}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => void speakInworld(sentence, voice)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border hover:border-[#4255ff]/50 text-qz-text-muted hover:text-[#4255ff] px-2.5 py-1.5 rounded-lg transition-colors">
          <Volume2 className="w-3.5 h-3.5" /> Озвучить
        </button>
        {!translation && (
          <button onClick={onTranslate}
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border hover:border-[#4255ff]/50 text-qz-text-muted hover:text-[#4255ff] px-2.5 py-1.5 rounded-lg transition-colors">
            Перевести
          </button>
        )}
        <button
          onClick={() => (speech.recording ? void stopAndCheck() : void speech.start())}
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors ${
            speech.recording ? 'bg-red-500 text-white animate-pulse' : 'border border-border text-qz-text-muted hover:text-[#4255ff] hover:border-[#4255ff]/50'
          }`}
        >
          {speech.recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {speech.recording ? 'Стоп' : 'Произнести'}
        </button>
      </div>
      {speech.error && <p className="text-amber-500 text-[11px] mt-1.5">{speech.error}</p>}
      {result && (
        <div className="mt-2">
          <p className="text-xs font-bold flex items-center gap-1.5 mb-1">
            <Lightbulb className={`w-3.5 h-3.5 ${result.score >= 80 ? 'text-emerald-500' : 'text-amber-500'}`} />
            <span className={result.score >= 80 ? 'text-emerald-500' : 'text-amber-500'}>{result.score}%</span>
            <span className="text-qz-text-muted font-normal">распознано: «{result.heard}»</span>
          </p>
          <DiffChips ops={result.ops} />
        </div>
      )}
    </div>
  );
}
