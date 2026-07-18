"use client"

import React, { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { FileText, Sparkles, Loader2, Check, ArrowRight, BrainCircuit, FileUp, File, X } from "lucide-react"
import { AIAnalyzeResponse } from "@/types/schema"
import * as pdfjsLib from "pdfjs-dist"
import mammoth from "mammoth"

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export default function CreatorPage() {
    const router = useRouter()
    const { data: session } = useSession()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [step, setStep] = useState<'input' | 'analyzing' | 'review'>('input')
    const [content, setContent] = useState("")
    const [objective, setObjective] = useState("")
    const [analysis, setAnalysis] = useState<AIAnalyzeResponse | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [isParsing, setIsParsing] = useState(false)
    const [fileName, setFileName] = useState<string | null>(null)
    const [streamingAnalysis, setStreamingAnalysis] = useState("")

    const handleAnalyze = async () => {
        if (!content || !objective) return
        setStep('analyzing')
        setStreamingAnalysis("")

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.id_token) {
                headers['Authorization'] = `Bearer ${session.id_token}`;
            }

            const response = await fetch('/api/ai/creator/analyze', {
                method: 'POST',
                headers,
                body: JSON.stringify({ content, userObjective: objective })
            });

            if (!response.ok) {
                throw new Error("Analysis failed");
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let accumulated = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split("\n");
                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            const data = line.slice(6);
                            accumulated += data;
                            setStreamingAnalysis(accumulated);
                        }
                    }
                }
                
                try {
                    const result: AIAnalyzeResponse = JSON.parse(accumulated);
                    setAnalysis(result);
                    setStep('review');
                } catch (e) {
                    console.error("Parse error", e);
                    setStep('input');
                    alert("Analysis complete but failed to parse results. Please try again.");
                }
            }
        } catch (e) {
            console.error(e);
            setStep('input');
            alert("Analysis error. Your document might be too large.");
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

    const handleCreateSet = async () => {
        if (!analysis) return
        setIsCreating(true)
        try {
            console.log("[DEBUG] Session check:", {
                hasSession: !!session,
                hasToken: !!session?.id_token,
                status: status
            });

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.id_token) {
                headers['Authorization'] = `Bearer ${session.id_token}`;
            }

            const res = await fetch('/api/sets', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    title: analysis.proposedTitle,
                    description: analysis.proposedDescription,
                    isPublic: false,
                    fieldsSchema: [
                        { id: 'term', name: 'ТЕРМИН', type: 'text', side: 'front', order: 1, settings: { language: 'default' } },
                        { id: 'definition', name: 'ОПРЕДЕЛЕНИЕ', type: 'text', side: 'back', order: 1, settings: { language: 'default' } }
                    ],
                    flashcards: analysis.cards.map((card) => ({
                        term: card.term,
                        definition: card.definition,
                        fieldsData: {}
                    }))
                })
            });
            if (res.ok) {
                const newSet = await res.json();
                router.push(`/set/${newSet.id}`);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(`Ошибка при сохранении: ${err.error || res.statusText}`);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsCreating(false)
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
                    AI анализирует ваш контент и извлекает структуру. Это может занять время для больших документов.
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
        return (
            <div className="max-w-5xl mx-auto w-full p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-4xl font-semibold mb-2">{analysis.proposedTitle}</h1>
                        <p className="text-qz-text-muted text-lg">{analysis.proposedDescription}</p>
                    </div>
                    <button 
                        onClick={handleCreateSet}
                        disabled={isCreating}
                        className="bg-[#4255ff] hover:bg-[#4255ff] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl transition-all disabled:opacity-50"
                    >
                        {isCreating ? <Loader2 className="animate-spin" /> : <Check />}
                        Создать модуль ({analysis.cards.length} карточек)
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.cards.map((card, i) => (
                        <div key={i} className="bg-qz-bg/50 border border-white/5 p-6 rounded-2xl flex flex-col gap-2 hover:border-indigo-500/30 transition-colors group">
                            <span className="text-xs font-bold text-qz-accent uppercase tracking-tighter">Карточка {i+1}</span>
                            <div className="text-xl font-bold group-hover:text-qz-text transition-colors">{card.term}</div>
                            <div className="text-zinc-500 group-hover:text-qz-text-muted transition-colors">{card.definition}</div>
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
                    Загрузите PDF, Word или вставьте текст. Наш AI превратит это в полноценную учебную программу.
                </p>
            </div>

            <div className="space-y-8 bg-qz-bg/30 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-sm shadow-2xl">
                
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
                            className="w-full bg-qz-bg/40 border-2 border-white/5 rounded-3xl p-8 h-80 focus:border-indigo-500 outline-none transition-all resize-none text-lg leading-relaxed shadow-inner placeholder:text-zinc-700"
                            placeholder="Вставьте здесь текст книги, субтитры или сценарий. Чем больше контекста, тем лучше результат."
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                    </div>
                </div>

                {/* Objective Input Area */}
                <div className="space-y-4">
                    <label className="text-sm font-bold text-zinc-500 uppercase flex items-center gap-2">
                        <ArrowRight size={16} /> Что вы хотите выучить?
                    </label>
                    <div className="relative group">
                        <input 
                            type="text"
                            className="w-full bg-qz-bg/40 border-2 border-white/5 rounded-2xl p-6 focus:border-indigo-500 outline-none transition-all text-xl font-medium placeholder:text-zinc-700"
                            placeholder="Например: 'Выдели 20 самых полезных фраз'..."
                            value={objective}
                            onChange={(e) => setObjective(e.target.value)}
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-[#4255ff]/10 rounded-xl">
                            <Sparkles size={20} className="text-[#4255ff]/50" />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleAnalyze}
                    disabled={!content || !objective || isParsing}
                    className="w-full bg-[#4255ff] hover:bg-[#4255ff] text-white py-6 rounded-2xl font-semibold text-xl flex items-center justify-center gap-3 shadow-2xl transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    <BrainCircuit className="group-hover:rotate-12 transition-transform" />
                    Анализировать контент
                </button>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { icon: <FileText className="text-blue-400" />, title: "PDF & Docs", desc: "Поддержка учебников и конспектов" },
                    { icon: <BrainCircuit className="text-qz-accent" />, title: "Smart Extraction", desc: "AI находит самые важные мысли" },
                    { icon: <Sparkles className="text-amber-400" />, title: "Instant Sets", desc: "Готовый модуль за 15 секунд" }
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
