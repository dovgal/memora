"use client"

import { useState, useEffect } from "react"
import { Plus, X, Layers, PlusCircle, MinusCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { SetSummaryResponse } from "@/types/schema"

interface FolderHeaderActionsProps {
    folderId: string;
    currentSets: SetSummaryResponse[];
}

export default function FolderHeaderActions({ folderId, currentSets: initialSets }: FolderHeaderActionsProps) {
    const { data: session } = useSession()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [userSets, setUserSets] = useState<SetSummaryResponse[]>([])
    const [isLoading, setIsLoading] = useState(false)

    // We maintain a local state of which sets are in the folder to update UI optimistically
    const [folderSetIds, setFolderSetIds] = useState<Set<string>>(new Set(initialSets.map(s => s.id)))
    const [processingSetId, setProcessingSetId] = useState<string | null>(null)

    useEffect(() => {
        if (isModalOpen && session?.id_token && userSets.length === 0) {
            fetchUserSets()
        }
        // fetchUserSets is stable within the modal open lifecycle; userSets.length guards against re-fetching
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isModalOpen, session])

    const fetchUserSets = async () => {
        setIsLoading(true)
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
            const res = await fetch(`${apiUrl}/api/sets`, {
                headers: {
                    "Authorization": `Bearer ${session?.id_token}`
                }
            })
            if (res.ok) {
                const data = await res.json()
                setUserSets(data)
            }
        } catch (error) {
            console.error("Failed to fetch user sets:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const toggleSetInFolder = async (set: SetSummaryResponse) => {
        if (!session?.id_token || processingSetId) return;

        const isAdding = !folderSetIds.has(set.id);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        setProcessingSetId(set.id);

        try {
            if (isAdding) {
                const res = await fetch(`${apiUrl}/api/folders/${folderId}/sets`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${session?.id_token}`
                    },
                    body: JSON.stringify({ setId: set.id })
                });

                if (res.ok) {
                    setFolderSetIds(prev => {
                        const next = new Set(prev);
                        next.add(set.id);
                        return next;
                    });
                }
            } else {
                const res = await fetch(`${apiUrl}/api/folders/${folderId}/sets/${set.id}`, {
                    method: "DELETE",
                    headers: {
                        "Authorization": `Bearer ${session?.id_token}`
                    }
                });

                if (res.ok) {
                    setFolderSetIds(prev => {
                        const next = new Set(prev);
                        next.delete(set.id);
                        return next;
                    });
                }
            }
        } catch (error) {
            console.error("Failed to toggle set in folder:", error);
        } finally {
            setProcessingSetId(null);
        }
    };

    return (
        <>
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex justify-center items-center w-10 h-10 rounded-full bg-[#4255ff] hover:bg-[#4255ff] text-white transition-colors shadow-lg shadow-indigo-500/20"
                    title="Добавить материалы"
                >
                    <Plus size={24} />
                </button>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-qz-bg/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-qz-bg rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-qz-text">Добавить материалы</h2>
                                <div className="flex gap-4 mt-4">
                                    <button className="text-qz-accent font-semibold border-b-2 border-indigo-400 pb-2">
                                        Ваша библиотека
                                    </button>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    window.location.reload(); // Refresh to update the parent page's set list
                                }}
                                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-qz-text-muted hover:text-qz-text"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Actions */}
                        <div className="px-6 py-4 flex justify-between items-center border-b border-qz-border-light shrink-0">
                            <span className="text-sm font-semibold text-qz-text-muted">Модули</span>
                            <Link
                                href={`/create?folderId=${folderId}`}
                                className="flex items-center gap-1 text-qz-accent hover:text-indigo-300 font-semibold text-sm transition-colors"
                            >
                                <Plus size={16} /> Создать
                            </Link>
                        </div>

                        {/* List */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-3">
                            {isLoading ? (
                                <div className="flex justify-center items-center py-12">
                                    <Loader2 className="animate-spin text-[#4255ff] w-8 h-8" />
                                </div>
                            ) : userSets.length === 0 ? (
                                <div className="text-center py-8 text-zinc-500">
                                    У вас еще нет модулей. Создайте новый, чтобы добавить его в папку.
                                </div>
                            ) : (
                                userSets.map(set => {
                                    const isInFolder = folderSetIds.has(set.id);
                                    const isProcessing = processingSetId === set.id;

                                    return (
                                        <div key={set.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-qz-bg border border-qz-border-light rounded-xl hover:border-qz-border transition-colors gap-4">
                                            <div className="flex items-start gap-4 flex-1 overflow-hidden">
                                                <div className="bg-qz-card p-3 rounded-lg text-qz-accent shrink-0">
                                                    <Layers size={20} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-qz-text font-semibold truncate">{set.title}</h4>
                                                    <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                                                        <span>Модуль</span>
                                                        <span>•</span>
                                                        <span>{set.flashcardCount} терминов</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => toggleSetInFolder(set)}
                                                disabled={isProcessing}
                                                className={`shrink-0 flex items-center justify-center rounded-full p-2 transition-colors disabled:opacity-50 ${isInFolder
                                                    ? "text-qz-accent hover:bg-[#4255ff]/10 hover:text-indigo-300"
                                                    : "text-qz-text-muted hover:bg-qz-card hover:text-qz-text"
                                                    }`}
                                            >
                                                {isProcessing ? (
                                                    <Loader2 size={24} className="animate-spin" />
                                                ) : isInFolder ? (
                                                    <MinusCircle size={28} className="fill-indigo-500/20" />
                                                ) : (
                                                    <PlusCircle size={28} />
                                                )}
                                            </button>
                                        </div>
                                    )
                                })
                            )}
                        </div>

                        <div className="p-6 bg-qz-bg border-t border-white/5 flex justify-center shrink-0">
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    window.location.reload();
                                }}
                                className="px-8 py-3 rounded-xl font-bold bg-[#4255ff] hover:bg-[#4255ff] text-white transition-colors w-full sm:w-auto min-w-[200px]"
                            >
                                Готово
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
