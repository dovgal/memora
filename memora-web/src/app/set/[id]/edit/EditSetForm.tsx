"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Plus, Trash2, Save, Loader2, Image as ImageIcon, Sparkles, X, ChevronLeft, FileDown, Settings2 } from "lucide-react"
import { SetResponse, FlashcardResponse, FieldSchema } from "@/types/schema"
import Link from "next/link"
import SetTemplateEditor from "@/components/SetTemplateEditor"
import DynamicFieldRenderer from "@/components/DynamicFieldRenderer"
import { processFlashcardsWithTTS } from "@/lib/ttsUtils"

const DEFAULT_SCHEMA: FieldSchema[] = [
    { id: 'term', name: 'ТЕРМИН', type: 'text', side: 'front', order: 1, settings: { language: 'default' } },
    { id: 'definition', name: 'ОПРЕДЕЛЕНИЕ', type: 'text', side: 'back', order: 1, settings: { language: 'default' } }
];

const flashcardSchema = z.object({
    id: z.string().optional(),
    term: z.string().optional(),
    definition: z.string().optional(),
    imageUrl: z.string().nullable().optional(),
    fieldsData: z.record(z.string(), z.any()).optional(),
})

const updateSetSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters").max(255),
    description: z.string().optional(),
    isPublic: z.boolean(),
    fieldsSchema: z.any(),
    flashcards: z.array(flashcardSchema).min(2, "You must provide at least 2 flashcards"),
})

type UpdateSetFormValues = z.infer<typeof updateSetSchema>

