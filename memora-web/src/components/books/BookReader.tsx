'use client';
// Читалка книги: страница текста со статусами слов, перевод по наведению,
// разбор по клику, чтение вслух и карточки в набор книги.
//
// Устройство близко к LingQ и по причине: незнакомое слово подсвечено, разбор
// открывается сбоку, а страница закрывается кнопкой «знаю все слова» — так
// чтение остаётся чтением, а не бесконечным лазаньем в словарь.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft, ChevronRight, Loader2, List, Play, Pause, Type, Layers,
  BookOpen, CheckCheck, Languages, Search, X,
} from 'lucide-react';
import {
  getBook, getChapter, getVocab, putVocab, updateBook, addCard, translate, searchBook,
  adaptChapter, READING_LEVELS,
  type BookDetail, type ChapterContent, type VocabStatus, type SearchHit,
} from '@/lib/books/api';
import { splitParagraphs, paginate, paginateBlocks, uniqueWords } from '@/lib/books/tokenize';
import { isTextBlock } from '@/lib/books/draft';
import { isUnknown } from '@/lib/books/vocab';
import { TARGET_LANGS, langName, voiceFor, speechTag } from '@/lib/books/langs';
import { speakInworldAndWait, stopInworld } from '@/lib/courses/ttsInworld';
import { ReaderText, sentenceTexts } from './ReaderText';
import { WordPanel, type Selection } from './WordPanel';

const FONT_KEY = 'memora.books.font';

/**
 * Фрагмент из поиска: Postgres размечает совпадения тегами <b>. Собираем узлы
 * сами, а не через innerHTML: текст книги — пользовательский, и вставлять его
 * как разметку нельзя.
 */
function highlight(headline: string) {
  return headline.split(/(<b>.*?<\/b>)/g).map((part, i) =>
    part.startsWith('<b>')
      ? <b key={i} className="text-foreground">{part.slice(3, -4)}</b>
      : <span key={i}>{part}</span>,
  );
}

