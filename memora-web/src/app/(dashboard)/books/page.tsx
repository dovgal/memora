'use client';
// Полка читателя: загруженные книги, прогресс и вход в чтение.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, Trash2, Plus, Languages, ChevronLeft } from 'lucide-react';
import { listBooks, deleteBook, type Book } from '@/lib/books/api';
import { langName } from '@/lib/books/langs';
import { UploadBook } from '@/components/books/UploadBook';

export default function BooksPage() {
  const [books, setBooks] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

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

  const remove = async (b: Book) => {
    if (!window.confirm(`Удалить «${b.title}»? Карточки, сохранённые из книги, останутся.`)) return;
    try {
      await deleteBook(b.id);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось удалить книгу');
    }
  };

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
          Загрузите книгу на изучаемом языке. При чтении перевод появляется по наведению,
          незнакомые слова подсвечены, а любое слово или фразу можно отправить в карточки
          с интервальным повторением.
        </p>

        {adding ? (
          <div className="mb-6">
            <UploadBook onDone={() => { setAdding(false); void reload(); }} />
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors mb-6">
            <Plus className="w-4 h-4" /> Загрузить книгу
          </button>
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
          <div className="grid sm:grid-cols-2 gap-3">
            {books.map(b => {
              const progress = b.chapterCount > 1
                ? Math.round(((b.lastChapter + b.lastOffset) / b.chapterCount) * 100)
                : Math.round(b.lastOffset * 100);
              return (
                <div key={b.id} className="bg-qz-card border border-border rounded-2xl p-4 flex flex-col">
                  <Link href={`/books/${b.id}`} className="flex-1 group">
                    <p className="font-bold text-foreground group-hover:text-[#4255ff] transition-colors leading-snug">{b.title}</p>
                    {b.author && <p className="text-qz-text-muted text-xs mt-0.5">{b.author}</p>}
                    <p className="text-qz-text-muted text-xs mt-2">
                      {langName(b.language)} · {b.chapterCount} глав · {b.wordCount.toLocaleString('ru')} слов
                    </p>
                    <div className="h-1.5 bg-muted rounded-full mt-3">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                    <p className="text-qz-text-muted text-[11px] mt-1">прочитано {Math.min(100, progress)}%</p>
                  </Link>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    <Link href={`/books/${b.id}`} className="text-[#4255ff] text-xs font-bold hover:underline">Читать</Link>
                    {b.setId && (
                      <Link href={`/set/${b.setId}`} className="inline-flex items-center gap-1 text-qz-text-muted hover:text-foreground text-xs">
                        <Languages className="w-3.5 h-3.5" /> карточки
                      </Link>
                    )}
                    <div className="flex-1" />
                    <button onClick={() => void remove(b)} title="Удалить книгу"
                      className="text-qz-text-muted hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
