"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useSession } from "next-auth/react"
import { Plus, Trash2, Save, Loader2, Image as ImageIcon, Sparkles, Upload, FileDown, X, Settings2, Info, ChevronRight } from "lucide-react"

import { FieldSchema } from "@/types/schema"
import SetTemplateEditor from "@/components/SetTemplateEditor"
import DynamicFieldRenderer from "@/components/DynamicFieldRenderer"
import { processFlashcardsWithTTS } from "@/lib/ttsUtils"

// Zod schema for form validation
const flashcardSchema = z.object({
    term: z.string().optional(),
    definition: z.string().optional(),
    imageUrl: z.string().nullable().optional(),
    fieldsData: z.record(z.string(), z.any()).optional(),
})

const createSetSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(255),
    description: z.string().optional(),
    isPublic: z.boolean(),
    fieldsSchema: z.any(),
    flashcards: z.array(flashcardSchema).min(2, "You must provide at least 2 flashcards"),
})

type CreateSetFormValues = z.infer<typeof createSetSchema>

const DEFAULT_SCHEMA: FieldSchema[] = [
    { id: 'term', name: 'ТЕРМИН', type: 'text', side: 'front', order: 1, settings: { language: 'default' } },
    { id: 'definition', name: 'ОПРЕДЕЛЕНИЕ', type: 'text', side: 'back', order: 1, settings: { language: 'default' } }
];

