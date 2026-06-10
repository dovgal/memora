'use client';
// Разговорная практика с ИИ-собеседником:
// - диалог на изучаемом языке с учётом уровня;
// - голосовой ввод через Web Speech API (микрофон);
// - озвучка реплик собеседника через Inworld TTS;
// - мягкий разбор ошибок по-русски после каждой реплики учащегося.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, Send, Mic, MicOff, Volume2, Loader2, MessagesSquare, Eye, EyeOff, RefreshCw,
} from 'lucide-react';
import { converse, type ConverseTurn } from '@/lib/courses/customCoursesApi';
import { speakInworld } from '@/lib/courses/ttsInworld';

// Минимальная типизация Web Speech API (нет в стандартных типах TS)
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

interface ChatMessage extends ConverseTurn {
  translation?: string;
  correction?: string | null;
}

const SCENARIOS = [
  'свободная беседа',
  'знакомство',
  'в кафе',
  'в магазине',
  'спросить дорогу',
  'в отеле',
  'у врача',
  'разговор о погоде и планах',
];

interface Props {
  title: string;
  backHref: string;
  /** Язык для промпта, например «французский» */
  language: string;
  level: string;
  /** Код языка для распознавания речи, например 'fr-FR' */
  speechLang: string;
  /** Голос Inworld для озвучки, например 'Alain' */
  voice: string;
}

export function ConversationPractice({ title, backHref, language, level, speechLang, voice }: Props) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [scenario, setScenario] = useState(SCENARIOS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const speechSupported = !!getSpeechRecognition();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setError(null);
    setInput('');
    const history: ChatMessage[] = [...messages, { role: 'user', content: clean }];
    setMessages(history);
    setBusy(true);
    try {
      const res = await converse(
        history.map(m => ({ role: m.role, content: m.content })),
        { language, level, scenario },
        idToken,
      );
      setMessages([...history, {
        role: 'assistant',
        content: res.reply,
        translation: res.translation,
        correction: res.correction,
      }]);
      speakInworld(res.reply, voice).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
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
      if (transcript) setInput(prev => (prev ? prev + ' ' : '') + transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  };

  const restart = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-qz-card text-qz-text flex flex-col">
      <div className="max-w-3xl w-full mx-auto px-4 py-6 flex-1 flex flex-col">

        <div className="flex items-center justify-between mb-4">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> {title}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[#4255ff] text-sm font-semibold">
            <MessagesSquare className="w-4 h-4" /> Разговорная практика
          </span>
        </div>

        {/* Сценарий */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select
            value={scenario}
            onChange={e => { setScenario(e.target.value); restart(); }}
            className="bg-qz-bg border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
          >
            {SCENARIOS.map(s => <option key={s} value={s}>Сценарий: {s}</option>)}
          </select>
          <button
            onClick={() => setShowTranslations(t => !t)}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-xs font-semibold transition-colors"
          >
            {showTranslations ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showTranslations ? 'Скрыть переводы' : 'Показать переводы'}
          </button>
          {messages.length > 0 && (
            <button onClick={restart} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-xs font-semibold transition-colors">
              <RefreshCw className="w-4 h-4" /> Начать заново
            </button>
          )}
        </div>

        {/* Сообщения */}
        <div className="flex-1 space-y-3 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <MessagesSquare className="w-10 h-10 text-qz-text-muted mx-auto mb-3" />
              <p className="text-foreground font-semibold mb-1">Поговорим на языке курса?</p>
              <p className="text-qz-text-muted text-sm max-w-sm mx-auto">
                Напишите или скажите что-нибудь — собеседник ответит на изучаемом языке ({level}),
                озвучит реплику и мягко разберёт ваши ошибки.
              </p>
              <button
                onClick={() => send('Bonjour !')}
                className="mt-4 inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                Начать с приветствия
              </button>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-[#4255ff] text-white'
                  : 'bg-muted border border-border text-foreground'
              }`}>
                <div className="flex items-start gap-2">
                  <p className="text-sm leading-relaxed flex-1">{m.content}</p>
                  {m.role === 'assistant' && (
                    <button
                      onClick={() => speakInworld(m.content, voice)}
                      className="p-1 text-qz-text-muted hover:text-[#4255ff] transition-colors shrink-0"
                      title="Озвучить"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {m.role === 'assistant' && showTranslations && m.translation && (
                  <p className="text-qz-text-muted text-xs mt-1.5 border-t border-border pt-1.5">{m.translation}</p>
                )}
                {m.role === 'assistant' && m.correction && (
                  <p className="text-amber-400 text-xs mt-1.5 border-t border-border pt-1.5">
                    ✏️ {m.correction}
                  </p>
                )}
              </div>
            </div>
          ))}

          {busy && (
            <div className="flex justify-start">
              <div className="bg-muted border border-border rounded-2xl px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-qz-text-muted" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

        {/* Ввод */}
        <div className="flex items-center gap-2 border-t border-border pt-4">
          {speechSupported && (
            <button
              onClick={toggleMic}
              className={`p-3 rounded-xl border transition-colors ${
                listening
                  ? 'bg-red-500/15 border-red-500/50 text-red-400 animate-pulse'
                  : 'border-border text-qz-text-muted hover:text-[#4255ff] hover:border-[#4255ff]/50'
              }`}
              title={listening ? 'Остановить запись' : 'Сказать голосом'}
            >
              {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(input); }}
            placeholder={listening ? 'Говорите…' : 'Напишите на изучаемом языке…'}
            className="flex-1 bg-qz-bg border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
          />
          <button
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            className="p-3 rounded-xl bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