export function BookReader({ bookId }: { bookId: string }) {
  const [detail, setDetail] = useState<BookDetail | null>(null);
  const [chapter, setChapter] = useState<ChapterContent | null>(null);
  const [chapterPos, setChapterPos] = useState(0);
  const [pageIdx, setPageIdx] = useState(0);
  const [vocab, setVocab] = useState<Map<string, VocabStatus>>(new Map());
  const [sel, setSel] = useState<Selection | null>(null);
  const [selTranslation, setSelTranslation] = useState<string | null>(null);
  const [selTranslating, setSelTranslating] = useState(false);
  const [sentTranslation, setSentTranslation] = useState<string | null>(null);
  const [hover, setHover] = useState<{ key: string; x: number; y: number } | null>(null);
  /** Перевод под словом по касанию: на сенсорном экране наведения нет. */
  const [tap, setTap] = useState<{ key: string; raw: string; sentence: string; x: number; y: number } | null>(null);
  const [aloud, setAloud] = useState(false);
  const [aloudIdx, setAloudIdx] = useState<number | null>(null);
  const [cards, setCards] = useState<Set<string>>(new Set());
  const [targetLang, setTargetLang] = useState('ru');
  /** Уровень адаптации: пусто — читаем оригинал. */
  const [level, setLevel] = useState('');
  const [adapted, setAdapted] = useState<string | null>(null);
  const [adaptAt, setAdaptAt] = useState<{ ready: number; total: number } | null>(null);
  const [fontSize, setFontSize] = useState(19);
  const [toc, setToc] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  /** Что искать на странице после перехода по результату поиска. */
  const [pendingFind, setPendingFind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** Кэш переводов слов без контекста — для мгновенной подсказки при наведении. */
  const transRef = useRef<Map<string, string>>(new Map());
  const [transTick, setTransTick] = useState(0);   // перерисовка подсказки после загрузки
  const aloudRef = useRef(false);
  const textRef = useRef<HTMLDivElement>(null);

  const book = detail?.book ?? null;
  const lang = book?.language ?? '';
  const voice = useMemo(() => voiceFor(lang), [lang]);

  // ---------- Загрузка книги ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await getBook(bookId);
        if (!alive) return;
        setDetail(d);
        setChapterPos(d.book.lastChapter);
        setTargetLang(d.book.targetLanguage || 'ru');
        setLevel(d.book.level || '');
        const v = await getVocab(bookId);
        if (!alive) return;
        setVocab(new Map(v.words.map(w => [w.word, w.status])));
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'не удалось открыть книгу');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [bookId]);

  // ---------- Загрузка главы ----------
  useEffect(() => {
    if (!detail) return;
    let alive = true;
    setChapter(null);
    (async () => {
      try {
        const c = await getChapter(bookId, chapterPos);
        if (!alive) return;
        setChapter(c);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'не удалось загрузить главу');
      }
    })();
    return () => { alive = false; };
  }, [bookId, chapterPos, detail]);

  /**
   * Переписывание главы под уровень. Сервер за один заход берёт несколько
   * кусков, поэтому зовём его по кругу: длинная глава иначе не уложилась бы в
   * таймаут прокси. Готовое сохраняется, и при следующем открытии придёт сразу.
   */
  useEffect(() => {
    if (!chapter || !level) { setAdapted(null); setAdaptAt(null); return; }
    let alive = true;
    setAdapted(null);
    setAdaptAt({ ready: 0, total: 0 });
    (async () => {
      for (let round = 0; round < 40; round++) {
        try {
          const r = await adaptChapter(bookId, chapter.position, level);
          if (!alive) return;
          setAdaptAt({ ready: r.ready, total: r.total });
          if (r.done) { setAdapted(r.content); setAdaptAt(null); return; }
          // Ни одного нового куска за заход — дальше топтаться незачем.
          if (r.ready === 0 && round > 2) break;
        } catch (e) {
          if (!alive) return;
          setError(e instanceof Error ? e.message : 'не удалось переписать главу');
          break;
        }
      }
      if (alive) { setAdaptAt(null); setAdapted(null); }
    })();
    return () => { alive = false; };
  }, [chapter, level, bookId]);

  /**
   * Страницы с картинками — только у неадаптированной главы.
   *
   * Блоки описывают ИСХОДНЫЙ текст. У переписанной под уровень главы своя
   * разбивка на предложения, и картинки встали бы не на свои места, а нумерация
   * предложений разъехалась бы с озвучкой. Поэтому при адаптации возвращаемся к
   * сплошному тексту.
   */
  const blockPages = useMemo(
    () => (!adapted && chapter?.blocks && chapter.blocks.length > 0
      ? paginateBlocks(chapter.blocks)
      : null),
    [chapter, adapted],
  );

  const pages = useMemo(() => {
    // Текст страницы выводим из тех же блоков и в том же порядке: по нему
    // считаются слова, идёт озвучка и нумеруются предложения.
    if (blockPages) return blockPages.map(page => page.filter(isTextBlock).map(b => b.text));
    const text = adapted ?? chapter?.content ?? '';
    return text ? paginate(splitParagraphs(text)) : [];
  }, [chapter, adapted, blockPages]);
  // useMemo: массив абзацев уходит в зависимости эффектов — новая ссылка на
  // каждый рендер заставляла бы их перезапускаться без причины.
  const pageParagraphs = useMemo(() => pages[pageIdx] ?? [], [pages, pageIdx]);

  // Открыли книгу — возвращаемся на страницу, где остановились.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !book || pages.length === 0) return;
    restoredRef.current = true;
    const p = Math.round(book.lastOffset * (pages.length - 1));
    if (p > 0) setPageIdx(Math.min(p, pages.length - 1));
  }, [book, pages.length]);

  // ---------- Предзагрузка переводов страницы ----------
  // Слова переводятся пачкой заранее, чтобы подсказка появлялась мгновенно.
  // Сервер кэширует переводы навсегда, поэтому повторные страницы бесплатны.
  useEffect(() => {
    if (!lang || pageParagraphs.length === 0) return;
    const words = uniqueWords(pageParagraphs, lang).filter(w => !transRef.current.has(w));
    if (words.length === 0) return;
    let alive = true;
    (async () => {
      for (let i = 0; i < words.length; i += 50) {
        const batch = words.slice(i, i + 50);
        try {
          const r = await translate({ texts: batch, targetLang, sourceLang: lang });
          if (!alive) return;
          batch.forEach((w, j) => transRef.current.set(w, r.translations[j] ?? ''));
          setTransTick(t => t + 1);
        } catch {
          return;   // квота или сеть — подсказки просто появятся по клику
        }
      }
    })();
    return () => { alive = false; };
  }, [pageParagraphs, lang, targetLang]);

  // ---------- Переход к найденному месту ----------
  // Поиск возвращает главу, а читаем мы страницами: после загрузки главы
  // находим страницу, где встречается запрос, и открываем сразу её.
  useEffect(() => {
    if (!pendingFind || pages.length === 0) return;
    const needle = pendingFind.toLowerCase();
    const idx = pages.findIndex(p => p.join(' ').toLowerCase().includes(needle));
    setPendingFind(null);
    if (idx >= 0) setPageIdx(idx);
  }, [pendingFind, pages]);

  // ---------- Догрузка перевода под курсором ----------
  // Предзагрузка страницы могла не успеть или упереться в квоту — тогда слово
  // под курсором переводится отдельно. Задержка отсекает случайные пробеги мыши.
  useEffect(() => {
    const key = hover?.key ?? tap?.key;
    if (!key || !lang || transRef.current.has(key)) return;
    let alive = true;
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await translate({ texts: [key], targetLang, sourceLang: lang });
          if (!alive) return;
          transRef.current.set(key, r.translations[0] ?? '');
          setTransTick(n => n + 1);
        } catch { /* подсказка просто не появится */ }
      })();
    }, 220);
    return () => { alive = false; clearTimeout(t); };
  }, [hover, tap, lang, targetLang]);

  // ---------- Сохранение позиции ----------
  useEffect(() => {
    if (!book || pages.length === 0) return;
    const offset = pages.length > 1 ? pageIdx / (pages.length - 1) : 0;
    const t = setTimeout(() => {
      void updateBook(bookId, { lastChapter: chapterPos, lastOffset: offset }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [bookId, chapterPos, pageIdx, pages.length, book]);

  // ---------- Настройки шрифта ----------
  useEffect(() => {
    const saved = Number(window.localStorage.getItem(FONT_KEY));
    if (saved >= 14 && saved <= 30) setFontSize(saved);
  }, []);
  const changeFont = (d: number) => {
    setFontSize(prev => {
      const next = Math.min(30, Math.max(14, prev + d));
      try { window.localStorage.setItem(FONT_KEY, String(next)); } catch { /* приватный режим */ }
      return next;
    });
  };

  // ---------- Работа со словом ----------

  const openSelection = useCallback(async (next: Selection) => {
    setSel(next);
    setSentTranslation(null);
    const cached = next.kind === 'word' ? transRef.current.get(next.key) : undefined;
    setSelTranslation(cached ?? null);
    if (!lang) return;
    // Перевод с контекстом: без него слово переводится наугад.
    setSelTranslating(true);
    try {
      const r = await translate({
        texts: [next.text], targetLang, sourceLang: lang, context: next.sentence,
      });
      setSelTranslation(r.translations[0] ?? cached ?? '');
    } catch (e) {
      if (!cached) setSelTranslation(null);
      setError(e instanceof Error ? e.message : null);
    } finally {
      setSelTranslating(false);
    }
  }, [lang, targetLang]);

  const setStatus = useCallback((word: string, status: VocabStatus) => {
    setVocab(prev => new Map(prev).set(word, status));
    void putVocab(bookId, [{ word, status, translation: transRef.current.get(word) ?? '' }]).catch(() => {});
  }, [bookId]);

  const knowAllOnPage = useCallback(() => {
    const words = uniqueWords(pageParagraphs, lang).filter(w => isUnknown(vocab.get(w)));
    if (words.length === 0) return;
    setVocab(prev => {
      const m = new Map(prev);
      words.forEach(w => m.set(w, 3));
      return m;
    });
    void putVocab(bookId, words.map(w => ({ word: w, status: 3 as VocabStatus }))).catch(() => {});
  }, [pageParagraphs, lang, vocab, bookId]);

  const saveCard = useCallback(async () => {
    if (!sel) return;
    const definition = selTranslation ?? transRef.current.get(sel.key) ?? '';
    if (!definition) return;
    try {
      await addCard(bookId, { term: sel.text, definition, example: sel.sentence });
      setCards(prev => new Set(prev).add(sel.text));
      // Сохранённое слово автоматически переходит в «учу»: оно теперь в работе.
      if (sel.kind === 'word' && isUnknown(vocab.get(sel.key))) setStatus(sel.key, 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось добавить карточку');
    }
  }, [sel, selTranslation, bookId, vocab, setStatus]);

  const translateSentence = useCallback(async () => {
    if (!sel?.sentence || !lang) return;
    try {
      const r = await translate({ texts: [sel.sentence], targetLang, sourceLang: lang });
      setSentTranslation(r.translations[0] ?? '');
    } catch { /* перевод предложения не критичен */ }
  }, [sel, lang, targetLang]);

  // ---------- Клик и наведение по тексту ----------

  const sentenceOf = (el: HTMLElement): string => {
    const idx = Number(el.getAttribute('data-sentence'));
    return Number.isFinite(idx) ? (sentences[idx] ?? '') : '';
  };

  const sentences = useMemo(() => sentenceTexts(pageParagraphs, lang), [pageParagraphs, lang]);

  const onTextClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-word]') as HTMLElement | null;
    // Пользователь выделяет фразу — не перебиваем выделение открытием слова.
    if ((window.getSelection()?.toString() ?? '').trim().length > 1) return;
    if (!target) { setTap(null); return; }
    const key = target.getAttribute('data-word') ?? '';
    const raw = target.getAttribute('data-raw') ?? key;
    const sentence = sentenceOf(target);

    // Палец или мышь — решаем по самому событию, а не по ширине экрана:
    // на сенсорном экране наведения не существует, и подсказка не появится
    // никогда, а открывать полный разбор ради одного слова слишком грубо.
    const touch = (e.nativeEvent as PointerEvent).pointerType === 'touch';
    if (touch) {
      const r = target.getBoundingClientRect();
      setTap({ key, raw, sentence, x: r.left + r.width / 2, y: r.bottom });
      return;
    }
    void openSelection({ kind: 'word', text: raw, key, sentence });
  };

  const onTextOver = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('[data-word]') as HTMLElement | null;
    if (!target) { setHover(null); return; }
    const key = target.getAttribute('data-word') ?? '';
    const r = target.getBoundingClientRect();
    setHover({ key, x: r.left + r.width / 2, y: r.top });
  };

  /** Выделение мышью: фраза или предложение переводится целиком. */
  const onTextMouseUp = () => {
    const s = window.getSelection();
    const text = (s?.toString() ?? '').replace(/\s+/g, ' ').trim();
    if (!text || text.length < 2 || !/\s/.test(text)) return;
    const node = s?.anchorNode;
    const el = (node?.nodeType === 3 ? node.parentElement : node as HTMLElement | null);
    const sentence = el?.closest('[data-sentence]') as HTMLElement | null;
    void openSelection({
      kind: 'phrase',
      text,
      key: '',
      sentence: sentence ? sentenceOf(sentence) : text,
    });
  };

  // ---------- Чтение вслух ----------

  const stopAloud = useCallback(() => {
    aloudRef.current = false;
    setAloud(false);
    setAloudIdx(null);
    stopInworld();
  }, []);

  const startAloud = useCallback(async () => {
    if (aloudRef.current) { stopAloud(); return; }
    aloudRef.current = true;
    setAloud(true);
    for (let i = 0; i < sentences.length; i++) {
      if (!aloudRef.current) return;
      setAloudIdx(i);
      const r = await speakInworldAndWait(sentences[i], voice);
      if (!r.ok) {
        setError(`Не удалось озвучить: ${r.error}`);
        break;
      }
    }
    if (aloudRef.current) stopAloud();
  }, [sentences, voice, stopAloud]);

  // Смена страницы или уход со страницы не должны оставлять голос включённым.
  useEffect(() => () => { aloudRef.current = false; stopInworld(); }, []);

  const goPage = useCallback((d: number) => {
    stopAloud();
    setSel(null);
    setTap(null);
    setPageIdx(prev => {
      const next = prev + d;
      if (next >= 0 && next < pages.length) return next;
      // Край главы — перелистываем главу.
      const nextChapter = chapterPos + d;
      if (nextChapter >= 0 && nextChapter < (detail?.chapters.length ?? 0)) {
        setChapterPos(nextChapter);
        return 0;
      }
      return prev;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pages.length, chapterPos, detail, stopAloud]);

  // Пузырёк привязан к месту на экране: при прокрутке слово из-под него
  // уезжает, поэтому закрываем.
  useEffect(() => {
    if (!tap) return;
    const close = () => setTap(null);
    window.addEventListener('scroll', close, { passive: true });
    return () => window.removeEventListener('scroll', close);
  }, [tap]);

  // ---------- Горячие клавиши ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') { setSel(null); return; }
      if (e.key === 'ArrowRight') { goPage(1); return; }
      if (e.key === 'ArrowLeft') { goPage(-1); return; }
      if (sel?.kind === 'word' && e.key >= '1' && e.key <= '5') {
        setStatus(sel.key, (Number(e.key) - 1) as VocabStatus);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, setStatus, goPage]);

  // ---------- Счётчики ----------
  const stats = useMemo(() => {
    const words = uniqueWords(pageParagraphs, lang);
    const unknown = words.filter(w => isUnknown(vocab.get(w))).length;
    let known = 0;
    for (const s of vocab.values()) if (s === 3) known += 1;
    return { unique: words.length, unknown, known };
  }, [pageParagraphs, lang, vocab]);

  // ---------- Рендер ----------

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-qz-text-muted">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> открываю книгу…
      </div>
    );
  }
  if (!book) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p className="text-qz-text-muted">{error ?? 'Книга не найдена'}</p>
        <Link href="/books" className="text-[#4255ff] font-semibold">К полке</Link>
      </div>
    );
  }

  const hoverText = hover ? (transRef.current.get(hover.key) ?? '…') : '';

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      {/* Верхняя панель */}
      <div className="sticky top-0 z-20 bg-qz-card/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-2 flex-wrap">
          <Link href="/books" className="text-qz-text-muted hover:text-foreground shrink-0" title="К полке">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <button onClick={() => setToc(v => !v)}
            className="inline-flex items-center gap-1.5 text-sm text-qz-text-muted hover:text-foreground min-w-0">
            <List className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-[38vw] font-semibold text-foreground">{book.title}</span>
          </button>

          <div className="flex-1" />

          <span className="text-xs text-qz-text-muted hidden sm:inline">
            {langName(lang)} → 
          </span>
          <select
            value={targetLang}
            onChange={e => {
              const v = e.target.value;
              setTargetLang(v);
              transRef.current.clear();
              setSelTranslation(null);
              void updateBook(bookId, { targetLanguage: v }).catch(() => {});
            }}
            className="bg-transparent border border-border rounded-lg text-xs px-2 py-1.5 text-foreground"
            title="Язык перевода — запоминается для этой книги"
          >
            {TARGET_LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>

          <select
            value={level}
            onChange={e => {
              const v = e.target.value;
              setLevel(v);
              setPageIdx(0);
              void updateBook(bookId, { level: v }).catch(() => {});
            }}
            className="bg-transparent border border-border rounded-lg text-xs px-2 py-1.5 text-foreground"
            title="Уровень адаптации: текст перепишется проще, оригинал сохранится"
          >
            <option value="">оригинал</option>
            {READING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <button onClick={() => { setHits(h => (h === null ? [] : null)); setQuery(''); }} title="Поиск по книге"
            className="p-1.5 rounded-lg border border-border text-qz-text-muted hover:text-foreground">
            <Search className="w-4 h-4" />
          </button>
          <button onClick={() => changeFont(-1)} title="Мельче"
            className="p-1.5 rounded-lg border border-border text-qz-text-muted hover:text-foreground">
            <Type className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => changeFont(1)} title="Крупнее"
            className="p-1.5 rounded-lg border border-border text-qz-text-muted hover:text-foreground">
            <Type className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => void startAloud()}
            title="Читать вслух с подсветкой предложений"
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
              aloud ? 'bg-emerald-500 text-white' : 'bg-[#4255ff] hover:bg-[#3144e0] text-white'
            }`}
          >
            {aloud ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {aloud ? 'Стоп' : 'Вслух'}
          </button>
        </div>

        {/* Поиск по книге */}
        {hits !== null && (
          <div className="max-w-6xl mx-auto px-4 pb-3">
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!query.trim()) return;
                setSearching(true);
                try {
                  const r = await searchBook(bookId, query.trim());
                  setHits(r.hits);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'поиск не удался');
                } finally {
                  setSearching(false);
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Найти слово или фразу в книге"
                className="flex-1 bg-transparent border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
              <button type="submit"
                className="bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-3 py-2 rounded-lg">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Искать'}
              </button>
              <button type="button" onClick={() => { setHits(null); setQuery(''); }}
                className="p-2 text-qz-text-muted hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </form>
            {hits.length > 0 && (
              <div className="mt-2 max-h-64 overflow-y-auto space-y-1">
                {hits.map(h => (
                  <button
                    key={h.position}
                    onClick={() => {
                      stopAloud();
                      setChapterPos(h.position);
                      setPageIdx(0);
                      setPendingFind(query.trim());
                      setHits(null);
                    }}
                    className="block w-full text-left text-sm px-3 py-2 rounded-lg text-qz-text-muted hover:bg-muted"
                  >
                    <span className="font-semibold text-foreground">{h.title || `Глава ${h.position + 1}`}</span>
                    <span className="block text-xs mt-0.5">{highlight(h.headline)}</span>
                  </button>
                ))}
              </div>
            )}
            {hits.length === 0 && query && !searching && (
              <p className="text-qz-text-muted text-xs mt-2">Ничего не нашлось.</p>
            )}
          </div>
        )}

        {/* Оглавление */}
        {toc && (
          <div className="max-w-6xl mx-auto px-4 pb-3 max-h-72 overflow-y-auto">
            {detail?.chapters.map(c => (
              <button
                key={c.position}
                onClick={() => { setChapterPos(c.position); setPageIdx(0); setToc(false); stopAloud(); }}
                className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition-colors ${
                  c.position === chapterPos ? 'bg-[#4255ff]/10 text-[#4255ff] font-semibold' : 'text-qz-text-muted hover:bg-muted'
                }`}
              >
                {c.position + 1}. {c.title || `Глава ${c.position + 1}`}
                <span className="text-xs opacity-60"> · {c.wordCount} слов</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        {/* Текст */}
        <div className="flex-1 min-w-0">
          {error && (
            <p className="mb-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              {error}
            </p>
          )}
          {!chapter ? (
            <p className="text-qz-text-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> загружаю главу…</p>
          ) : adaptAt ? (
            <div className="text-qz-text-muted">
              <p className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                переписываю главу под уровень {level}
                {adaptAt.total > 0 && <> · {adaptAt.ready} из {adaptAt.total}</>}
              </p>
              <p className="text-xs mt-2">
                Делается один раз: при следующем открытии эта глава откроется сразу.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs uppercase tracking-wider font-bold text-qz-text-muted mb-3">
                {chapter.title || `Глава ${chapterPos + 1}`} · стр. {pageIdx + 1} из {pages.length}
                {adapted && <span className="text-[#4255ff]"> · адаптировано под {level}</span>}
              </p>
              <div
                ref={textRef}
                onClick={onTextClick}
                onMouseOver={onTextOver}
                onMouseLeave={() => setHover(null)}
                onMouseUp={onTextMouseUp}
              >
                <ReaderText
                  paragraphs={pageParagraphs}
                  blocks={blockPages?.[pageIdx]}
                  lang={lang}
                  vocab={vocab}
                  activeWord={sel?.kind === 'word' ? sel.key : null}
                  activeSentence={aloudIdx}
                  fontSize={fontSize}
                  lineHeight={1.85}
                />
              </div>

              {/* Нижняя панель страницы */}
              <div className="mt-6 flex items-center gap-2 flex-wrap border-t border-border pt-4">
                <button onClick={() => goPage(-1)}
                  className="inline-flex items-center gap-1 text-sm font-semibold border border-border text-qz-text-muted hover:text-foreground px-3 py-2 rounded-xl">
                  <ChevronLeft className="w-4 h-4" /> Назад
                </button>
                <button
                  onClick={knowAllOnPage}
                  disabled={stats.unknown === 0}
                  title="Отметить все синие слова этой страницы как известные"
                  className="inline-flex items-center gap-1.5 text-sm font-bold border border-emerald-500/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
                >
                  <CheckCheck className="w-4 h-4" /> Знаю все ({stats.unknown})
                </button>
                <div className="flex-1" />
                <button onClick={() => goPage(1)}
                  className="inline-flex items-center gap-1 text-sm font-bold bg-[#4255ff] hover:bg-[#3144e0] text-white px-4 py-2 rounded-xl">
                  Дальше <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-4 text-xs text-qz-text-muted flex-wrap">
                <span className="inline-flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> на странице {stats.unique} слов, новых {stats.unknown}</span>
                <span className="inline-flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> выучено в этом языке: {stats.known}</span>
                {book.setId && (
                  <Link href={`/set/${book.setId}`} className="inline-flex items-center gap-1 text-[#4255ff] hover:underline">
                    <Languages className="w-3.5 h-3.5" /> карточки книги
                  </Link>
                )}
              </div>
            </>
          )}
        </div>

        {/* Панель разбора */}
        <aside className="hidden lg:block w-[340px] shrink-0">
          <div className="sticky top-20 bg-qz-card border border-border rounded-2xl p-4">
            {sel ? (
              <WordPanel
                key={`${sel.text}|${sel.sentence}`}
                selection={sel}
                lang={lang}
                targetLang={targetLang}
                voice={voice}
                speechLang={speechTag(lang)}
                translation={selTranslation}
                translating={selTranslating}
                status={vocab.get(sel.key)}
                onStatus={s => setStatus(sel.key, s)}
                onAddCard={() => void saveCard()}
                cardAdded={cards.has(sel.text)}
                onClose={() => setSel(null)}
                sentenceTranslation={sentTranslation}
                onTranslateSentence={() => void translateSentence()}
              />
            ) : (
              <div className="text-sm text-qz-text-muted space-y-2">
                <p className="font-bold text-foreground">Как читать</p>
                <p>
                  <span className="border-b-2 border-[#4255ff]/70 text-foreground">слово</span> — ещё не отмечали.
                  Наведите — увидите перевод, нажмите — откроется разбор.
                </p>
                <p>
                  <span className="border-b-2 border-amber-500/90 text-foreground">слово</span> — учу,{' '}
                  <span className="border-b-2 border-dotted border-amber-500/70 text-foreground">слово</span> — узнаю.
                  Выученное подчёркиваться перестаёт.
                </p>
                <p>Выделите несколько слов мышью — переведётся вся фраза.</p>
                <p>Клавиши: <b>1…5</b> — статус слова, <b>←</b> и <b>→</b> — страницы.</p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Мобильная панель разбора — снизу */}
      {sel && (
        // bottom-16 и z-50: нижняя навигация панели управления закреплена снизу
        // с z-40 и перекрывала бы разбор слова — на телефоне это съедало кнопки
        // статуса и «в карточки».
        <div className="lg:hidden fixed inset-x-0 bottom-16 z-50 bg-qz-card border-t border-border rounded-t-2xl p-4 max-h-[60vh] overflow-y-auto shadow-2xl">
          <WordPanel
            key={`${sel.text}|${sel.sentence}`}
            selection={sel}
            lang={lang}
            targetLang={targetLang}
            voice={voice}
            speechLang={speechTag(lang)}
            translation={selTranslation}
            translating={selTranslating}
            status={vocab.get(sel.key)}
            onStatus={s => setStatus(sel.key, s)}
            onAddCard={() => void saveCard()}
            cardAdded={cards.has(sel.text)}
            onClose={() => setSel(null)}
            sentenceTranslation={sentTranslation}
            onTranslateSentence={() => void translateSentence()}
          />
        </div>
      )}

      {/* Перевод под словом по короткому касанию */}
      {tap && (
        <div
          className="fixed z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold max-w-[80vw]"
          style={{
            left: Math.min(Math.max(tap.x, 100), (typeof window !== 'undefined' ? window.innerWidth : 1000) - 100),
            top: tap.y + 8,
            transform: 'translateX(-50%)',
            background: '#0b7355',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,.28)',
            boxShadow: '0 10px 28px rgba(11,115,85,.45)',
          }}
          data-tick={transTick}
        >
          <span className="truncate">{transRef.current.get(tap.key) ?? '…'}</span>
          <button
            onClick={() => {
              void openSelection({ kind: 'word', text: tap.raw, key: tap.key, sentence: tap.sentence });
              setTap(null);
            }}
            className="shrink-0 text-[11px] font-bold uppercase tracking-wider bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-colors"
          >
            разбор
          </button>
        </div>
      )}

      {/* Подсказка перевода при наведении */}
      {hover && hoverText && (
        <div
          className="fixed z-40 pointer-events-none px-2.5 py-1.5 rounded-lg text-sm font-semibold max-w-[280px]"
          style={{
            left: Math.min(Math.max(hover.x, 90), (typeof window !== 'undefined' ? window.innerWidth : 1000) - 90),
            top: hover.y - 8,
            transform: 'translate(-50%, -100%)',
            background: '#0b7355',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,.28)',
            boxShadow: '0 10px 28px rgba(11,115,85,.45)',
          }}
          data-tick={transTick}
        >
          {hoverText}
        </div>
      )}
    </div>
  );
}