export default function EditSetForm({ initialSet, setId, token }: { initialSet: SetResponse, setId: string, token: string }) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [isGeneratingImage, setIsGeneratingImage] = useState<Record<number, boolean>>({})
    const [imageError, setImageError] = useState<string | null>(null)

    const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false)

    // Import states
    const [isImportOpen, setIsImportOpen] = useState(false)
    const [importText, setImportText] = useState("")

    const mappedFlashcards = initialSet.flashcards.map(card => ({
        id: card.id,
        term: card.term,
        definition: card.definition,
        imageUrl: card.imageUrl || null,
        fieldsData: card.fieldsData || {}
    }))

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<UpdateSetFormValues>({
        resolver: zodResolver(updateSetSchema),
        defaultValues: {
            title: initialSet.title,
            description: initialSet.description || "",
            isPublic: false,
            fieldsSchema: initialSet.fieldsSchema?.length ? initialSet.fieldsSchema : DEFAULT_SCHEMA,
            flashcards: mappedFlashcards,
        },
    })

    const { fields, append, remove, update } = useFieldArray({
        name: "flashcards",
        control,
    })

    const currentSchema: FieldSchema[] = watch('fieldsSchema') || DEFAULT_SCHEMA;
    const frontFields = currentSchema.filter((f) => f.side === 'front').sort((a, b) => a.order - b.order);
    const backFields = currentSchema.filter((f) => f.side === 'back').sort((a, b) => a.order - b.order);

    const onSubmit = async (data: UpdateSetFormValues) => {
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

            const res = await fetch(`/api/sets/${setId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || "Failed to update set")
            }

            // Successfully updated
            router.push(`/set/${setId}`)
            router.refresh()
        } catch (err: any) {
            setSubmitError(err.message)
            setIsSubmitting(false)
        }
    }

    const handleImport = () => {
        if (!importText.trim()) return;

        const orderedTextFields = [...frontFields, ...backFields].filter(f => f.type === 'text');

        const lines = importText.split('\n').filter(l => l.trim().length > 0);
        const newCards = lines.map(line => {
            let parts: string[] = [];
            const isTabSeparated = line.includes('\t');
            const separator = isTabSeparated ? '\t' : '-';

            if (line.includes(separator)) {
                parts = line.split(separator).map(p => p.trim());
            } else {
                parts = [line.trim()];
            }

            const cardData: any = { term: "", definition: "", imageUrl: null, fieldsData: {} };

            if (orderedTextFields.length === 0) {
                cardData.term = parts[0] || "";
                cardData.definition = parts.slice(1).join(isTabSeparated ? '\t' : ' - ') || "";
                return cardData;
            }

            orderedTextFields.forEach((field, i) => {
                let value = "";
                if (i < parts.length) {
                    if (i === orderedTextFields.length - 1 && parts.length > orderedTextFields.length) {
                        value = parts.slice(i).join(isTabSeparated ? '\t' : ' - ');
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

        if (newCards.length > 0) {
            append(newCards);
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
        // Validate it's an image
        if (!file.type.startsWith('image/')) {
            setImageError("Please upload a valid image file.");
            setTimeout(() => setImageError(null), 3000);
            return;
        }

        // Limit size (e.g. 5MB)
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
            {/* Background aesthetics */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-900 rounded-full mix-blend-multiply filter blur-[150px] opacity-30 pointer-events-none"></div>

            <div className="max-w-4xl mx-auto relative z-10">
                <Link href={`/set/${setId}`} className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-6 font-medium text-sm">
                    <ChevronLeft size={16} /> Назад к модулю
                </Link>

                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-white">Редактировать модуль</h1>
                        <p className="text-zinc-400 mt-2">Внесите изменения в термины и определения карточек.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsTemplateEditorOpen(true)}
                            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-indigo-400 font-semibold py-3 px-6 rounded-xl transition-all border border-indigo-500/30 hover:border-indigo-500 shadow-sm"
                        >
                            <Settings2 size={20} />
                            <span className="hidden sm:inline">Параметры карточек</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsImportOpen(true)}
                            className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold py-3 px-6 rounded-xl transition-all border border-zinc-700 hover:border-zinc-500 shadow-sm"
                        >
                            <FileDown size={20} />
                            <span className="hidden sm:inline">Импорт</span>
                        </button>
                        <button
                            onClick={handleSubmit(onSubmit)}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(79,70,229,0.3)]"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                            {isSubmitting ? "Сохранение..." : "Сохранить"}
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
                    {/* Metadata Section */}
                    <section className="bg-zinc-900/60 backdrop-blur border border-zinc-800 p-6 sm:p-8 rounded-2xl flex flex-col gap-6">
                        <div>
                            <input
                                type="text"
                                placeholder="Enter a title"
                                {...register("title")}
                                className="w-full bg-transparent border-b-2 border-zinc-700 text-2xl font-bold p-2 focus:outline-none focus:border-indigo-500 transition-colors text-white placeholder:text-zinc-600"
                            />
                            {errors.title && <p className="text-red-400 text-sm mt-2">{errors.title.message}</p>}
                        </div>

                        <div>
                            <input
                                type="text"
                                placeholder="Add a description (optional)"
                                {...register("description")}
                                className="w-full bg-transparent border-b-2 border-zinc-700 text-lg p-2 focus:outline-none focus:border-indigo-500 transition-colors text-zinc-300 placeholder:text-zinc-600"
                            />
                        </div>

                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                {...register("isPublic")}
                                className="w-5 h-5 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500/50"
                            />
                            <span className="text-zinc-300">Сделать видимым для всех (Публичный)</span>
                        </label>
                    </section>

                    {/* Flashcards Section */}
                    <div className="space-y-6">
                        {fields.map((field, index) => (
                            <div
                                key={field.id}
                                className="bg-zinc-900/80 backdrop-blur border border-zinc-800 p-6 rounded-2xl transition-colors hover:border-zinc-700 relative group"
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
                                <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
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
                                    <div className="flex-1 flex flex-col gap-4 border-r border-zinc-800/50 pr-4">
                                        <div className="text-sm font-bold text-zinc-600 mb-2">Лицевая сторона</div>
                                        {frontFields.map((f: FieldSchema) => (
                                            <DynamicFieldRenderer
                                                key={f.id}
                                                field={f}
                                                index={index}
                                                register={register}
                                                errors={errors}
                                                update={update}
                                                getValues={control._formValues}
                                            />
                                        ))}
                                    </div>

                                    {/* BACK SIDE */}
                                    <div className="flex-1 flex flex-col gap-4 pl-2">
                                        <div className="text-sm font-bold text-zinc-600 mb-2">Обратная сторона</div>
                                        {backFields.map((f: FieldSchema) => (
                                            <DynamicFieldRenderer
                                                key={f.id}
                                                field={f}
                                                index={index}
                                                register={register}
                                                errors={errors}
                                                update={update}
                                                getValues={control._formValues}
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
                            className="group flex items-center justify-center gap-2 w-full md:w-auto bg-zinc-900 border-2 border-dashed border-zinc-700 hover:border-indigo-500 text-zinc-400 hover:text-indigo-400 font-bold py-6 px-12 rounded-2xl transition-all"
                        >
                            <Plus size={24} className="group-hover:scale-110 transition-transform" />
                            ДОБАВИТЬ КАРТОЧКУ
                        </button>
                    </div>
                </form>
            </div>

            {/* Import Modal */}
            {isImportOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-3xl bg-[#0a0a1a] rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 md:p-8 flex-1">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <FileDown className="text-indigo-400" /> Импорт данных (Word, Excel)
                                </h2>
                                <button
                                    onClick={() => setIsImportOpen(false)}
                                    className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <p className="text-zinc-400 mb-4 text-sm">
                                Вставьте данные, предварительно скопированные из Word, Excel или Google Docs. Можно использовать табуляцию (<kbd className="bg-white/10 px-1 rounded">Tab</kbd>) или дефис (<kbd className="bg-white/10 px-1 rounded">-</kbd>) для разделения терминов и определений. Каждая новая строка — это отдельная карточка.
                            </p>

                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                placeholder="Word 1 - Definition 1&#10;Word 2 - Definition 2&#10;Word 3 - Definition 3"
                                className="w-full h-[300px] bg-[#1f1f3d] border border-[#2a2a4d] rounded-xl p-4 text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none placeholder:text-zinc-600"
                            />
                        </div>
                        <div className="p-6 bg-[#0a0a1a] border-t border-white/5 flex justify-end gap-3">
                            <button
                                onClick={() => setIsImportOpen(false)}
                                className="px-6 py-3 rounded-xl font-bold text-zinc-300 hover:bg-white/5 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={!importText.trim()}
                                className="px-6 py-3 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Импортировать
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Editor Modal */}
            {isTemplateEditorOpen && (
                <SetTemplateEditor
                    fields={watch('fieldsSchema')}
                    onChange={(newFields) => {
                        setValue('fieldsSchema', newFields, { shouldValidate: true, shouldDirty: true });
                    }}
                    onClose={() => setIsTemplateEditorOpen(false)}
                />
            )}
        </div>
    )
}
