'use client';
// Добавление страницы из интернета на полку.
//
// Отдельного тренажёра для этого нет намеренно: страница становится обычной
// книгой, и к ней сразу применяется всё, что уже есть — перевод по наведению,
// статусы слов, карточки, озвучка, адаптация под уровень.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Globe, Loader2, X, FileText } from 'lucide-react';
import { fetchWebPage, type WebPage } from '@/lib/books/webPage';
import { uploadBook } from '@/lib/books/upload';
import { TARGET_LANGS } from '@/lib/books/langs';
import { BOOK_TOPICS } from '@/lib/books/topics';
import { READING_LEVELS } from '@/lib/books/api';

export function AddWebPage({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [url, setUrl] = useState('');
  const [page, setPage] = useState<WebPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('Публицистика');
  const [language, setLanguage] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('ru');
  const [level, setLevel] = useState('');

  const load = async () => {
    setBusy(true);
    setError(null);
    setNote('Забираю страницу…');
    try {
      const result = await fetchWebPage(url.trim(), idToken);
      setPage(result);
      setTitle(result.meta.title);
      setLanguage(result.meta.language);
      const words = result.chapters.reduce((n, c) => n + c.content.split(/\s+/).length, 0);
      setNote(`${result.chapters.length} частей, ${words.toLocaleString('ru')} слов`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось открыть страницу');
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!page) return;
    setBusy(true);
    setError(null);
    setNote('Сохраняю на полку…');
    try {
      const book = await uploadBook(
        {
          title,
          author: page.meta.author,
          topic,
          language,
          targetLanguage,
          level,
          sourceFormat: 'web',
        },
        page.chapters,
        (done, total) => setNote(`Сохраняю: ${done} из ${total}`),
      );
      onDone?.();
      router.push(`/books/${book.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось сохранить');
      setBusy(false);
    }
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-5">
      <h2 className="font-bold text-foreground mb-1 flex items-center gap-2">
        <Globe className="w-4 h-4 text-[#4255ff]" /> Страница из интернета
      </h2>
      <p className="text-qz-text-muted text-sm mb-4">
        Вставьте адрес статьи — она станет книгой на полке, со всем тем же: перевод по
        наведению, подсветка незнакомых слов, озвучка и карточки.
      </p>

      <div className="flex gap-2 mb-3">
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && url.trim() && !busy) void load(); }}
          placeholder="https://…"
          inputMode="url"
          className="flex-1 bg-transparent border border-border rounded-xl px-3 py-2.5 text-sm text-foreground"
        />
        <button onClick={() => void load()} disabled={busy || !url.trim()}
          className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white text-sm font-bold px-4 rounded-xl transition-colors">
          {busy && !page ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Открыть'}
        </button>
      </div>

      {note && !error && (
        <p className="text-sm text-qz-text-muted flex items-center gap-1.5 mb-3">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} {note}
        </p>
      )}

      {page && (
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Название</span>
              <input value={title} onChange={e => setTitle(e.target.value)}
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
              <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Язык страницы</span>
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
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Уровень чтения</span>
              <select value={level} onChange={e => setLevel(e.target.value)}
                className="w-full mt-1 bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground">
                <option value="">Как в оригинале</option>
                {READING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={() => void save()} disabled={busy || !title.trim()}
              className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              Сохранить и читать
            </button>
            <button onClick={() => { setPage(null); setNote(''); }}
              className="inline-flex items-center gap-1.5 border border-border text-qz-text-muted hover:text-foreground text-sm font-semibold px-3 py-2.5 rounded-xl">
              <X className="w-4 h-4" /> Отмена
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <p className="text-sm font-semibold mb-1">Не удалось</p>
          <p className="text-[11px] font-mono break-words">{error}</p>
        </div>
      )}
    </div>
  );
}
