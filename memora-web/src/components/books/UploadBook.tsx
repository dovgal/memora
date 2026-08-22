'use client';
// Загрузка книги: разбор файла в браузере, отправка глав пачками, определение
// языка на сервере. Метаданные EPUB и FB2 подставляются сами — их не нужно
// вводить руками, а язык из файла точнее любого угадывания.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, FileText, X } from 'lucide-react';
import { ACCEPTED, extractBook, formatOf } from '@/lib/books/extract';
import { uploadBook } from '@/lib/books/upload';
import type { ChapterDraft } from '@/lib/books/draft';
import { TARGET_LANGS } from '@/lib/books/langs';
import { BOOK_TOPICS } from '@/lib/books/topics';

type Stage = 'idle' | 'parsing' | 'ready' | 'sending' | 'error';

export function UploadBook({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [chapters, setChapters] = useState<ChapterDraft[]>([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ru');
  const [format, setFormat] = useState('txt');

  const pick = async (file: File) => {
    setStage('parsing');
    setError(null);
    setNote('Разбираю файл…');
    try {
      const { chapters: ch, meta } = await extractBook(file, (done, total, s) => {
        setNote(total > 1 ? `${s}: ${done} из ${total}` : s);
      });
      setChapters(ch);
      setFormat(formatOf(file));
      setTitle(meta.title || file.name.replace(/\.[^.]+$/, ''));
      setAuthor(meta.author);
      setLanguage(meta.language);
      setStage('ready');
      setNote(`${ch.length} глав, ${ch.reduce((s, c) => s + c.content.length, 0).toLocaleString('ru')} символов`);
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : 'не удалось разобрать файл');
    }
  };

  const send = async () => {
    setStage('sending');
    setError(null);
    try {
      const book = await uploadBook(
        { title, author, topic, language, targetLanguage, sourceFormat: format },
        chapters,
        (done, total) => setNote(`Отправляю главы: ${done} из ${total}`),
      );
      setNote('Готово');
      onDone?.();
      router.push(`/books/${book.id}`);
    } catch (e) {
      setStage('error');
      setError(e instanceof Error ? e.message : 'не удалось загрузить книгу');
    }
  };

  const busy = stage === 'parsing' || stage === 'sending';

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-5">
      <h2 className="font-bold text-foreground mb-1">Загрузить книгу</h2>
      <p className="text-qz-text-muted text-sm mb-4">
        EPUB, FB2, TXT, PDF или DOCX. Файл разбирается прямо в браузере — на сервер
        уходит уже готовый текст. Язык и рубрику определит модель, если не указать их руками.
        Книга попадёт на общую полку: читать её смогут все, но слова и карточки у каждого свои.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = '';
        }}
      />

      {stage === 'idle' || stage === 'error' ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border hover:border-[#4255ff]/50 rounded-xl py-8 flex flex-col items-center gap-2 text-qz-text-muted hover:text-[#4255ff] transition-colors"
        >
          <Upload className="w-6 h-6" />
          <span className="text-sm font-semibold">Выберите файл книги</span>
          <span className="text-xs">{ACCEPTED.replaceAll('.', '').replaceAll(',', ' · ')}</span>
        </button>
      ) : null}

      {busy && (
        <p className="flex items-center gap-2 text-sm text-qz-text-muted py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> {note}
        </p>
      )}

      {stage === 'ready' && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <FileText className="w-4 h-4" /> {note}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Название</span>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full mt-1 bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Автор</span>
              <input value={author} onChange={e => setAuthor(e.target.value)}
                className="w-full mt-1 bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Рубрика</span>
              <select value={topic} onChange={e => setTopic(e.target.value)}
                className="w-full mt-1 bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                <option value="">Определить автоматически</option>
                {BOOK_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Язык книги</span>
              <select value={language} onChange={e => setLanguage(e.target.value)}
                className="w-full mt-1 bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                <option value="">Определить автоматически</option>
                {TARGET_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Перевод на</span>
              <select value={targetLanguage} onChange={e => setTargetLanguage(e.target.value)}
                className="w-full mt-1 bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                {TARGET_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={() => void send()} disabled={!title.trim()}
              className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              <Upload className="w-4 h-4" /> Загрузить и открыть
            </button>
            <button onClick={() => { setStage('idle'); setChapters([]); }}
              className="inline-flex items-center gap-1.5 border border-border text-qz-text-muted hover:text-foreground text-sm font-semibold px-3 py-2.5 rounded-xl">
              <X className="w-4 h-4" /> Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          {error}
        </p>
      )}
    </div>
  );
}
