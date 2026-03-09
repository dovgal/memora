"use client"

import React, { useState, useEffect, useRef } from "react"
import { FolderPlus, Users, Share, MoreHorizontal, Edit2, Copy, Printer, GitMerge, Download, Code, Trash2, X, Check, Loader2 } from "lucide-react"
import { FlashcardResponse, FieldSchema } from "@/types/schema"
import { useRouter } from "next/navigation"

interface SetActionsBarProps {
    setId: string;
    token?: string; // Optional if public viewing
    flashcards: FlashcardResponse[];
    isOwner: boolean;
    title: string;
    description: string;
    fieldsSchema: FieldSchema[];
}

export default function SetActionsBar({ setId, token, flashcards, fieldsSchema, isOwner, title, description }: SetActionsBarProps) {
    const router = useRouter();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isEmbedOpen, setIsEmbedOpen] = useState(false);
    const [isMergeOpen, setIsMergeOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleDelete = async () => {
        if (!confirm("Вы уверены, что хотите удалить этот модуль? Это действие нельзя отменить.")) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/sets/${setId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                router.push('/dashboard');
                router.refresh();
            } else {
                alert("Ошибка при удалении модуля");
            }
        } catch (error) {
            console.error(error);
            alert("Ошибка сети");
        } finally {
            setIsDeleting(false);
            setIsMenuOpen(false);
        }
    };

    const handleCopySet = async () => {
        if (!token) return;
        setIsCopying(true);
        try {
            // Format flashcards for creation (without IDs)
            const cardsToCreate = flashcards.map(c => ({
                term: c.term,
                definition: c.definition,
                imageUrl: c.imageUrl || null,
                fieldsData: c.fieldsData || {}
            }));

            const payload = {
                title: `${title} (Копия)`,
                description: description || "",
                isPublic: false,
                fieldsSchema: fieldsSchema,
                flashcards: cardsToCreate
            };

            const res = await fetch(`/api/sets`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/set/${data.id}`);
            } else {
                alert("Ошибка при копировании модуля");
            }
        } catch (error) {
            console.error(error);
            alert("Ошибка сети");
        } finally {
            setIsCopying(false);
            setIsMenuOpen(false);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="flex items-center gap-3 relative" ref={menuRef}>

            {/* Action Buttons */}
            {token && (
                <button className="flex items-center gap-2 px-4 py-2 bg-transparent border border-zinc-700 hover:border-zinc-500 rounded-lg text-sm font-semibold transition-colors">
                    <FolderPlus size={16} /> Сохранено
                </button>
            )}

            {token && (
                <button className="flex items-center gap-2 px-4 py-2 bg-transparent border border-zinc-700 hover:border-zinc-500 rounded-lg text-sm font-semibold transition-colors">
                    <Users size={16} /> Группы
                </button>
            )}

            <button
                onClick={() => setIsExportOpen(true)}
                className="flex items-center justify-center w-10 h-10 bg-transparent border border-zinc-700 hover:border-zinc-500 rounded-lg transition-colors"
                title="Экспортировать"
            >
                <Share size={18} />
            </button>

            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${isMenuOpen ? 'bg-zinc-800 border border-zinc-600' : 'bg-transparent border border-zinc-700 hover:border-zinc-500'}`}
            >
                <MoreHorizontal size={18} />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
                <div className="absolute right-0 top-12 w-56 bg-[#1a1a36] border border-[#2a2a4d] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                    {isOwner && (
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                router.push(`/set/${setId}/edit`);
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 flex items-center gap-3"
                        >
                            <Edit2 size={16} /> Редактировать
                        </button>
                    )}
                    <button
                        onClick={handleCopySet}
                        disabled={isCopying || !token}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 flex items-center gap-3 disabled:opacity-50"
                    >
                        {isCopying ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />} Создать копию
                    </button>
                    <button
                        onClick={() => {
                            setIsMenuOpen(false);
                            router.push(`/set/${setId}/print`);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 flex items-center gap-3"
                    >
                        <Printer size={16} /> Печать
                    </button>
                    <button
                        onClick={() => {
                            setIsMenuOpen(false);
                            setIsMergeOpen(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 flex items-center gap-3"
                    >
                        <GitMerge size={16} /> Объединить
                    </button>
                    <button
                        onClick={() => {
                            setIsMenuOpen(false);
                            setIsExportOpen(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 flex items-center gap-3"
                    >
                        <Download size={16} /> Экспортировать
                    </button>
                    <button
                        onClick={() => {
                            setIsMenuOpen(false);
                            setIsEmbedOpen(true);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-800 flex items-center gap-3"
                    >
                        <Code size={16} /> Внедрить
                    </button>

                    {isOwner && (
                        <>
                            <div className="h-px bg-[#2a2a4d] my-1"></div>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="w-full text-left px-4 py-2.5 text-sm hover:bg-red-900/40 text-red-500 flex items-center gap-3 transition-colors disabled:opacity-50"
                            >
                                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Удалить
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Export Modal */}
            {isExportOpen && (
                <ExportModal
                    flashcards={flashcards}
                    fieldsSchema={fieldsSchema}
                    onClose={() => setIsExportOpen(false)}
                />
            )}

            {/* Embed Modal */}
            {isEmbedOpen && (
                <EmbedModal
                    setId={setId}
                    onClose={() => setIsEmbedOpen(false)}
                />
            )}

            {/* Merge Modal */}
            {isMergeOpen && (
                <MergeModal
                    currentSetId={setId}
                    currentSetTitle={title}
                    currentSetFlashcards={flashcards}
                    token={token}
                    onClose={() => setIsMergeOpen(false)}
                />
            )}
        </div>
    )
}

function ExportModal({ flashcards, fieldsSchema, onClose }: { flashcards: FlashcardResponse[], fieldsSchema: FieldSchema[], onClose: () => void }) {
    const [termDelimiter, setTermDelimiter] = useState<"tab" | "comma" | "custom">("tab");
    const [customTermDelimiter, setCustomTermDelimiter] = useState("-");
    const [rowDelimiter, setRowDelimiter] = useState<"newline" | "semicolon" | "custom">("newline");
    const [customRowDelimiter, setCustomRowDelimiter] = useState("\\n\\n");
    const [alphabetical, setAlphabetical] = useState(false);
    const [copied, setCopied] = useState(false);

    // Generate output string
    const generateOutput = () => {
        let cards = [...flashcards];
        if (alphabetical) {
            cards.sort((a, b) => a.term.localeCompare(b.term));
        }

        const tDelim = termDelimiter === 'tab' ? '\t' : (termDelimiter === 'comma' ? ',' : ` ${customTermDelimiter} `);

        // Handle escaped newline in custom row delimiter
        let rDelim = '\n';
        if (rowDelimiter === 'semicolon') rDelim = ';\n';
        if (rowDelimiter === 'custom') rDelim = customRowDelimiter.replace(/\\n/g, '\n');

        return cards.map(c => {
            if (!fieldsSchema || fieldsSchema.length === 0) {
                return `${c.term}${tDelim}${c.definition}`;
            }

            const orderedFields = [...fieldsSchema].sort((a, b) => {
                if (a.side !== b.side) return a.side === 'front' ? -1 : 1;
                return a.order - b.order;
            }).filter(f => f.type === 'text');

            if (orderedFields.length === 0) {
                return `${c.term}${tDelim}${c.definition}`;
            }

            return orderedFields.map(field => {
                if (field.id === 'term') return c.term;
                if (field.id === 'definition') return c.definition;
                return c.fieldsData?.[field.id] || "";
            }).join(tDelim);
        }).join(rDelim);
    };

    const outputText = generateOutput();

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(outputText);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1f1f3d] border border-[#2a2a4d] rounded-2xl w-full max-w-3xl p-8 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-3xl font-bold text-white mb-8">Экспортировать</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* Term/Def Delimiter */}
                    <div>
                        <h4 className="font-semibold text-white mb-4">Между термином и определением</h4>
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setTermDelimiter('tab')}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${termDelimiter === 'tab' ? 'border-indigo-500' : 'border-zinc-500'}`}>
                                    {termDelimiter === 'tab' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                                </div>
                                <span className={termDelimiter === 'tab' ? 'text-white' : 'text-zinc-400'}>Tab</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setTermDelimiter('comma')}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${termDelimiter === 'comma' ? 'border-indigo-500' : 'border-zinc-500'}`}>
                                    {termDelimiter === 'comma' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                                </div>
                                <span className={termDelimiter === 'comma' ? 'text-white' : 'text-zinc-400'}>Запятая</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer" onClick={(e) => { e.preventDefault(); setTermDelimiter('custom') }}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${termDelimiter === 'custom' ? 'border-indigo-500' : 'border-zinc-500'}`}>
                                    {termDelimiter === 'custom' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                                </div>
                                <div className="relative w-full max-w-[150px]">
                                    <span className="absolute -top-2 left-3 bg-[#1f1f3d] px-1 text-[10px] text-zinc-400">На выбор</span>
                                    <input
                                        type="text"
                                        value={customTermDelimiter}
                                        onChange={(e) => {
                                            setCustomTermDelimiter(e.target.value);
                                            setTermDelimiter('custom');
                                        }}
                                        onClick={(e) => { e.stopPropagation(); setTermDelimiter('custom'); }}
                                        className={`w-full bg-[#1a1a36] border rounded-lg px-3 py-2 outline-none transition-colors ${termDelimiter === 'custom' ? 'border-indigo-500 text-white' : 'border-[#2a2a4d] text-zinc-400'}`}
                                    />
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Row Delimiter */}
                    <div>
                        <h4 className="font-semibold text-white mb-4">Между строками</h4>
                        <div className="space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setRowDelimiter('newline')}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${rowDelimiter === 'newline' ? 'border-indigo-500' : 'border-zinc-500'}`}>
                                    {rowDelimiter === 'newline' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                                </div>
                                <span className={rowDelimiter === 'newline' ? 'text-white' : 'text-zinc-400'}>Разрыв строки</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setRowDelimiter('semicolon')}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${rowDelimiter === 'semicolon' ? 'border-indigo-500' : 'border-zinc-500'}`}>
                                    {rowDelimiter === 'semicolon' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                                </div>
                                <span className={rowDelimiter === 'semicolon' ? 'text-white' : 'text-zinc-400'}>Точка с запятой</span>
                            </label>

                            <label className="flex items-center gap-3 cursor-pointer" onClick={(e) => { e.preventDefault(); setRowDelimiter('custom') }}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${rowDelimiter === 'custom' ? 'border-indigo-500' : 'border-zinc-500'}`}>
                                    {rowDelimiter === 'custom' && <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full" />}
                                </div>
                                <div className="relative w-full max-w-[150px]">
                                    <span className="absolute -top-2 left-3 bg-[#1f1f3d] px-1 text-[10px] text-zinc-400">На выбор</span>
                                    <input
                                        type="text"
                                        value={customRowDelimiter}
                                        onChange={(e) => {
                                            setCustomRowDelimiter(e.target.value);
                                            setRowDelimiter('custom');
                                        }}
                                        onClick={(e) => { e.stopPropagation(); setRowDelimiter('custom'); }}
                                        className={`w-full bg-[#1a1a36] border rounded-lg px-3 py-2 outline-none transition-colors ${rowDelimiter === 'custom' ? 'border-indigo-500 text-white' : 'border-[#2a2a4d] text-zinc-400'}`}
                                    />
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="mb-6">
                    <h4 className="font-semibold text-white mb-4">Параметры</h4>
                    <label className="flex items-center gap-3 cursor-pointer w-max">
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${alphabetical ? 'bg-indigo-500 border-indigo-500' : 'bg-transparent border-zinc-500'}`}>
                            {alphabetical && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <span className="text-white">В алфавитном порядке</span>
                    </label>
                </div>

                <div className="bg-[#1a1a36] border border-[#2a2a4d] rounded-xl overflow-hidden flex flex-col h-64">
                    <div className="p-4 border-b border-[#2a2a4d] flex justify-between items-center bg-[#212140]">
                        <span className="text-sm text-zinc-400">Скопируйте и вставьте приведенный ниже текст. Он защищен от редактирования.</span>
                        <button
                            onClick={handleCopy}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center gap-2"
                        >
                            {copied ? <Check size={16} /> : null}
                            {copied ? "Скопировано!" : "Копировать текст"}
                        </button>
                    </div>
                    <textarea
                        readOnly
                        value={outputText}
                        className="flex-1 w-full bg-transparent p-4 text-zinc-300 outline-none resize-none font-mono text-sm leading-relaxed"
                    />
                </div>
            </div>
        </div>
    )
}

function EmbedModal({ setId, onClose }: { setId: string, onClose: () => void }) {
    const [copied, setCopied] = useState(false);
    const [embedType, setEmbedType] = useState<"flashcards" | "learn" | "test">("flashcards");

    // In actual Next.js app, this would be computed from window.location or NEXT_PUBLIC_URL 
    // Just using a placeholder local domain for demo.
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

    const embedCode = `<iframe src="${baseUrl}/set/${setId}/${embedType}?embed=true" width="100%" height="500" style="border:0; border-radius: 12px; overflow:hidden;" title="Memora Study Set" allow="fullscreen"></iframe>`;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(embedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy", err);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1f1f3d] border border-[#2a2a4d] rounded-2xl w-full max-w-2xl p-8 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-3xl font-bold text-white mb-2">Внедрить код</h2>
                <p className="text-zinc-400 mb-8">Скопируйте этот код, чтобы добавить модуль на свой сайт или в LMS.</p>

                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setEmbedType("flashcards")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${embedType === "flashcards" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                        Карточки
                    </button>
                    <button
                        onClick={() => setEmbedType("learn")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${embedType === "learn" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                        Заучивание
                    </button>
                    <button
                        onClick={() => setEmbedType("test")}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${embedType === "test" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
                    >
                        Тест
                    </button>
                </div>

                <div className="bg-[#1a1a36] border border-[#2a2a4d] rounded-xl overflow-hidden flex flex-col h-48 mb-4">
                    <div className="p-4 border-b border-[#2a2a4d] flex justify-between items-center bg-[#212140]">
                        <span className="text-sm text-zinc-400">Код для вставки (HTML)</span>
                        <button
                            onClick={handleCopy}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-1.5 px-4 rounded-lg transition-colors flex items-center gap-2 text-sm"
                        >
                            {copied ? <Check size={14} /> : null}
                            {copied ? "Скопировано!" : "Копировать"}
                        </button>
                    </div>
                    <textarea
                        readOnly
                        value={embedCode}
                        className="flex-1 w-full bg-transparent p-4 text-zinc-300 outline-none resize-none font-mono text-sm leading-relaxed"
                    />
                </div>
            </div>
        </div>
    )
}

function MergeModal({
    currentSetId,
    currentSetTitle,
    currentSetFlashcards,
    token,
    onClose
}: {
    currentSetId: string,
    currentSetTitle: string,
    currentSetFlashcards: FlashcardResponse[],
    token?: string,
    onClose: () => void
}) {
    const router = useRouter();
    const [sets, setSets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [merging, setMerging] = useState(false);
    const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

    useEffect(() => {
        if (!token) {
            setLoading(false);
            return;
        }

        const fetchSets = async () => {
            try {
                const res = await fetch('/api/sets');
                if (res.ok) {
                    const data = await res.json();
                    // Filter out the current set
                    setSets(data.filter((s: any) => s.id !== currentSetId));
                }
            } catch (error) {
                console.error("Error fetching sets for merge", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSets();
    }, [token, currentSetId]);

    const handleMerge = async () => {
        if (!selectedSetId || !token) return;

        setMerging(true);
        try {
            // First, fetch the full details of the selected set to get its flashcards
            const targetSetRes = await fetch(`/api/sets/${selectedSetId}`);
            if (!targetSetRes.ok) throw new Error("Failed to fetch target set");

            const targetSet = await targetSetRes.json();

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

            // Combine flashcards
            const combinedFlashcards = [
                ...currentSetFlashcards.map(c => ({ term: c.term, definition: c.definition, imageUrl: c.imageUrl || null })),
                ...targetSet.flashcards.map((c: any) => ({ term: c.term, definition: c.definition, imageUrl: c.imageUrl || null }))
            ];

            const payload = {
                title: `${currentSetTitle} + ${targetSet.title}`,
                description: "Объединенный модуль",
                isPublic: false,
                flashcards: combinedFlashcards
            };

            const res = await fetch(`${apiUrl}/api/sets`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/set/${data.id}`);
            } else {
                alert("Ошибка при объединении модулей");
            }
        } catch (error) {
            console.error(error);
            alert("Ошибка сети");
        } finally {
            setMerging(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#1f1f3d] border border-[#2a2a4d] rounded-2xl w-full max-w-2xl p-8 shadow-2xl relative">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-3xl font-bold text-white mb-2">Объединить модули</h2>
                <p className="text-zinc-400 mb-6">Выберите ваш модуль, чтобы объединить его карточки текущим и создать новый модуль.</p>

                {!token ? (
                    <div className="p-4 bg-orange-900/40 border border-orange-500/50 rounded-xl text-orange-200 text-center">
                        Пожалуйста, войдите в систему, чтобы объединять модули.
                    </div>
                ) : loading ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
                    </div>
                ) : sets.length === 0 ? (
                    <div className="p-8 text-center text-zinc-400 border border-dashed border-zinc-700 rounded-xl">
                        У вас нет других модулей для объединения.
                    </div>
                ) : (
                    <>
                        <div className="max-h-[300px] overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
                            {sets.map(set => (
                                <button
                                    key={set.id}
                                    onClick={() => setSelectedSetId(set.id)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${selectedSetId === set.id ? "bg-indigo-600/20 border-indigo-500" : "bg-zinc-800/50 border-zinc-700 hover:border-zinc-500"}`}
                                >
                                    <h4 className="font-bold text-white">{set.title}</h4>
                                    <p className="text-sm text-zinc-400 mt-1">{set.flashcardCount} терминов</p>
                                </button>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-[#2a2a4d]">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl font-bold text-zinc-300 hover:bg-white/5 transition-colors"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handleMerge}
                                disabled={!selectedSetId || merging}
                                className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {merging ? <Loader2 size={18} className="animate-spin" /> : <GitMerge size={18} />}
                                Объединить и создать
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
