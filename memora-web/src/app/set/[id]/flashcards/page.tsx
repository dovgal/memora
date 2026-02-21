"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { StudySet, FlashcardProgressRequest, Flashcard } from "@/types/schema"
import { X, RotateCcw, CheckCircle, HelpCircle, Loader2 } from "lucide-react"

export default function FlashcardsStudyPage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const { data: session } = useSession()
    const [set, setSet] = useState<StudySet | null>(null)

    const [currentIndex, setCurrentIndex] = useState(0)
    const [isFlipped, setIsFlipped] = useState(false)
    const [progress, setProgress] = useState<FlashcardProgressRequest[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isFinished, setIsFinished] = useState(false)

    useEffect(() => {
        // Fetch the set data. Assuming we can reuse the generic GET /api/sets/:id endpoint.
        const fetchSet = async () => {
            try {
                const res = await fetch(`/api/sets/${params.id}`)
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
    }, [params.id, router])

    const handleFlip = () => {
        setIsFlipped(!isFlipped)
    }

    const recordResult = (isKnown: boolean) => {
        if (!set) return

        const currentCard = set.flashcards[currentIndex]

        // Check if we already recorded this card this session, if so, we overwrite it.
        const newProgress = [...progress]
        const existingIndex = newProgress.findIndex(p => p.flashcardId === currentCard.id)

        if (existingIndex >= 0) {
            newProgress[existingIndex].isKnown = isKnown
        } else {
            newProgress.push({
                flashcardId: currentCard.id,
                isKnown
            })
        }

        setProgress(newProgress)

        // Move to next card, or finish
        if (currentIndex < set.flashcards.length - 1) {
            setIsFlipped(false)
            setCurrentIndex(currentIndex + 1)
        } else {
            setIsFinished(true)
            submitProgress(newProgress)
        }
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
                    setId: params.id,
                    progressUpdates: finalProgress
                })
            })
        } catch (err) {
            console.error("Error submitting progress", err)
        } finally {
            setIsSubmitting(false)
        }
    }

    const restartSession = () => {
        setCurrentIndex(0)
        setIsFlipped(false)
        setProgress([])
        setIsFinished(false)
    }

    const closeSession = () => {
        router.push(`/set/${params.id}`)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        )
    }

    if (!set || set.flashcards.length === 0) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
                <p>No flashcards found in this set.</p>
                <button onClick={closeSession} className="mt-4 text-indigo-400">Return to Set</button>
            </div>
        )
    }

    const currentCard = set.flashcards[currentIndex]

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col relative overflow-hidden">
            {/* Cool Background Aesthetic */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none"></div>

            {/* Top Bar */}
            <header className="flex justify-between items-center p-6 z-10">
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 max-w-[60%] truncate">
                    {set.title}
                </h1>
                <div className="flex items-center gap-6">
                    {!isFinished && (
                        <span className="text-zinc-400 font-medium">
                            {currentIndex + 1} / {set.flashcards.length}
                        </span>
                    )}
                    <button
                        onClick={closeSession}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 w-full max-w-4xl mx-auto">

                {isFinished ? (
                    // Completion Summary Screen
                    <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 p-10 rounded-3xl w-full text-center shadow-2xl animate-in fade-in zoom-in duration-500 slide-in-from-bottom-10">
                        <h2 className="text-4xl font-extrabold mb-4">You did it! 🎉</h2>
                        <p className="text-xl text-zinc-400 mb-8">
                            You reviewed {set.flashcards.length} cards.
                        </p>

                        <div className="flex gap-4 justify-center">
                            <div className="bg-zinc-950 p-6 rounded-2xl flex-1 max-w-[200px] border border-zinc-800">
                                <div className="text-3xl font-black text-green-400 mb-2">
                                    {progress.filter(p => p.isKnown).length}
                                </div>
                                <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Known</div>
                            </div>
                            <div className="bg-zinc-950 p-6 rounded-2xl flex-1 max-w-[200px] border border-zinc-800">
                                <div className="text-3xl font-black text-yellow-500 mb-2">
                                    {progress.filter(p => !p.isKnown).length}
                                </div>
                                <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Studying</div>
                            </div>
                        </div>

                        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={restartSession}
                                className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 font-bold py-4 px-8 rounded-xl transition-all"
                            >
                                <RotateCcw size={20} /> Restart Flashcards
                            </button>
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
                    // Active Study Flip Card
                    <div className="w-full flex flex-col items-center gap-12">

                        {/* The 3D CSS Container */}
                        <div
                            className="relative w-full aspect-[4/3] max-w-3xl cursor-pointer group perspective-[2000px]"
                            onClick={handleFlip}
                        >
                            {/* The Inner Flipper */}
                            <div
                                className={`w-full h-full transition-transform duration-700 ease-out-expo preserve-3d shadow-2xl relative ${isFlipped ? 'rotate-y-180' : ''}`}
                                style={{ transformStyle: 'preserve-3d' }}
                            >
                                {/* Front (Term) */}
                                <div
                                    className="absolute inset-0 w-full h-full bg-zinc-900 border border-zinc-800 rounded-3xl flex items-center justify-center p-8 text-center backface-hidden"
                                    style={{ backfaceVisibility: 'hidden' }}
                                >
                                    <p className="text-4xl md:text-5xl font-bold leading-tight">{currentCard.term}</p>
                                    <div className="absolute bottom-6 text-zinc-600 uppercase tracking-widest text-sm font-bold">Tap to flip</div>
                                </div>

                                {/* Back (Definition) */}
                                <div
                                    className="absolute inset-0 w-full h-full bg-zinc-800 border-2 border-indigo-500/30 rounded-3xl flex flex-col items-center justify-center p-8 text-center backface-hidden rotate-y-180"
                                    style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                >
                                    <p className="text-3xl md:text-4xl font-medium leading-relaxed">{currentCard.definition}</p>
                                    <div className="absolute bottom-6 text-indigo-400/50 uppercase tracking-widest text-sm font-bold">Definition</div>
                                </div>
                            </div>
                        </div>

                        {/* Assessment Controls */}
                        {isFlipped && (
                            <div className="flex gap-6 w-full max-w-2xl animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <button
                                    onClick={() => recordResult(false)}
                                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 border-2 border-yellow-500/50 hover:border-yellow-500 text-white font-bold py-6 px-4 rounded-2xl flex flex-col items-center gap-2 transition-all shadow-[0_0_15px_rgba(234,179,8,0.1)] hover:shadow-[0_0_20px_rgba(234,179,8,0.3)] group"
                                >
                                    <HelpCircle className="text-yellow-500 group-hover:scale-110 transition-transform" size={28} />
                                    Still Learning
                                </button>
                                <button
                                    onClick={() => recordResult(true)}
                                    className="flex-1 bg-zinc-900 hover:bg-zinc-800 border-2 border-green-500/50 hover:border-green-500 text-white font-bold py-6 px-4 rounded-2xl flex flex-col items-center gap-2 transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] group"
                                >
                                    <CheckCircle className="text-green-500 group-hover:scale-110 transition-transform" size={28} />
                                    Know
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}
