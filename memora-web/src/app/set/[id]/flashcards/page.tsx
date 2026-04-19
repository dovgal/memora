"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { SetResponse } from "@/types/schema"
import { X, Loader2 } from "lucide-react"
import FlashcardPlayer from "../FlashcardPlayer"

export default function FlashcardsStudyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter()
    const { data: session } = useSession()
    const [set, setSet] = useState<SetResponse | null>(null)

    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchSet = async () => {
            try {
                const res = await fetch(`/api/sets/${id}`)
                if (res.ok) {
                    const data = await res.json()
                    setSet(data)
                } else {
                    router.push('/404')
                }
            } catch (err) {
                console.error("Failed to fetch set", err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchSet()
    }, [id, router])

    const closeSession = () => {
        router.push(`/set/${id}`)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-qz-bg flex items-center justify-center">
                <Loader2 className="animate-spin text-[#4255ff]" size={48} />
            </div>
        )
    }

    if (!set || set.flashcards.length === 0) {
        return (
            <div className="min-h-screen bg-qz-bg text-qz-text flex flex-col items-center justify-center">
                <p>No flashcards found in this set.</p>
                <button onClick={closeSession} className="mt-4 text-[#ffcd1f]">Return to Set</button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-qz-bg text-qz-text flex flex-col relative overflow-hidden font-sans">
            {/* Top Bar */}
            <header className="flex justify-between items-center p-6 z-10 w-full max-w-6xl mx-auto">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 max-w-[60%] truncate">
                    {set.title}
                </h1>
                <div className="flex items-center gap-6">
                    <button
                        onClick={closeSession}
                        className="p-2 bg-qz-card hover:bg-qz-card border border-qz-border-light rounded-full transition-colors text-qz-text-muted hover:text-qz-text"
                    >
                        <X size={24} />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full max-w-5xl mx-auto">
                <FlashcardPlayer flashcards={set.flashcards} fieldsSchema={set.fieldsSchema || []} setId={id} />
            </main>
        </div>
    )
}

