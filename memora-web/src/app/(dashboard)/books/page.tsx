'use client';
// Общая полка: книги, загруженные всеми, разложенные по рубрикам.
// Прогресс, словарь и карточки у каждого читателя свои — сервер отдаёт их
// уже подставленными под того, кто смотрит.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, Trash2, Plus, Languages, ChevronLeft, User, Globe } from 'lucide-react';
import { listBooks, deleteBook, updateBook, type Book } from '@/lib/books/api';
import { langName } from '@/lib/books/langs';
import { BOOK_TOPICS, NO_TOPIC } from '@/lib/books/topics';
import { UploadBook } from '@/components/books/UploadBook';
import { AddWebPage } from '@/components/books/AddWebPage';

type GroupBy = 'topic' | 'author' | 'language';

const GROUPS: { id: GroupBy; label: string }[] = [
  { id: 'topic', label: 'По рубрикам' },
  { id: 'author', label: 'По авторам' },
  { id: 'language', label: 'По языкам' },
];

export default function BooksPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<'file' | 'web' | null>(null);
  const [groupBy, setGroupBy] = useState<GroupBy>('topic');

  const reload = useCallback(async () => {
    try {
      setBooks(await listBooks());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось загрузить полку');
      setBooks([]);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await listBooks();
        if (alive) setBooks(list);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'не удалось загрузить полку');
        setBooks([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  /**
   * Рубрика меняется сразу на месте, не дожидаясь сервера: карточка тут же
   * переезжает в нужную группу. Если сервер откажет — возвращаем как было,
   * иначе полка показывала бы то, чего в базе нет.
   */
  const changeTopic = async (b: Book, topic: string) => {
    const before = b.topic;
    setBooks(prev => prev?.map(x => (x.id === b.id ? { ...x, topic } : x)) ?? prev);
    try {
      await updateBook(b.id, { topic });
    } catch (e) {
      setBooks(prev => prev?.map(x => (x.id === b.id ? { ...x, topic: before } : x)) ?? prev);
      setError(e instanceof Error ? e.message : 'не удалось сменить рубрику');
    }
  };

  const remove = async (b: Book) => {
    if (!window.confirm(`Удалить «${b.title}» с общей полки? Карточки и выученные слова останутся у всех, кто её читал.`)) return;
    try {
      await deleteBook(b.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось удалить книгу');
    }
  };

  /** Книги, разложенные по выбранному признаку. Пустая рубрика уходит в конец. */
  const groups = useMemo(() => {
    if (!books) return [];
    const key = (b: Book) =>
      groupBy === 'topic' ? (b.topic || NO_TOPIC)
      : groupBy === 'author' ? (b.author || 'Автор не указан')
      : langName(b.language);

    const map = new Map<string, Book[]>();
    for (const b of books) {
      const k = key(b);
      const list = map.get(k);
      if (list) list.push(b); else map.set(k, [b]);
    }
    return [...map.entries()].sort((a, b) => {
      const aEmpty = a[0] === NO_TOPIC || a[0] === 'Автор не указан';
      const bEmpty = b[0] === NO_TOPIC || b[0] === 'Автор не указан';
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      return a[0].localeCompare(b[0], 'ru');
    });
  }, [books, groupBy]);

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm mb-3">
          <ChevronLeft className="w-4 h-4" /> На главную
        </Link>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 mb-2">
          <BookOpen className="w-7 h-7 text-[#4255ff]" /> Чтение книг
        </h1>
        <p className="text-qz-text-muted mb-6 max-w-2xl">
          Полка общая: читать можно любую книгу, которую загрузил кто угодно. А вот выученные
          слова, место в тексте и набор карточек у каждого свои — читая одну и ту же книгу,
          вы не мешаете друг другу.
        </p>

        {adding === 'file' ? (
          <div className="mb-6">
            <UploadBook onDone={() => { setAdding(null); void reload(); }} />
          </div>
        ) : adding === 'web' ? (
          <div className="mb-6">
            <AddWebPage onDone={() => { setAdding(null); void reload(); }} />
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap mb-6">
            <button onClick={() => setAdding('file')}
              className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Загрузить книгу
            </button>
            <button onClick={() => setAdding('web')}
              className="inline-flex items-center gap-1.5 border border-border text-qz-text-muted hover:text-foreground hover:border-[#4255ff]/50 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
              <Globe className="w-4 h-4" /> Страница из интернета
            </button>
          </div>
        )}

        {error && (
          <p className="mb-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            {error}
          </p>
        )}

        {books === null ? (
          <p className="text-qz-text-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> загружаю полку…</p>
        ) : books.length === 0 ? (
          <p className="text-qz-text-muted text-sm">Полка пуста. Первая книга — самая полезная.</p>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-4 flex-wrap">
              {GROUPS.map(g => (
                <button
                  key={g.id}
                  onClick={() => setGroupBy(g.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                    groupBy === g.id
                      ? 'border-[#4255ff] text-[#4255ff] bg-[#4255ff]/10'
                      : 'border-border text-qz-text-muted hover:text-foreground'
                  }`}
                >
                  {g.label}
                </button>
              ))}
              <span className="text-xs text-qz-text-muted ml-1">книг на полке: {books.length}</span>
            </div>

            {groups.map(([name, list]) => (
              <section key={name} className="mb-6">
                <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-2">
                  {name} <span className="font-normal normal-case opacity-70">· {list.length}</span>
                </h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {list.map(b => <BookCard key={b.id} book={b} onRemove={remove} onTopic={changeTopic} />)}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function BookCard({ book: b, onRemove, onTopic }: {
  book: Book;
  onRemove: (b: Book) => void;
  onTopic: (b: Book, topic: string) => void;
}) {
  const progress = b.chapterCount > 1
    ? Math.round(((b.lastChapter + b.lastOffset) / b.chapterCount) * 100)
    : Math.round(b.lastOffset * 100);
  const started = b.lastChapter > 0 || b.lastOffset > 0;

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-4 flex flex-col">
      <Link href={`/books/${b.id}`} className="flex-1 group">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-foreground group-hover:text-[#4255ff] transition-colors leading-snug">{b.title}</p>
          {b.isOwner && (
            <span title="Вы загрузили эту книгу"
              className="shrink-0 inline-flex items-center gap-1 text-[10px] text-qz-text-muted border border-border rounded-md px-1.5 py-0.5">
              <User className="w-3 h-3" /> моя
            </span>
          )}
        </div>
        {b.author && <p className="text-qz-text-muted text-xs mt-0.5">{b.author}</p>}
        <p className="text-qz-text-muted text-xs mt-2">
          {langName(b.language)} · {b.chapterCount} глав · {b.wordCount.toLocaleString('ru')} слов
        </p>
        {started ? (
          <>
            <div className="h-1.5 bg-muted rounded-full mt-3">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            <p className="text-qz-text-muted text-[11px] mt-1">прочитано {Math.min(100, progress)}%</p>
          </>
        ) : (
          <p className="text-qz-text-muted text-[11px] mt-3">ещё не открывали</p>
        )}
      </Link>
      {/* Рубрику меняет только тот, кто загрузил книгу: полка общая. */}
      {b.isOwner && (
        <label className="mt-3 block">
          <span className="sr-only">Рубрика</span>
          <select
            value={b.topic}
            onChange={e => onTopic(b, e.target.value)}
            title="Рубрика на полке"
            className="w-full bg-transparent border border-border rounded-lg px-2 py-1.5 text-xs text-qz-text-muted hover:text-foreground hover:border-[#4255ff]/40 transition-colors"
          >
            <option value="">{NO_TOPIC}</option>
            {BOOK_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
        <Link href={`/books/${b.id}`} className="text-[#4255ff] text-xs font-bold hover:underline">
          {started ? 'Продолжить' : 'Читать'}
        </Link>
        {b.setId && (
          <Link href={`/set/${b.setId}`} className="inline-flex items-center gap-1 text-qz-text-muted hover:text-foreground text-xs">
            <Languages className="w-3.5 h-3.5" /> мои карточки
          </Link>
        )}
        <div className="flex-1" />
        {/* Удалять может только загрузивший: полка общая. */}
        {b.isOwner && (
          <button onClick={() => onRemove(b)} title="Удалить книгу с полки"
            className="text-qz-text-muted hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
