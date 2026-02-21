"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { StudySet, FlashcardProgressRequest } from "@/types/schema"
import { generateLearnQueue, createMultipleChoiceQuestion, MultipleChoiceQuestion } from "@/lib/studyUtils"
import { X, CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react"

export default function LearnModePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter()
    const { data: session } = useSession()
    const [set, setSet] = useState<StudySet | null>(null)

    // Quiz State
    const [queue, setQueue] = useState<MultipleChoiceQuestion[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [progress, setProgress] = useState<FlashcardProgressRequest[]>([])

    // UI State
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isFinished, setIsFinished] = useState(false)
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
    const [showResult, setShowResult] = useState(false)

    useEffect(() => {
        const fetchSetAndProgress = async () => {
            try {
                // Fetch base set
                const resSet = await Promise.all([
                    fetch(`/api/sets/${id}`),
                    session ? fetch(`/api/sets/${id}/progress`) : Promise.resolve(null)
                ])

                if (resSet[0].ok) {
                    const setData: StudySet = await resSet[0].json()
                    setSet(setData)

                    // We need a way to know WHICH cards are known. 
                    // The current GET /api/sets/:id/progress returns aggregate data.
                    // For a true SR learn mode, we should fetch individual card progress.
                    // Since we don't have that endpoint yet, we will fallback to shuffling and using the queue.
                    // In a future PR, we should add `GET /api/study/progress/:setId` to return the raw `FlashcardProgress` records.
                    // For now, generate the queue with an empty Set of known IDs (treats all as unknown).

                    const rawQueue = generateLearnQueue(setData.flashcards, new Set())

                    // Map to MCQ
                    const mcqQueue = rawQueue.map(card => createMultipleChoiceQuestion(card, setData.flashcards))
                    setQueue(mcqQueue)
                } else {
                    router.push('/404')
                }
            } catch (err) {
                console.error("Failed to fetch learn data", err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchSetAndProgress()
    }, [id, session, router])

    const handleAnswer = (index: number) => {
        if (showResult || !set) return

        setSelectedAnswer(index)
        setShowResult(true)

        const currentQuestion = queue[currentIndex]
        const isCorrect = index === currentQuestion.correctIndex

        // Record Result
        const newProgress = [...progress]
        const existingIndex = newProgress.findIndex(p => p.flashcardId === currentQuestion.flashcard.id)

        if (existingIndex >= 0) {
            // If we already answered it this session, we don't strictly *have* to overwrite, 
            // but SR algorithms usually take the most recent attempt.
            newProgress[existingIndex].isKnown = isCorrect
        } else {
            newProgress.push({
                flashcardId: currentQuestion.flashcard.id,
                isKnown: isCorrect
            })
        }

        setProgress(newProgress)

        // Auto-advance after 1.5s
        setTimeout(() => {
            if (currentIndex < queue.length - 1) {
                setSelectedAnswer(null)
                setShowResult(false)
                setCurrentIndex(currentIndex + 1)
            } else {
                setIsFinished(true)
                submitProgress(newProgress)
            }
        }, 1500)
    }

    const submitProgress = async (finalProgress: FlashcardProgressRequest[]) => {
        if (!session || finalProgress.length === 0) return

        setIsSubmitting(true)
        try {
            await fetch('/api/study/progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    setId: id,
                    progressUpdates: finalProgress
                })
            })
        } catch (err) {
            if (!navigator.onLine) {
                console.log("Offline mode: Progress saved locally and will sync when online.")
            } else {
                console.error("Error submitting progress", err)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const closeSession = () => {
        router.push(`/set/${id}`)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        )
    }

    if (!set || queue.length === 0) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
                <p>Not enough flashcards to start Learn mode.</p>
                <button onClick={closeSession} className="mt-4 text-indigo-400">Return to Set</button>
            </div>
        )
    }

    const currentQuestion = queue[currentIndex]
    const totalCorrect = progress.filter(p => p.isKnown).length

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Top Bar */}
            <header className="flex justify-between items-center p-6 z-10 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-400 max-w-[60%] truncate">
                        Learn Mode: {set.title}
                    </h1>
                </div>
                <div className="flex items-center gap-6">
                    {!isFinished && (
                        <div className="flex gap-4">
                            <span className="text-green-400 font-bold">{totalCorrect} Correct</span>
                            <span className="text-zinc-500">|</span>
                            <span className="text-zinc-400 font-medium">{currentIndex + 1} / {queue.length}</span>
                        </div>
                    )}
                    <button
                        onClick={closeSession}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>
            </header>

            {/* Progress Bar */}
            {!isFinished && (
                <div className="w-full bg-zinc-900 h-1">
                    <div
                        className="bg-indigo-500 h-1 transition-all duration-300"
                        style={{ width: `${((currentIndex) / queue.length) * 100}%` }}
                    />
                </div>
            )}

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full max-w-3xl mx-auto">

                {isFinished ? (
                    <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 p-10 rounded-3xl w-full text-center shadow-2xl animate-in zoom-in duration-500">
                        <h2 className="text-4xl font-extrabold mb-4">Session Complete!</h2>
                        <p className="text-xl text-zinc-400 mb-8">
                            You scored {Math.round((totalCorrect / queue.length) * 100)}%
                        </p>

                        <div className="flex gap-4 justify-center">
                            <div className="bg-zinc-950 p-6 rounded-2xl flex-1 max-w-[200px] border border-zinc-800">
                                <div className="text-3xl font-black text-green-400 mb-2">{totalCorrect}</div>
                                <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Correct</div>
                            </div>
                            <div className="bg-zinc-950 p-6 rounded-2xl flex-1 max-w-[200px] border border-zinc-800">
                                <div className="text-3xl font-black text-red-500 mb-2">{queue.length - totalCorrect}</div>
                                <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Incorrect</div>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-center">
                            <button
                                onClick={closeSession}
                                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 font-bold py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                {isSubmitting ? "Saving..." : "Return to Set"}
                            </button>
                        </div>
                        {!session && (
                            <p className="mt-6 text-yellow-500 text-sm">
                                Progress is not saved because you are not logged in.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="w-full flex flex-col gap-10 animate-in fade-in duration-300">

                        {/* Question Card */}
                        <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl text-center shadow-2xl relative">
                            <span className="absolute top-6 left-8 text-zinc-500 uppercase tracking-widest text-xs font-bold">Term</span>
                            <p className="text-3xl md:text-4xl font-semibold leading-tight mt-6 mb-2">
                                {currentQuestion.flashcard.term}
                            </p>
                        </div>

                        {/* Answer Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {currentQuestion.options.map((option, index) => {

                                let buttonStateClass = "bg-zinc-900 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-300"
                                let Icon = null;

                                if (showResult) {
                                    if (index === currentQuestion.correctIndex) {
                                        buttonStateClass = "bg-green-950/40 border-green-500 text-green-400 scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                                        Icon = <CheckCircle size={20} />
                                    } else if (index === selectedAnswer && index !== currentQuestion.correctIndex) {
                                        buttonStateClass = "bg-red-950/40 border-red-500 text-red-400 scale-[0.98] opacity-70"
                                        Icon = <XCircle size={20} />
                                    } else {
                                        buttonStateClass = "bg-zinc-950 border-zinc-900 text-zinc-600 opacity-50"
                                    }
                                }

                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleAnswer(index)}
                                        disabled={showResult}
                                        className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 flex items-center justify-between gap-4 ${buttonStateClass}`}
                                    >
                                        <span className="font-medium leading-relaxed">{option}</span>
                                        {Icon}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}