export default function CreateSetPage() {
    const router = useRouter()
    // Extract optional folderId from query string
    const [folderId, setFolderId] = useState<string | null>(null);

    useEffect(() => {
        // Read the query string after mount to avoid hydration mismatch
        const params = new URLSearchParams(window.location.search);
        setFolderId(params.get("folderId"));
        if (params.get("openImport") === "true") {
            setIsImportOpen(true);
        }
    }, []);

    const { data: session } = useSession()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)

    // Template Editor State
    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false)

    // Import states
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [importText, setImportText] = useState("")
    const [termSeparator, setTermSeparator] = useState('\t')
    const [cardSeparator, setCardSeparator] = useState('\n')
    const [customTermSeparator, setCustomTermSeparator] = useState('')
    const [customCardSeparator, setCustomCardSeparator] = useState('')

    // AI Image states
    const [isGeneratingImage, setIsGeneratingImage] = useState<Record<number, boolean>>({})
    const [imageError, setImageError] = useState<string | null>(null)

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        getValues,
        formState: { errors },
    } = useForm<CreateSetFormValues>({
        resolver: zodResolver(createSetSchema),
        defaultValues: {
            title: "",
            description: "",
            isPublic: false,
            fieldsSchema: DEFAULT_SCHEMA,
            flashcards: [
                { term: "", definition: "", imageUrl: null, fieldsData: {} },
                { term: "", definition: "", imageUrl: null, fieldsData: {} },
            ],
        },
    })

    // Dynamic field array for flashcards
    const { fields, append, remove, replace, update } = useFieldArray({
        name: "flashcards",
        control,
    })

    const currentSchema: FieldSchema[] = watch('fieldsSchema') || DEFAULT_SCHEMA;
    const frontFields = currentSchema.filter((f) => f.side === 'front').sort((a, b) => a.order - b.order);
    const backFields = currentSchema.filter((f) => f.side === 'back').sort((a, b) => a.order - b.order);
    const orderedTextFields = useMemo(() => [...frontFields, ...backFields].filter(f => f.type === 'text'), [frontFields, backFields]);

    const onSubmit = async (data: CreateSetFormValues) => {
        setIsSubmitting(true)
        setSubmitError(null)

        try {
            const processedFlashcards = await processFlashcardsWithTTS(data.flashcards, currentSchema);

            const payload = {
                ...data,
                fieldsSchema: currentSchema,
                flashcards: processedFlashcards.map((card: any) => ({
                    ...card,
                    term: card.term || "",
                    definition: card.definition || "",
                    fieldsData: card.fieldsData || {}
                }))
            };

            const res = await fetch("/api/sets", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(session && (session as any).id_token ? { "Authorization": `Bearer ${(session as any).id_token}` } : {})
                },
                body: JSON.stringify(payload),
            })

            const responseData = await res.json()

            if (!res.ok) {
                throw new Error(responseData.error || "Failed to create set")
            }

            // If a folderId was provided in the query string, add the new set to that folder
            if (folderId && session && (session as any).id_token) {
                try {
                    await fetch(`/api/folders/${folderId}/sets`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${(session as any).id_token}`,
                        },
                        body: JSON.stringify({ setId: responseData.id }),
                    })
                } catch (e) {
                    console.error("Failed to add set to folder:", e)
                }
            }

            // Navigate to the newly created set viewing page
            router.push(`/set/${responseData.id}`)
        } catch (err: any) {
            setSubmitError(err.message)
            setIsSubmitting(false)
        }
    }

    const effectiveTermSeparator = termSeparator === 'custom' ? customTermSeparator : termSeparator;
    const effectiveCardSeparator = cardSeparator === 'custom' ? customCardSeparator : cardSeparator;

    const parsedImportPreview = useMemo(() => {
        if (!importText.trim() || !effectiveTermSeparator || !effectiveCardSeparator) return [];

        const cardStrings = importText.split(effectiveCardSeparator).filter(c => c.trim().length > 0);
        
        return cardStrings.map(cardStr => {
            const parts = cardStr.split(effectiveTermSeparator).map(p => p.trim());
            const cardData: any = { term: "", definition: "", imageUrl: null, fieldsData: {} };

            orderedTextFields.forEach((field, i) => {
                let value = "";
                if (i < parts.length) {
                    // If it's the last field but there are more parts, join remaining parts
                    if (i === orderedTextFields.length - 1 && parts.length > orderedTextFields.length) {
                        value = parts.slice(i).join(effectiveTermSeparator);
                    } else {
                        value = parts[i];
                    }
                }

                if (field.id === 'term') cardData.term = value;
                else if (field.id === 'definition') cardData.definition = value;
                else cardData.fieldsData[field.id] = value;
            });

            return cardData;
        });
    }, [importText, effectiveTermSeparator, effectiveCardSeparator, orderedTextFields]);

    const handleImport = () => {
        if (parsedImportPreview.length > 0) {
            replace(parsedImportPreview);
        }
        setIsImportOpen(false);
        setImportText("");
    };

    const handleGenerateImage = async (index: number) => {
        const currentCards = control._formValues.flashcards;
        const term = currentCards[index]?.term;
        const def = currentCards[index]?.definition || "";

        if (!term) {
            setImageError("Please enter a term first to generate an image.");
            setTimeout(() => setImageError(null), 3000);
            return;
        }

        setIsGeneratingImage(prev => ({ ...prev, [index]: true }));
        setImageError(null);

        try {
            const prompt = `${term} - ${def}`;
            const res = await fetch("/api/images/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(session && (session as any).id_token ? { "Authorization": `Bearer ${(session as any).id_token}` } : {})
                },
                body: JSON.stringify({ prompt }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to generate image");
            }

            const data = await res.json();

            update(index, { ...currentCards[index], imageUrl: data.url });

        } catch (err: any) {
            setImageError(err.message);
            setTimeout(() => setImageError(null), 3000);
        } finally {
            setIsGeneratingImage(prev => ({ ...prev, [index]: false }));
        }
    };

    const handleImageUpload = (index: number, file: File) => {
        if (!file.type.startsWith('image/')) {
            setImageError("Please upload a valid image file.");
            setTimeout(() => setImageError(null), 3000);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setImageError("Image must be smaller than 5MB.");
            setTimeout(() => setImageError(null), 3000);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target && typeof e.target.result === 'string') {
                update(index, { ...control._formValues.flashcards[index], imageUrl: e.target.result });
            }
        };
        reader.onerror = () => {
            setImageError("Failed to read image file.");
            setTimeout(() => setImageError(null), 3000);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="min-h-screen bg-black text-white p-6 md:p-12 relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900 rounded-full mix-blend-multiply filter blur-[150px] opacity-30 pointer-events-none"></div>

            <div className="max-w-4xl mx-auto relative z-10">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-semibold text-white">Create a new study set</h1>
                        <p className="text-zinc-400 mt-2">Add term and definition pairs to generate flashcards.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsTemplateEditorOpen(true)}
                            className="flex items-center gap-2 bg-[#0a092d] hover:bg-[#2e3856] text-[#ffcd1f] font-semibold py-3 px-6 rounded-xl transition-all border border-indigo-500/30 hover:border-indigo-500 shadow-sm"
                        >
                            <Settings2 size={20} />
                            <span className="hidden sm:inline">Параметры карточек</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/creator')}
                            className="flex items-center gap-2 bg-[#4255ff]/10 hover:bg-[#4255ff]/20 text-[#ffcd1f] font-bold py-3 px-6 rounded-xl transition-all border border-indigo-500/40 hover:border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)] group"
                        >
                            <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                            <span className="hidden sm:inline">AI Генератор</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsImportOpen(true)}
                            className="flex items-center gap-2 bg-[#0a092d] hover:bg-[#2e3856] text-white font-semibold py-3 px-6 rounded-xl transition-all border border-[#586380] hover:border-zinc-500 shadow-sm"
                        >
                            <FileDown size={20} />
                            <span className="hidden sm:inline">Импорт</span>
                        </button>
                        <button
                            onClick={handleSubmit(onSubmit)}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-[#4255ff] hover:bg-[#4255ff] text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {isSubmitting ? "Saving..." : "Create Set"}
                        </button>
                    </div>
                </header>

                {submitError && (
                    <div className="mb-6 p-4 bg-red-900/40 border border-red-500 text-red-200 rounded-xl">
                        {submitError}
                    </div>
                )}

                {imageError && (
                    <div className="mb-6 p-4 bg-red-900/40 border border-red-500 text-red-200 rounded-xl animate-in fade-in">
                        {imageError}
                    </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                    <section className="bg-[#0a092d]/60 backdrop-blur border border-[#2e3856] p-6 sm:p-8 rounded-2xl flex flex-col gap-6">
                        <div>
                            <input
                                type="text"
                                placeholder="Enter a title, like 'Biology - Chapter 22: Evolution'"
                                {...register("title")}
                                className="w-full bg-transparent border-b-2 border-[#586380] text-2xl font-bold p-2 focus:outline-none focus:border-indigo-500 transition-colors text-white placeholder:text-zinc-600"
                            />
                            {errors.title && <p className="text-red-400 text-sm mt-2">{errors.title.message}</p>}
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="Add a description (optional)"
                                {...register("description")}
                                className="w-full bg-transparent border-b-2 border-[#586380] text-lg p-2 focus:outline-none focus:border-indigo-500 transition-colors text-zinc-300 placeholder:text-zinc-600"
                            />
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                {...register("isPublic")}
                                className="w-5 h-5 rounded border-[#586380] bg-[#2e3856] text-[#4255ff] focus:ring-indigo-500/50"
                            />
                            <span className="text-zinc-300">Make this set visible to everyone</span>
                        </label>
                    </section>

                    <div className="space-y-6">
                        {fields.map((field, index) => (
                            <div
                                key={field.id}
                                className="bg-[#0a092d]/80 backdrop-blur border border-[#2e3856] p-6 rounded-2xl transition-colors hover:border-[#586380] relative group"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        handleImageUpload(index, e.dataTransfer.files[0]);
                                    }
                                }}
                                onPaste={(e) => {
                                    const items = e.clipboardData.items;
                                    for (let i = 0; i < items.length; i++) {
                                        if (items[i].type.indexOf('image') !== -1) {
                                            const file = items[i].getAsFile();
                                            if (file) {
                                                e.preventDefault();
                                                handleImageUpload(index, file);
                                            }
                                        }
                                    }
                                }}
                            >
                                <div className="flex justify-between items-center mb-4 border-b border-[#2e3856] pb-2">
                                    <span className="font-bold text-zinc-500 select-none">{index + 1}</span>
                                    {fields.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                                            aria-label="Remove card"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-col md:flex-row gap-6">
                                    {/* FRONT SIDE */}
                                    <div className="flex-1 flex flex-col gap-4 border-r border-[#2e3856]/50 pr-4">
                                        <div className="text-sm font-bold text-zinc-600 mb-2">Лицевая сторона</div>
                                        {frontFields.map(f => (
                                            <DynamicFieldRenderer
                                                key={f.id}
                                                field={f}
                                                index={index}
                                                register={register}
                                                errors={errors}
                                                update={update}
                                                getValues={getValues}
                                            />
                                        ))}
                                    </div>

                                    {/* BACK SIDE */}
                                    <div className="flex-1 flex flex-col gap-4 pl-2">
                                        <div className="text-sm font-bold text-zinc-600 mb-2">Обратная сторона</div>
                                        {backFields.map(f => (
                                            <DynamicFieldRenderer
                                                key={f.id}
                                                field={f}
                                                index={index}
                                                register={register}
                                                errors={errors}
                                                update={update}
                                                getValues={getValues}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {errors.flashcards?.message && typeof errors.flashcards.message === 'string' && (
                            <p className="text-red-400 font-semibold">{errors.flashcards.message}</p>
                        )}
                    </div>

                    <div className="flex justify-center pb-20">
                        <button
                            type="button"
                            onClick={() => append({ term: "", definition: "" })}
                            className="group flex items-center justify-center gap-2 w-full md:w-auto bg-[#0a092d] border-2 border-dashed border-[#586380] hover:border-indigo-500 text-zinc-400 hover:text-[#ffcd1f] font-bold py-6 px-12 rounded-2xl transition-all"
                        >
                            <Plus size={24} className="group-hover:scale-110 transition-transform" />
                            ADD CARD
                        </button>
                    </div>
                </form>
            </div>

            {/* Import Modal */}
            {isImportOpen && (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-5xl h-[90vh] bg-[#0a092d] rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(79,70,229,0.2)] border border-white/10 flex flex-col animate-in fade-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#0a092d]/50">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <FileDown className="text-[#ffcd1f]" /> Импортировать данные
                                </h2>
                                <p className="text-zinc-500 text-sm mt-1">Скопируйте и вставьте свои данные (из Word, Excel, Google Docs и т.п.)</p>
                            </div>
                            <button
                                onClick={() => setIsImportOpen(false)}
                                className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-zinc-400 hover:text-white group"
                            >
                                <X size={24} className="group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>

                        {/* Content Split Layout */}
                        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                            {/* Left: Input */}
                            <div className="flex-1 flex flex-col p-6 border-r border-white/5">
                                <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    Вставьте текст сюда
                                    <Info size={14} className="text-[#4255ff]/50" />
                                </label>
                                <textarea
                                    value={importText}
                                    onChange={(e) => setImportText(e.target.value)}
                                    placeholder="Слово 1   Определение 1&#10;Слово 2   Определение 2&#10;Слово 3   Определение 3"
                                    className="flex-1 w-full bg-[#111122] border border-[#2e3856] rounded-2xl p-6 text-white text-lg font-medium focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none placeholder:text-zinc-700 custom-scrollbar shadow-inner"
                                />
                            </div>

                            {/* Right: Settings & Preview */}
                            <div className="w-full md:w-[400px] flex flex-col bg-[#050510]">
                                {/* Settings */}
                                <div className="p-6 space-y-8 border-b border-white/5">
                                    {/* Term Separator */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Между термином и определением</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: 'Tab', value: '\t' },
                                                { label: 'Запятая', value: ',' },
                                                { label: 'Дефис', value: '-' },
                                                { label: 'Свой', value: 'custom' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.label}
                                                    onClick={() => setTermSeparator(opt.value)}
                                                    className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                                                        termSeparator === opt.value
                                                            ? 'bg-[#4255ff]/20 border-indigo-500 text-[#ffcd1f] shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                                            : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        {termSeparator === 'custom' && (
                                            <input
                                                type="text"
                                                value={customTermSeparator}
                                                onChange={(e) => setCustomTermSeparator(e.target.value)}
                                                placeholder="Введите символ..."
                                                className="w-full bg-white/5 border border-indigo-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                        )}
                                    </div>

                                    {/* Card Separator */}
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Между карточками</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: 'Разрыв строки', value: '\n' },
                                                { label: 'Точка с запятой', value: ';' },
                                                { label: 'Свой', value: 'custom' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.label}
                                                    onClick={() => setCardSeparator(opt.value)}
                                                    className={`py-3 px-4 rounded-xl text-sm font-bold transition-all border ${
                                                        cardSeparator === opt.value
                                                            ? 'bg-[#4255ff]/20 border-indigo-500 text-[#ffcd1f] shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                                            : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                        {cardSeparator === 'custom' && (
                                            <input
                                                type="text"
                                                value={customCardSeparator}
                                                onChange={(e) => setCustomCardSeparator(e.target.value)}
                                                placeholder="Введите символ..."
                                                className="w-full bg-white/5 border border-indigo-500/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Preview Stats */}
                                <div className="flex-1 p-6 flex flex-col justify-between">
                                    <div className="space-y-4">
                                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Предварительный просмотр</h3>
                                        {parsedImportPreview.length > 0 ? (
                                            <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                                {parsedImportPreview.slice(0, 5).map((card, i) => (
                                                    <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors">
                                                        <div className="flex items-center gap-2 text-xs font-bold text-[#ffcd1f] mb-1">
                                                            <span className="opacity-50">#{i + 1}</span>
                                                            {card.term || <span className="text-zinc-600 italic">Пусто</span>}
                                                        </div>
                                                        <div className="text-sm text-zinc-300 truncate">
                                                            {card.definition || <span className="text-zinc-600 italic">Нет определения</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                                {parsedImportPreview.length > 5 && (
                                                    <p className="text-center text-xs text-zinc-600 font-bold py-2">
                                                        ...и еще {parsedImportPreview.length - 5} карточек
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-12 text-zinc-600 border-2 border-dashed border-white/5 rounded-2xl">
                                                <Sparkles size={32} className="mb-2 opacity-50" />
                                                <p className="text-sm font-medium">Введите данные для превью</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-[#4255ff]/10 border border-indigo-500/20 p-4 rounded-2xl flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-2xl font-semibold text-white">{parsedImportPreview.length}</span>
                                            <span className="text-[10px] font-bold text-[#ffcd1f] uppercase tracking-tighter">Будет создано</span>
                                        </div>
                                        <ChevronRight size={24} className="text-[#4255ff]" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-black border-t border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-zinc-500">
                                <div className="w-2 h-2 rounded-full bg-[#4255ff] animate-pulse"></div>
                                <span className="text-xs font-bold uppercase tracking-widest">Система готова к импорту</span>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsImportOpen(false)}
                                    className="px-8 py-4 rounded-xl font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all text-sm uppercase tracking-widest"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={parsedImportPreview.length === 0}
                                    className="px-8 py-4 rounded-xl font-semibold bg-[#4255ff] hover:bg-[#4255ff] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.3)] text-sm uppercase tracking-widest flex items-center gap-2"
                                >
                                    Импортировать {parsedImportPreview.length > 0 && `(${parsedImportPreview.length})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Editor Modal */}
            {isTemplateEditorOpen && (
                <SetTemplateEditor
                    fields={currentSchema}
                    onChange={async (newFields) => {
                        setValue('fieldsSchema', newFields, { shouldValidate: true, shouldDirty: true });
                        // If TTS settings changed, we should re-process cards
                        const hasTTS = newFields.some(f => f.type === 'text' && f.settings?.ttsEnabled);
                        if (hasTTS) {
                            const currentCards = getValues('flashcards');
                            const processed = await processFlashcardsWithTTS(currentCards, newFields);
                            replace(processed);
                        }
                    }}
                    onClose={() => setIsTemplateEditorOpen(false)}
                />
            )}
        </div>
    )
}
