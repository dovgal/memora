'use client';
// Источники («учебники»): загрузка PDF/текста, список, удаление.
// Текст извлекается прямо в браузере (pdf.js), режется на фрагменты
// и сохраняется на сервере — дальше служит грунтом для ИИ-генерации юнитов.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, Loader2, Library, Upload, Trash2, FileText,
} from 'lucide-react';
import {
  listSources, uploadSource, deleteSource,
  type SourceDocument, type UploadChunk,
} from '@/lib/sourcesApi';
import { extractPdfText, chunkPages, chunkPlainText } from '@/lib/pdfExtract';

const LANGS = [
  { value: 'fr', label: 'Французский' },
  { value: 'en', label: 'Английский' },
  { value: 'de', label: 'Немецкий' },
  { value: 'es', label: 'Испанский' },
];

export default function SourcesPage() {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [docs, setDocs] = useState<SourceDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Загрузка
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('fr');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    if (!idToken) return;
    listSources(idToken).then(setDocs).catch(e => setError(e.message));
  };

  useEffect(refresh, [idToken]);

  const submitChunks = async (docTitle: string, chunks: UploadChunk[]) => {
    if (chunks.length === 0) {
      setError('Не удалось извлечь текст — файл пустой или это скан без текстового слоя.');
      return;
    }
    setProgress(`Сохраняю ${chunks.length} фрагментов…`);
    await uploadSource({ title: docTitle, language, chunks }, idToken);
    setTitle('');
    setPasted('');
    if (fileRef.current) fileRef.current.value = '';
    refresh();
  };

  const handleFile = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      const docTitle = title.trim() || file.name.replace(/\.(pdf|txt|md)$/i, '');
      if (/\.pdf$/i.test(file.name)) {
        const pages = await extractPdfText(file, (p, total) => setProgress(`Извлекаю текст: стр. ${p} / ${total}`));
        await submitChunks(docTitle, chunkPages(pages));
      } else {
        const text = await file.text();
        await submitChunks(docTitle, chunkPlainText(text));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить файл');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handlePaste = async () => {
    if (busy || !pasted.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await submitChunks(title.trim() || 'Вставленный текст', chunkPlainText(pasted));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить текст');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleDelete = async (doc: SourceDocument) => {
    if (!confirm(`Удалить «${doc.title}»? Фрагменты будут удалены безвозвратно.`)) return;
    try {
      await deleteSource(doc.id, idToken);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить');
    }
  };

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="flex items-center justify-between mb-6">
          <Link href="/courses" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Курсы
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[#4255ff] text-sm font-semibold">
            <Library className="w-4 h-4" /> Учебники
          </span>
        </div>

        {/* Загрузка */}
        <div className="bg-qz-card border border-border rounded-2xl p-5 mb-6">
          <p className="text-foreground text-sm font-semibold mb-1">Добавить источник</p>
          <p className="text-qz-text-muted text-xs mb-4">
            PDF или текст. Текст извлекается прямо в браузере и режется на фрагменты —
            в редакторе юнитов их можно выбирать как основу для ИИ-генерации.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-3">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Название (по умолчанию — имя файла)"
              className="bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
            />
            <select
              value={language}
              onChange={e => setLanguage(e.target.value)}
              className="bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
            >
              {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-3 flex-wrap mb-3">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Выбрать файл (PDF / TXT)
            </button>
            {progress && <span className="text-qz-text-muted text-xs">{progress}</span>}
          </div>

          <textarea
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            rows={3}
            placeholder="…или вставьте текст сюда"
            className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60 resize-y mb-2"
          />
          {pasted.trim() && (
            <button
              onClick={handlePaste}
              disabled={busy}
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 disabled:opacity-50 text-foreground text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              Сохранить текст
            </button>
          )}
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>

        {/* Список */}
        {!docs ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-qz-text-muted" /></div>
        ) : docs.length === 0 ? (
          <p className="text-qz-text-muted text-sm text-center py-6">
            Пока пусто. Загрузите учебник — и генерируйте юниты по его главам.
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map(d => (
              <div key={d.id} className="bg-qz-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <FileText className="w-4 h-4 text-[#4255ff] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-foreground text-sm font-medium line-clamp-1">{d.title}</p>
                  <p className="text-qz-text-muted text-xs">
                    {d.chunkCount} фрагм. · {LANGS.find(l => l.value === d.language)?.label ?? d.language} · {new Date(d.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(d)}
                  className="p-2 text-qz-text-muted hover:text-red-400 transition-colors shrink-0"
                  title="Удалить источник"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
