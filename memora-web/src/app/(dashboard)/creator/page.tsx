"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Send, FileText, Sparkles, Loader2, Check, ArrowRight, BrainCircuit } from "lucide-react"
import { AIAnalyzeResponse, CreateFlashcardRequest } from "@/types/schema"

export default function CreatorPage() {
    const router = useRouter()
    const [step, setStep] = useState<'input' | 'analyzing' | 'review'>('input')
    const [content, setContent] = useState("")
    const [objective, setObjective] = useState("")
    const [analysis, setAnalysis] = useState<AIAnalyzeResponse | null>(null)
    const [isCreating, setIsCreating] = useState(false)

    const handleAnalyze = async () => {
        if (!content || !objective) return
        setStep('analyzing')
        try {
            const res = await fetch('/api/ai/creator/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, userObjective: objective })
            });
            if (res.ok) {
                const data: AIAnalyzeResponse = await res.json();
                setAnalysis(data);
                setStep('review');
            } else {
                setStep('input');
                alert("Analysis failed. Try again.");
            }
        } catch (e) {
            console.error(e);
            setStep('input');
        }
    }

    const handleCreateSet = async () => {
        if (!analysis) return
        setIsCreating(true)
        try {
            const res = await fetch('/api/sets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: analysis.proposedTitle,
                    description: analysis.proposedDescription,
                    isPublic: false,
                    fieldsSchema: [
                        { id: "f1", name: "Term", type: "text", side: "front", order: 0, settings: {} },
                        { id: "f2", name: "Definition", type: "text", side: "back", order: 1, settings: {} }
                    ],
                    flashcards: analysis.cards
                })
            });
            if (res.ok) {
                const newSet = await res.json();
                router.push(`/set/${newSet.id}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsCreating(false)
        }
    }

    if (step === 'analyzing') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-indigo-500 rounded-full blur-3xl opacity-20 animate-pulse" />
                    <BrainCircuit size={80} className="text-indigo-400 relative animate-bounce" />
                </div>
                <h2 className="text-3xl font-bold mb-4">Магия в процессе...</h2>
                <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
                    AI анализирует ваш контент, извлекает ключевые концепции и структурирует их в карточки. Это может занять несколько секунд.
                </p>
                <div className="mt-8 flex gap-2">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                </div>
            </div>
        )
    }

    if (step === 'review' && analysis) {
        return (
            <div className="max-w-5xl mx-auto w-full p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-4xl font-extrabold mb-2">{analysis.proposedTitle}</h1>
                        <p className="text-zinc-400 text-lg">{analysis.proposedDescription}</p>
                    </div>
                    <button 
                        onClick={handleCreateSet}
                        disabled={isCreating}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl transition-all disabled:opacity-50"
                    >
                        {isCreating ? <Loader2 className="animate-spin" /> : <Check />}
                        Создать модуль ({analysis.cards.length} карточек)
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.cards.map((card, i) => (
                        <div key={i} className="bg-zinc-900/50 border border-white/5 p-6 rounded-2xl flex flex-col gap-2 hover:border-indigo-500/30 transition-colors">
                            <span className="text-xs font-bold text-indigo-400 uppercase tracking-tighter">Карточка {i+1}</span>
                            <div className="text-xl font-bold">{card.term}</div>
                            <div className="text-zinc-400">{card.definition}</div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto w-full p-6 py-12">
            <div className="mb-12 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-bold mb-6">
                    <Sparkles size={16} /> AI Content Creator
                </div>
                <h1 className="text-5xl font-black mb-6 tracking-tight">Создавайте за секунды.</h1>
                <p className="text-xl text-zinc-400 leading-relaxed max-w-2xl mx-auto">
                    Загрузите текст книги, субтитры или подкаст. Наш AI превратит это в интерактивный курс обучения.
                </p>
            </div>

            <div className="space-y-8 bg-zinc-900/30 border border-white/5 p-8 rounded-3xl backdrop-blur-sm">
                <div className="space-y-4">
                    <label className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                        <FileText size={16} /> Ваш контент
                    </label>
                    <textarea 
                        className="w-full bg-black/40 border-2 border-white/5 rounded-2xl p-6 h-64 focus:border-indigo-500 outline-none transition-all resize-none text-lg leading-relaxed shadow-inner"
                        placeholder="Вставьте здесь текст, субтитры или сценарий..."
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </div>

                <div className="space-y-4">
                    <label className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                        <ArrowRight size={16} /> Что вы хотите выучить?
                    </label>
                    <input 
                        type="text"
                        className="w-full bg-black/40 border-2 border-white/5 rounded-2xl p-6 focus:border-indigo-500 outline-none transition-all text-xl font-medium"
                        placeholder="Например: 'Извлеки 20 новых фраз на английском' или 'Создай тест по физике'"
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                    />
                </div>

                <button 
                    onClick={handleAnalyze}
                    disabled={!content || !objective}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-6 rounded-2xl font-black text-xl flex items-center justify-center gap-3 shadow-2xl transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
                >
                    <BrainCircuit /> Анализировать контент
                </button>
            </div>
        </div>
    )
}
