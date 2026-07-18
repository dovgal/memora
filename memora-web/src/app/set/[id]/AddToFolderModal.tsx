"use client"

import React, { useState, useEffect } from "react"
import { FolderPlus, X, Folder, Check } from "lucide-react"
import { FolderSummaryResponse } from "@/types/schema"

interface AddToFolderModalProps {
    setId: string
    token: string
}

export default function AddToFolderModal({ setId, token }: AddToFolderModalProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [folders, setFolders] = useState<FolderSummaryResponse[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [addedFolders, setAddedFolders] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (isOpen && folders.length === 0) {
            fetchFolders()
        }
    // fetchFolders is defined inline without useCallback; adding it would cause infinite refetches
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen])

    const fetchFolders = async () => {
        setIsLoading(true)
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
            const res = await fetch(`${apiUrl}/api/folders`, {
                headers: { "Authorization": `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setFolders(data)
            }
        } catch (error) {
            console.error("Failed to fetch folders", error)
        } finally {
            setIsLoading(false)
        }
    }

    const addToFolder = async (folderId: string) => {
        if (addedFolders.has(folderId)) return;

        setIsSaving(true)
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
            const res = await fetch(`${apiUrl}/api/folders/${folderId}/sets`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ setId })
            })

            if (res.ok) {
                setAddedFolders(prev => new Set(prev).add(folderId))
            }
        } catch (error) {
            console.error("Failed to add to folder", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-1 cursor-pointer hover:text-qz-accent transition-colors"
            >
                <FolderPlus size={14} /> Add to Folder
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-qz-bg/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-qz-card border border-qz-border-light rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-qz-text">Add to Folder</h2>
                            <button onClick={() => setIsOpen(false)} className="text-qz-text-muted hover:text-qz-text transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : folders.length === 0 ? (
                            <div className="text-center py-8 text-qz-text-muted">
                                <Folder className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                                <p>You don&apos;t have any folders yet.</p>
                                <p className="text-sm mt-2 text-zinc-500">Go to your Library to create one.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2">
                                {folders.map(folder => {
                                    const isAdded = addedFolders.has(folder.id)
                                    return (
                                        <button
                                            key={folder.id}
                                            disabled={isAdded || isSaving}
                                            onClick={() => addToFolder(folder.id)}
                                            className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${isAdded
                                                    ? 'bg-[#4255ff]/10 border-indigo-500/50 text-white cursor-default'
                                                    : 'bg-qz-bg/50 border-qz-border-light hover:border-indigo-500/50 text-qz-text-muted hover:bg-qz-card/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Folder size={20} className={isAdded ? "text-qz-accent" : "text-zinc-500"} />
                                                <span className="font-medium truncate max-w-[200px]">{folder.name}</span>
                                            </div>
                                            {isAdded && <Check size={20} className="text-qz-accent" />}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        <div className="mt-6 pt-4 border-t border-qz-border-light flex justify-end">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="bg-qz-card hover:bg-[#586380] text-qz-text font-medium py-2 px-6 rounded-lg transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
