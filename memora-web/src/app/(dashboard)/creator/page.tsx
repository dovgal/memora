"use client"

import React, { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
    FileText, Sparkles, Loader2, Check, ArrowRight, BrainCircuit, FileUp, File, X,
    Trash2, RefreshCw, CheckSquare, Square, FolderPlus, FilePlus2,
} from "lucide-react"
import {
    CreatorAnalyzeRequest, CreatorAnalyzeResponse, CreatorCard, CreatorExtractMode,
    CreatorLevel, CreatorRegenerateCardRequest, CreateFlashcardRequest, FieldSchema,
    SetResponse, SetSummaryResponse, UpdateFlashcardRequest,
} from "@/types/schema"
import { processFlashcardsWithTTS } from "@/lib/ttsUtils"
import * as pdfjsLib from "pdfjs-dist"
import mammoth from "mammoth"

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Языки, для которых на бэкенде настроена озвучка (см. VOICE_BY_LANG в TtsPreviewButton
// и SetTemplateEditor) — вне этого списка используем 'default' (без привязки к голосу).
const SOURCE_LANGUAGES: { code: string; label: string }[] = [
    { code: 'auto', label: 'Определить автоматически' },
    { code: 'fr', label: 'Французский' },
    { code: 'en', label: 'Английский' },
    { code: 'ru', label: 'Русский' },
    { code: 'es', label: 'Испанский' },
    { code: 'de', label: 'Немецкий' },
];
const TRANSLATION_LANGUAGES: { code: string; label: string }[] = [
    { code: 'ru', label: 'Русский' },
    { code: 'en', label: 'Английский' },
    { code: 'fr', label: 'Французский' },
];
const LEVELS: CreatorLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1'];
const EXTRACT_MODES: { value: CreatorExtractMode; label: string }[] = [
    { value: 'both', label: 'Слова и фразы' },
    { value: 'words', label: 'Только слова' },
    { value: 'phrases', label: 'Только фразы' },
];
const MIN_COUNT = 10;
const MAX_COUNT = 40;

interface CreatorSettingsState {
    sourceLanguage: string;
    translationLanguage: string;
    level: CreatorLevel;
    extract: CreatorExtractMode;
    count: number;
    learningGoal: string;
}

const DEFAULT_SETTINGS: CreatorSettingsState = {
    sourceLanguage: 'fr',
    translationLanguage: 'ru',
    level: 'A1',
    extract: 'both',
    count: 20,
    learningGoal: '',
};

interface ReviewCard extends CreatorCard {
    id: string;
    selected: boolean;
    regenerating?: boolean;
}

/** Схема карточек модуля, созданного AI Content Creator: term/ipa/partOfSpeech
 * на лицевой стороне (с озвучкой термина), перевод и пример — на обратной. */
function buildFieldsSchema(sourceLanguage: string): FieldSchema[] {
    const termLang = SOURCE_LANGUAGES.some((l) => l.code === sourceLanguage) && sourceLanguage !== 'auto'
        ? sourceLanguage
        : 'default';
    return [
        { id: 'term', name: 'СЛОВО / ФРАЗА', type: 'text', side: 'front', order: 1, settings: { language: termLang, ttsEnabled: true } },
        { id: 'ipa', name: 'ТРАНСКРИПЦИЯ (IPA)', type: 'text', side: 'front', order: 2, settings: { language: 'default', width: 'half' } },
        { id: 'partOfSpeech', name: 'ЧАСТЬ РЕЧИ', type: 'text', side: 'front', order: 3, settings: { language: 'default', width: 'half' } },
        { id: 'definition', name: 'ПЕРЕВОД', type: 'text', side: 'back', order: 1, settings: { language: 'default' } },
        { id: 'example', name: 'ПРИМЕР ИЗ ТЕКСТА', type: 'text', side: 'back', order: 2, settings: { language: termLang } },
        { id: 'exampleTranslation', name: 'ПЕРЕВОД ПРИМЕРА', type: 'text', side: 'back', order: 3, settings: { language: 'default' } },
    ];
}

/** Добавляет в существующую схему набора недостающие поля новой партии
 * карточек (без потери уже сохранённых полей — прочие карточки набора на них ссылаются). */
function mergeFieldsSchema(existing: FieldSchema[], toAdd: FieldSchema[]): FieldSchema[] {
    const existingIds = new Set(existing.map((f) => f.id));
    const missing = toAdd.filter((f) => !existingIds.has(f.id));
    if (missing.length === 0) return existing;

    const maxOrderBySide: Record<string, number> = {};
    for (const f of existing) {
        maxOrderBySide[f.side] = Math.max(maxOrderBySide[f.side] ?? 0, f.order);
    }
    const appended = missing.map((f) => {
        const order = (maxOrderBySide[f.side] ?? 0) + 1;
        maxOrderBySide[f.side] = order;
        return { ...f, order };
    });
    return [...existing, ...appended];
}

function reviewCardToFlashcard(card: ReviewCard): CreateFlashcardRequest {
    return {
        term: card.term,
        definition: card.definition,
        fieldsData: {
            ipa: card.ipa,
            partOfSpeech: card.partOfSpeech,
            example: card.example,
            exampleTranslation: card.exampleTranslation,
        },
    };
}

export default function CreatorPage() {
    const router = useRouter()
    const { data: session } = useSession()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [step, setStep] = useState<'input' | 'analyzing' | 'review'>('input')
    const [content, setContent] = useState("")
    const [settings, setSettings] = useState<CreatorSettingsState>(DEFAULT_SETTINGS)
    const [analysis, setAnalysis] = useState<CreatorAnalyzeResponse | null>(null)
    const [reviewCards, setReviewCards] = useState<ReviewCard[]>([])
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [isSaving, setIsSaving] = useState(false)
    const [isParsing, setIsParsing] = useState(false)
    const [fileName, setFileName] = useState<string | null>(null)
    const [streamingAnalysis, setStreamingAnalysis] = useState("")
    const [analysisError, setAnalysisError] = useState<string | null>(null)

    // Назначение сохранения: новый модуль или добавление в существующий.
    const [destinationMode, setDestinationMode] = useState<'new' | 'append'>('new')
    const [existingSets, setExistingSets] = useState<SetSummaryResponse[]>([])
    const [targetSetId, setTargetSetId] = useState<string>("")

    const authHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.id_token) headers['Authorization'] = `Bearer ${session.id_token}`;
        return headers;
    }

    useEffect(() => {
        if (step !== 'review' || !session?.id_token) return;
        fetch('/api/sets', { headers: authHeaders() })
            .then((res) => (res.ok ? res.json() : []))
            .then((sets: SetSummaryResponse[]) => setExistingSets(sets))
            .catch(() => setExistingSets([]));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, session?.id_token])

    const handleAnalyze = async () => {
        if (!content.trim()) return
        setStep('analyzing')
        setStreamingAnalysis("")
        setAnalysisError(null)

        try {
            const payload: CreatorAnalyzeRequest = {
                content,
                sourceLanguage: settings.sourceLanguage === 'auto' ? '' : settings.sourceLanguage,
                translationLanguage: settings.translationLanguage,
                level: settings.level,
                extract: settings.extract,
                count: settings.count,
                learningGoal: settings.learningGoal,
            };

            const response = await fetch('/api/ai/creator/analyze', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload)
            });

            if (!response.ok || !response.body) {
                throw new Error("Analysis failed");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            let eventName = "message";
            let dataLines: string[] = [];
            let result: CreatorAnalyzeResponse | null = null;
            let streamError: string | null = null;

            const dispatch = () => {
                const data = dataLines.join("\n");
                dataLines = [];
                if (data === "") { eventName = "message"; return; }
                if (eventName === "result") {
                    try { result = JSON.parse(data); } catch { streamError = "Не удалось разобрать результат анализа."; }
                } else if (eventName === "error") {
                    streamError = data || "Ошибка анализа.";
                } else {
                    setStreamingAnalysis((prev) => prev + data);
                }
                eventName = "message";
            };

            // Ручной SSE-парсер (не EventSource — тому нельзя передать заголовок
            // Authorization): построчно разбираем "event:"/"data:", событие
            // завершается пустой строкой, как того требует формат SSE.
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                let idx: number;
                while ((idx = buf.indexOf("\n")) !== -1) {
                    const line = buf.slice(0, idx).replace(/\r$/, "");
                    buf = buf.slice(idx + 1);
                    if (line === "") { dispatch(); continue; }
                    if (line.startsWith("event:")) {
                        eventName = line.slice(6).trim();
                    } else if (line.startsWith("data:")) {
                        dataLines.push(line.startsWith("data: ") ? line.slice(6) : line.slice(5));
                    }
                }
            }
            if (dataLines.length > 0) dispatch();

            if (streamError) throw new Error(streamError);
            if (!result) throw new Error("Пустой ответ анализа.");

            const finalResult = result as CreatorAnalyzeResponse;
            setAnalysis(finalResult);
            setTitle(finalResult.proposedTitle);
            setDescription(finalResult.proposedDescription);
            setReviewCards(finalResult.cards.map((c, i) => ({ ...c, id: `card-${i}-${Date.now()}`, selected: true })));
            setStep('review');
        } catch (e) {
            console.error(e);
            setAnalysisError(e instanceof Error ? e.message : "Ошибка анализа. Возможно, документ слишком большой.");
            setStep('input');
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsParsing(true)
        setFileName(file.name)

        try {
            const extension = file.name.split('.').pop()?.toLowerCase()
            let extractedText = ""

            if (extension === 'pdf') {
                const arrayBuffer = await file.arrayBuffer()
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
                let fullText = ""
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i)
                    const textContent = await page.getTextContent()
                    const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(" ")
                    fullText += pageText + "\n"
                }
                extractedText = fullText
            } else if (extension === 'docx') {
                const arrayBuffer = await file.arrayBuffer()
                const result = await mammoth.extractRawText({ arrayBuffer })
                extractedText = result.value
            } else {
                // txt, md
                extractedText = await file.text()
            }

            setContent(extractedText)
        } catch (error) {
            console.error("Error parsing file:", error)
            alert("Не удалось прочитать файл. Попробуйте скопировать текст вручную.")
            setFileName(null)
        } finally {
            setIsParsing(false)
        }
    }

    const removeFile = () => {
        setFileName(null)
        setContent("")
        if (fileInputRef.current) fileInputRef.current.value = ""
    }

    // ---------- Обзор: редактирование карточек ----------

    const updateCard = (id: string, patch: Partial<ReviewCard>) => {
        setReviewCards((cards) => cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    }

    const removeCard = (id: string) => {
        setReviewCards((cards) => cards.filter((c) => c.id !== id));
    }

    const toggleAll = (selected: boolean) => {
        setReviewCards((cards) => cards.map((c) => ({ ...c, selected })));
    }

    const regenerateCard = async (id: string) => {
        const target = reviewCards.find((c) => c.id === id);
        if (!target) return;
        updateCard(id, { regenerating: true });
        try {
            const payload: CreatorRegenerateCardRequest = {
                content,
                sourceLanguage: settings.sourceLanguage === 'auto' ? '' : settings.sourceLanguage,
                translationLanguage: settings.translationLanguage,
                level: settings.level,
                extract: settings.extract,
                learningGoal: settings.learningGoal,
                term: target.term,
                avoidTerms: reviewCards.filter((c) => c.id !== id).map((c) => c.term),
            };
            const res = await fetch('/api/ai/creator/regenerate-card', {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || "Не удалось перегенерировать карточку.");
            }
            const card: CreatorCard = await res.json();
            updateCard(id, { ...card, regenerating: false });
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : "Не удалось перегенерировать карточку.");
            updateCard(id, { regenerating: false });
        }
    }

    const handleSave = async () => {
        const selected = reviewCards.filter((c) => c.selected);
        if (selected.length === 0) return;
        if (destinationMode === 'append' && !targetSetId) {
            alert("Выберите модуль, в который добавить карточки.");
            return;
        }

        setIsSaving(true)
        try {
            const newSchema = buildFieldsSchema(settings.sourceLanguage);
            const newFlashcards = selected.map(reviewCardToFlashcard);

            if (destinationMode === 'new') {
                const processed = await processFlashcardsWithTTS(newFlashcards, newSchema);
                const res = await fetch('/api/sets', {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify({
                        title: title.trim() || analysis?.proposedTitle || "Новый модуль",
                        description: description.trim(),
                        isPublic: false,
                        fieldsSchema: newSchema,
                        flashcards: processed,
                    }),
                });
                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || res.statusText);
                }
                const newSet = await res.json();
                router.push(`/set/${newSet.id}`);
                return;
            }

            // Добавление в существующий модуль: подгружаем его целиком, чтобы не
            // потерять уже сохранённые карточки, и расширяем его схему полей
            // недостающими (example/ipa/partOfSpeech), не трогая существующие.
            const getRes = await fetch(`/api/sets/${targetSetId}`, { headers: authHeaders() });
            if (!getRes.ok) throw new Error("Не удалось загрузить модуль назначения.");
            const existingSet: SetResponse = await getRes.json();

            const mergedSchema = mergeFieldsSchema(existingSet.fieldsSchema, newSchema);
            const existingFlashcards: UpdateFlashcardRequest[] = existingSet.flashcards.map((fc) => ({
                id: fc.id,
                term: fc.term,
                definition: fc.definition,
                imageUrl: fc.imageUrl,
                fieldsData: fc.fieldsData,
            }));
            const allFlashcards: UpdateFlashcardRequest[] = [...existingFlashcards, ...newFlashcards];
            const processed = await processFlashcardsWithTTS(allFlashcards, mergedSchema);

            const res = await fetch(`/api/sets/${targetSetId}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify({
                    title: existingSet.title,
                    description: existingSet.description ?? '',
                    // Дописываем карточки, а не меняем доступ: общий модуль должен остаться общим.
                    isPublic: existingSet.isPublic,
                    fieldsSchema: mergedSchema,
                    flashcards: processed.map((c, i) => ({ id: allFlashcards[i].id, ...c })),
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || res.statusText);
            }
            router.push(`/set/${targetSetId}`);
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : "Ошибка при сохранении.");
        } finally {
            setIsSaving(false)
        }
    }

    if (step === 'analyzing') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[80vh]">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-[#4255ff] rounded-full blur-3xl opacity-20 animate-pulse" />
                    <BrainCircuit size={80} className="text-qz-accent relative animate-bounce" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Магия в процессе...</h2>
                <div className="bg-qz-bg/50 border border-white/5 rounded-2xl p-6 mb-4 w-full max-w-2xl text-left font-mono text-sm overflow-hidden h-40 relative">
                    <div className="text-zinc-500 whitespace-pre-wrap">{streamingAnalysis || "Инициализация анализа..."}</div>
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-zinc-900/90 to-transparent" />
                </div>
                <p className="text-qz-text-muted max-w-md mx-auto leading-relaxed">
                    AI анализирует ваш контент и извлекает карточки с учётом выбранных настроек. Это может занять время для больших документов.
                </p>
                <div className="mt-8 flex gap-2">
                    <div className="w-2 h-2 bg-[#4255ff] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-[#4255ff] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-[#4255ff] rounded-full animate-bounce" />
                </div>
            </div>
        )
    }

    if (step === 'review' && analysis) {
        const selectedCount = reviewCards.filter((c) => c.selected).length;
        const allSelected = reviewCards.length > 0 && selectedCount === reviewCards.length;

        return (
            <div className="max-w-5xl mx-auto w-full p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
                <div className="mb-8 space-y-4">
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-transparent text-4xl font-semibold mb-1 focus:outline-none border-b-2 border-transparent focus:border-indigo-500 transition-colors"
                        placeholder="Название модуля"
                    />
                    <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-transparent text-lg text-qz-text-muted focus:outline-none border-b-2 border-transparent focus:border-indigo-500 transition-colors"
                        placeholder="Описание (необязательно)"
                    />
                    {(analysis.skippedDuplicates > 0 || analysis.skippedInvalid > 0) && (
                        <p className="text-sm text-zinc-500">
                            Пропущено {analysis.skippedDuplicates} дублей и {analysis.skippedInvalid} нерелевантных карточек.
                        </p>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 bg-qz-bg/40 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => toggleAll(!allSelected)}
                            className="flex items-center gap-2 text-sm font-bold text-qz-text-muted hover:text-qz-text transition-colors"
                        >
                            {allSelected ? <CheckSquare size={18} className="text-qz-accent" /> : <Square size={18} />}
                            {allSelected ? "Снять выделение" : "Выделить все"}
                        </button>
                        <span className="text-sm text-zinc-500">Выбрано {selectedCount} из {reviewCards.length}</span>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex bg-white/5 rounded-xl p-1">
                            <button
                                type="button"
                                onClick={() => setDestinationMode('new')}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${destinationMode === 'new' ? 'bg-[#4255ff] text-white' : 'text-qz-text-muted hover:text-qz-text'}`}
                            >
                                <FilePlus2 size={14} /> Новый модуль
                            </button>
                            <button
                                type="button"
                                onClick={() => setDestinationMode('append')}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${destinationMode === 'append' ? 'bg-[#4255ff] text-white' : 'text-qz-text-muted hover:text-qz-text'}`}
                            >
                                <FolderPlus size={14} /> В существующий
                            </button>
                        </div>
                        {destinationMode === 'append' && (
                            <select
                                value={targetSetId}
                                onChange={(e) => setTargetSetId(e.target.value)}
                                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-qz-text focus:outline-none focus:border-indigo-500"
                            >
                                <option value="">Выберите модуль...</option>
                                {existingSets.map((s) => (
                                    <option key={s.id} value={s.id}>{s.title} ({s.flashcardCount})</option>
                                ))}
                            </select>
                        )}
                        <button
                            onClick={handleSave}
                            disabled={isSaving || selectedCount === 0}
                            className="bg-[#4255ff] hover:bg-[#4255ff] text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-xl transition-all disabled:opacity-50"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                            Сохранить ({selectedCount})
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reviewCards.map((card) => (
                        <div
                            key={card.id}
                            className={`bg-qz-bg/50 border p-5 rounded-2xl flex flex-col gap-3 transition-colors ${card.selected ? 'border-indigo-500/40' : 'border-white/5 opacity-60'}`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateCard(card.id, { selected: !card.selected })}
                                    className="mt-1 text-qz-text-muted hover:text-qz-accent transition-colors shrink-0"
                                    aria-label="Выбрать карточку"
                                >
                                    {card.selected ? <CheckSquare size={18} className="text-qz-accent" /> : <Square size={18} />}
                                </button>
                                <div className="flex-1 min-w-0 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            value={card.term}
                                            onChange={(e) => updateCard(card.id, { term: e.target.value })}
                                            className="flex-1 min-w-0 bg-transparent text-xl font-bold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                            placeholder="Термин"
                                        />
                                        {card.ipa && <span className="text-xs text-zinc-500 shrink-0">{card.ipa}</span>}
                                    </div>
                                    <input
                                        value={card.definition}
                                        onChange={(e) => updateCard(card.id, { definition: e.target.value })}
                                        className="w-full bg-transparent text-zinc-400 focus:outline-none border-b border-transparent focus:border-indigo-500"
                                        placeholder="Перевод"
                                    />
                                    {card.partOfSpeech && (
                                        <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-qz-accent bg-[#4255ff]/10 px-2 py-0.5 rounded-full">
                                            {card.partOfSpeech}
                                        </span>
                                    )}
                                    {(card.example || card.exampleTranslation) && (
                                        <div className="text-xs text-zinc-500 border-t border-white/5 pt-2 space-y-1">
                                            <textarea
                                                value={card.example}
                                                onChange={(e) => updateCard(card.id, { example: e.target.value })}
                                                className="w-full bg-transparent italic focus:outline-none resize-none"
                                                rows={1}
                                                placeholder="Пример из текста"
                                            />
                                            <textarea
                                                value={card.exampleTranslation}
                                                onChange={(e) => updateCard(card.id, { exampleTranslation: e.target.value })}
                                                className="w-full bg-transparent focus:outline-none resize-none"
                                                rows={1}
                                                placeholder="Перевод примера"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => regenerateCard(card.id)}
                                        disabled={card.regenerating}
                                        title="Перегенерировать карточку"
                                        className="p-1.5 text-zinc-500 hover:text-qz-accent transition-colors disabled:opacity-50"
                                    >
                                        {card.regenerating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeCard(card.id)}
                                        title="Удалить карточку"
                                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto w-full p-6 py-12">
            <div className="mb-12 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4255ff]/10 border border-indigo-500/20 text-qz-accent text-sm font-bold mb-6">
                    <Sparkles size={16} /> AI Content Creator
                </div>
                <h1 className="text-5xl font-semibold mb-6 tracking-tight">Создавайте за секунды.</h1>
                <p className="text-xl text-qz-text-muted leading-relaxed max-w-2xl mx-auto">
                    Загрузите PDF, Word или вставьте текст. Наш AI превратит это в полноценный учебный модуль.
                </p>
            </div>

            <div className="space-y-8 bg-qz-bg/30 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-sm shadow-2xl">

                {analysisError && (
                    <div className="p-4 bg-red-900/40 border border-red-500 text-red-200 rounded-xl">
                        {analysisError}
                    </div>
                )}

                {/* Content Input Area */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                            <FileText size={16} /> Ваш контент
                        </label>

                        <div className="flex gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".pdf,.docx,.txt,.md"
                                onChange={handleFileUpload}
                            />
                            {fileName ? (
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#4255ff]/20 border border-indigo-500/30 rounded-full text-xs font-bold text-qz-accent animate-in zoom-in-95">
                                    <File size={14} /> {fileName}
                                    <button onClick={removeFile} className="hover:text-qz-text"><X size={14} /></button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold text-qz-text-muted transition-all"
                                >
                                    <FileUp size={14} /> Загрузить файл
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative group">
                        {isParsing && (
                            <div className="absolute inset-0 bg-qz-bg/60 backdrop-blur-[2px] z-10 rounded-3xl flex flex-col items-center justify-center animate-in fade-in">
                                <Loader2 className="animate-spin text-[#4255ff] mb-2" size={32} />
                                <span className="text-sm font-bold text-qz-text">Читаем документ...</span>
                            </div>
                        )}
                        <textarea
                            className="w-full bg-qz-bg/40 border-2 border-white/5 rounded-3xl p-8 h-64 focus:border-indigo-500 outline-none transition-all resize-none text-lg leading-relaxed shadow-inner placeholder:text-zinc-700"
                            placeholder="Вставьте здесь текст книги, субтитры или сценарий. Чем больше контекста, тем лучше результат."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>
                </div>

                {/* Settings */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Язык текста</label>
                        <select
                            value={settings.sourceLanguage}
                            onChange={(e) => setSettings((s) => ({ ...s, sourceLanguage: e.target.value }))}
                            className="w-full bg-qz-bg/40 border-2 border-white/5 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all"
                        >
                            {SOURCE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Язык перевода</label>
                        <select
                            value={settings.translationLanguage}
                            onChange={(e) => setSettings((s) => ({ ...s, translationLanguage: e.target.value }))}
                            className="w-full bg-qz-bg/40 border-2 border-white/5 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none transition-all"
                        >
                            {TRANSLATION_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Уровень (CEFR)</label>
                        <div className="flex gap-2">
                            {LEVELS.map((lvl) => (
                                <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setSettings((s) => ({ ...s, level: lvl }))}
                                    className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all border ${settings.level === lvl ? 'bg-[#4255ff]/20 border-indigo-500 text-qz-accent' : 'bg-white/5 border-transparent text-qz-text-muted hover:bg-white/10'}`}
                                >
                                    {lvl}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase">Что извлекать</label>
                        <div className="flex gap-2">
                            {EXTRACT_MODES.map((m) => (
                                <button
                                    key={m.value}
                                    type="button"
                                    onClick={() => setSettings((s) => ({ ...s, extract: m.value }))}
                                    className={`flex-1 py-3 px-2 rounded-xl text-xs font-bold transition-all border ${settings.extract === m.value ? 'bg-[#4255ff]/20 border-indigo-500 text-qz-accent' : 'bg-white/5 border-transparent text-qz-text-muted hover:bg-white/10'}`}
                                >
                                    {m.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase flex justify-between">
                            <span>Количество карточек</span>
                            <span className="text-qz-accent">{settings.count}</span>
                        </label>
                        <input
                            type="range"
                            min={MIN_COUNT}
                            max={MAX_COUNT}
                            value={settings.count}
                            onChange={(e) => setSettings((s) => ({ ...s, count: Number(e.target.value) }))}
                            className="w-full accent-[#4255ff]"
                        />
                    </div>
                </div>

                {/* Learning goal */}
                <div className="space-y-4">
                    <label className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                        <ArrowRight size={16} /> Цель обучения (необязательно)
                    </label>
                    <div className="relative group">
                        <input
                            type="text"
                            className="w-full bg-qz-bg/40 border-2 border-white/5 rounded-2xl p-6 focus:border-indigo-500 outline-none transition-all text-xl font-medium placeholder:text-zinc-700"
                            placeholder="Например: 'Выдели 20 самых полезных фраз для ресторана'..."
                            value={settings.learningGoal}
                            onChange={(e) => setSettings((s) => ({ ...s, learningGoal: e.target.value }))}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-[#4255ff]/10 rounded-xl">
                            <Sparkles size={20} className="text-[#4255ff]/50" />
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleAnalyze}
                    disabled={!content.trim() || isParsing}
                    className="w-full bg-[#4255ff] hover:bg-[#4255ff] text-white py-6 rounded-2xl font-semibold text-xl flex items-center justify-center gap-3 shadow-2xl transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    <BrainCircuit className="group-hover:rotate-12 transition-transform" />
                    Анализировать контент
                </button>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { icon: <FileText className="text-blue-400" />, title: "PDF & Docs", desc: "Поддержка учебников и конспектов" },
                    { icon: <BrainCircuit className="text-qz-accent" />, title: "Smart Extraction", desc: "AI находит только то, что реально есть в тексте" },
                    { icon: <Sparkles className="text-amber-400" />, title: "Instant Sets", desc: "Готовый модуль с переводом, IPA и примерами" }
                ].map((feature, i) => (
                    <div key={i} className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                        <div className="mb-3">{feature.icon}</div>
                        <div className="font-bold mb-1 text-qz-text">{feature.title}</div>
                        <div className="text-sm text-zinc-500 leading-relaxed">{feature.desc}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}
