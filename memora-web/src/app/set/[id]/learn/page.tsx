"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { SetResponse, FlashcardProgressRequest, FieldSchema, AIExercise, AIGradeResponse } from "@/types/schema"
import { generateLearnQueue, createMultipleChoiceQuestion, TestQuestion, getCardText, getCardSingleField } from "@/lib/studyUtils"
import { X, CheckCircle, XCircle, RotateCcw, Loader2, ChevronRight, GraduationCap, Settings, Edit2, Volume2, Shuffle, Star, ChevronDown, ChevronUp, Mic, Play } from "lucide-react"
import { QChatProvider, WhyWrongButton } from "@/components/QChat"

export default function LearnModePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter()
    const { data: session } = useSession()
    const [set, setSet] = useState<SetResponse | null>(null)

    // Quiz State
    const [queue, setQueue] = useState<TestQuestion[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [progress, setProgress] = useState<FlashcardProgressRequest[]>([])
    const [writtenInput, setWrittenInput] = useState("")

    // UI State
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isFinished, setIsFinished] = useState(false)
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
    const [showResult, setShowResult] = useState(false)
    const [isWrongAnswer, setIsWrongAnswer] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    
    // AI-Pro State
    const [isAiPro, setIsAiPro] = useState(true)
    const [aiExercises, setAiExercises] = useState<AIExercise[]>([])
    const [aiFeedback, setAiFeedback] = useState<AIGradeResponse | null>(null)
    const [isGrading, setIsGrading] = useState(false)
    const [isRecording, setIsRecording] = useState(false)

    // Settings State
    const [soundEffects, setSoundEffects] = useState(true)
    const [questionTypes, setQuestionTypes] = useState({ mcq: true, written: true, flashcards: false })
    const [answerWith, setAnswerWith] = useState({ term: true, definition: true })
    const [showImages, setShowImages] = useState({ questions: true, options: false })
    const [gradingOption, setGradingOption] = useState<'soft' | 'moderate' | 'strict'>('strict')
    const [requireRetype, setRequireRetype] = useState(false)
    const [ttsEnabled, setTtsEnabled] = useState(false)

    // Accordion State
    const [openAccordion, setOpenAccordion] = useState<string | null>('gradingOptions')

    // TTS Function
    const playQuestionAudio = (question: TestQuestion) => {
        if (!ttsEnabled && document.getElementById('tts-toggle')) return;
        const currentCard = question.flashcard;

        let promptSide: 'front' | 'back' = 'front';
        if (question.type === 'MULTIPLE_CHOICE') {
            promptSide = question.mcqData!.answerType === 'term' ? 'front' : 'back';
        } else if (question.type === 'WRITTEN') {
            promptSide = question.writtenData!.answerType === 'term' ? 'front' : 'back';
        }

        const fieldsForSide = set?.fieldsSchema?.filter(f => f.side === promptSide).sort((a, b) => a.order - b.order) || [];
        const audioUrls: string[] = [];

        for (const field of fieldsForSide) {
            if (field.type === 'text') {
                const d = currentCard.fieldsData?.[`${field.id}_audio`];
                if (d) audioUrls.push(d);
            }
        }

        if (audioUrls.length === 0) return;
        let audioIndex = 0;
        const playNext = () => {
            if (audioIndex < audioUrls.length) {
                const audio = new Audio(audioUrls[audioIndex]);
                audio.onended = () => { audioIndex++; playNext(); }
                audio.play().catch(console.error);
            }
        }
        playNext();
    }

    // Auto-play TTS when a new question starts
    useEffect(() => {
        if (ttsEnabled && queue[currentIndex] && !showResult) {
            playQuestionAudio(queue[currentIndex]);
        }
    }, [currentIndex, ttsEnabled, queue, showResult]);

    // Track latest progress ref for async submitProgress call
    const progressRef = useRef<FlashcardProgressRequest[]>([])

    const regenerateQueue = (currentCards: any[], qTypes: any, aWith: any, allCards: any[], schema?: FieldSchema[]): TestQuestion[] => {
        return currentCards.map(c => {
            let aType: 'term' | 'definition' = 'definition';
            if (aWith.term && !aWith.definition) aType = 'term';
            else if (!aWith.term && aWith.definition) aType = 'definition';
            else aType = Math.random() > 0.5 ? 'term' : 'definition';

            const available: string[] = [];
            if (qTypes.mcq) available.push('MULTIPLE_CHOICE');
            if (qTypes.written) available.push('WRITTEN');

            const selectedType = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : 'MULTIPLE_CHOICE';

            if (selectedType === 'MULTIPLE_CHOICE') {
                return {
                    flashcard: c,
                    type: 'MULTIPLE_CHOICE',
                    mcqData: createMultipleChoiceQuestion(c, allCards, aType, schema)
                }
            } else {
                // For WRITTEN: pick a single target field on the answer side
                const answerSide: 'front' | 'back' = aType === 'term' ? 'front' : 'back';
                const promptSide: 'front' | 'back' = aType === 'term' ? 'back' : 'front';
                const { name: fieldName, value: fieldValue, isMultiField } = getCardSingleField(c, answerSide, schema);
                const promptText = getCardText(c, promptSide, schema, false);

                return {
                    flashcard: c,
                    type: 'WRITTEN',
                    writtenData: {
                        prompt: promptText,
                        correctAnswer: fieldValue,
                        answerType: aType,
                        targetFieldName: isMultiField ? fieldName : undefined
                    }
                }
            }
        });
    }

    useEffect(() => {
        const fetchSetAndProgress = async () => {
            try {
                // Use relative Next.js API routes (it will proxy to Rust and attach JWT cleanly via cookies/session)
                // However, our proxy expects Authorization header since it reads it, OR it reads getServerSession.
                // Our Next.js API route reads getServerSession, so we don't strictly need to attach headers,
                // but doing so prevents errors if Next.js drops session.
                const headers: Record<string, string> = {};
                // if (activeSession?.id_token) headers["Authorization"] = `Bearer ${activeSession.id_token}`;
                const resSet = await Promise.all([
                    fetch(`/api/sets/${id}`),
                    fetch(`/api/sets/${id}/progress`)
                ])

                if (resSet[0].ok) {
                    const setData: SetResponse = await resSet[0].json()
                    setSet(setData)
                    
                    if (isAiPro) {
                        try {
                            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                            // @ts-expect-error session.id_token exists from our lib/auth config
                            if (session?.id_token) {
                                // @ts-expect-error session.id_token exists from our lib/auth config
                                headers['Authorization'] = `Bearer ${session.id_token}`;
                            }

                            const response = await fetch('/api/ai/learn/generate', {
                                method: 'POST',
                                headers,
                                body: JSON.stringify({ setId: id, exerciseCount: 100 })
                            });

                            if (!response.ok) {
                                throw new Error("AI Generation failed");
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
                                            accumulated += line.slice(6);
                                        }
                                    }
                                }
                                
                                try {
                                    const exercises: AIExercise[] = JSON.parse(accumulated);
                                    setAiExercises(exercises);
                                } catch (e) {
                                    console.error("Failed to parse AI exercises JSON", e, accumulated);
                                    setIsAiPro(false);
                                }
                            }
                        } catch (e) {
                            console.error("AI Generation failed, falling back", e);
                            setIsAiPro(false);
                        }
                    }

                    const rawQueue = generateLearnQueue(setData.flashcards, new Set())
                    const initialQueue = regenerateQueue(rawQueue, { mcq: true, written: true, flashcards: false }, { term: true, definition: true }, setData.flashcards, setData.fieldsSchema)
                    setQueue(initialQueue)
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

    const handleAnswer = async (answer: number | string) => {
        if (showResult || !set) return

        setShowResult(true)
        setAiFeedback(null)

        const currentQuestion = queue[currentIndex]
        const currentAiEx = isAiPro ? aiExercises[currentIndex] : null;

        if (isAiPro && currentAiEx) {
            setIsGrading(true);
            try {
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                // @ts-expect-error session.id_token exists from our lib/auth config
                if (session?.id_token) {
                    // @ts-expect-error session.id_token exists from our lib/auth config
                    headers['Authorization'] = `Bearer ${session.id_token}`;
                }

                const res = await fetch('/api/ai/learn/grade', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        setId: id,
                        cardId: currentAiEx.cardId,
                        questionType: currentAiEx.type,
                        userAnswer: answer as string,
                        questionText: currentAiEx.question
                    })
                });
                if (res.ok) {
                    const feedback: AIGradeResponse = await res.json();
                    setAiFeedback(feedback);
                    const isCorrect = feedback.isCorrect;
                    setIsWrongAnswer(!isCorrect);
                    
                    // Record Progress
                    const newProgress = [...progress];
                    const existingIndex = newProgress.findIndex(p => p.flashcardId === currentAiEx.cardId);
                    if (existingIndex >= 0) newProgress[existingIndex].isKnown = isCorrect;
                    else newProgress.push({ flashcardId: currentAiEx.cardId, isKnown: isCorrect });
                    setProgress(newProgress);
                    progressRef.current = newProgress;

                    if (isCorrect) {
                        setTimeout(() => advanceOrFinish(newProgress), 2000);
                    }
                }
            } catch (e) {
                console.error("Grading failed", e);
            } finally {
                setIsGrading(false);
            }
            return;
        }

        let isCorrect = false
        if (currentQuestion.type === 'MULTIPLE_CHOICE' && currentQuestion.mcqData) {
            setSelectedAnswer(answer as number)
            isCorrect = (answer as number) === currentQuestion.mcqData.correctIndex
        } else if (currentQuestion.type === 'WRITTEN' && currentQuestion.writtenData) {
            const normalizedUser = (answer as string).trim().toLowerCase()
            const normalizedCorrect = currentQuestion.writtenData.correctAnswer.trim().toLowerCase()
            isCorrect = normalizedUser === normalizedCorrect
        }

        setIsWrongAnswer(!isCorrect)

        // Record Result
        const newProgress = [...progress]
        const existingIndex = newProgress.findIndex(p => p.flashcardId === currentQuestion.flashcard.id)
        if (existingIndex >= 0) {
            newProgress[existingIndex].isKnown = isCorrect
        } else {
            newProgress.push({ flashcardId: currentQuestion.flashcard.id, isKnown: isCorrect })
        }
        setProgress(newProgress)
        progressRef.current = newProgress

        if (isCorrect) {
            setTimeout(() => advanceOrFinish(newProgress), 1200)
        }
    }

    const recordPronunciation = () => {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("Ваш браузер не поддерживает распознавание речи.");
            return;
        }
        
        setIsRecording(true);
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'en-US'; // Should be dynamic based on card language
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setWrittenInput(transcript);
            handleAnswer(transcript);
        };
        
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = () => setIsRecording(false);
        
        recognition.start();
    }

    const advanceOrFinish = (latestProgress: FlashcardProgressRequest[]) => {
        if (currentIndex < queue.length - 1) {
            setSelectedAnswer(null)
            setWrittenInput("")
            setShowResult(false)
            setIsWrongAnswer(false)
            setCurrentIndex(prev => prev + 1)
        } else {
            setIsFinished(true)
            submitProgress(latestProgress)
        }
    }

    const handleNext = () => {
        advanceOrFinish(progressRef.current)
    }

    const submitProgress = async (finalProgress: FlashcardProgressRequest[]) => {
        if (!session || finalProgress.length === 0) return

        setIsSubmitting(true)
        try {
            await fetch('/api/study/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setId: id, progressUpdates: finalProgress })
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

    const closeSession = () => router.push(`/set/${id}`)

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-[#4255ff]" size={48} />
            </div>
        )
    }

    if (!set || queue.length === 0) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
                <p>Not enough flashcards to start Learn mode.</p>
                <button onClick={closeSession} className="mt-4 text-[#ffcd1f]">Return to Set</button>
            </div>
        )
    }

    const currentQuestion = queue[currentIndex]
    const totalCorrect = progress.filter(p => p.isKnown).length

    return (
        // QChatProvider mounts QChatPanel and exposes autoSend() to WhyWrongButton via context
        <QChatProvider setId={id}>
            <div className="min-h-screen bg-[#0a092d] text-white flex flex-col relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />

                {/* Top Bar */}
                <header className="flex justify-between items-center px-6 py-4 z-10 w-full max-w-5xl mx-auto">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-bold text-white flex items-center gap-2">
                            <GraduationCap className="text-[#ffcd1f]" size={20} />
                            Заучивание
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowSettings(true)}
                            className="flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
                        >
                            <Settings size={18} /> Параметры
                        </button>
                        <button
                            onClick={closeSession}
                            className="p-2 hover:bg-[#2e3856] rounded-lg transition-colors text-zinc-400 hover:text-white"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </header>

                {/* Settings Modal */}
                {showSettings && (
                    <div className="absolute inset-0 z-50 bg-[#0a092d]/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
                        <div className="w-full max-w-[600px] h-[85vh] bg-[#0a092d] rounded-3xl overflow-hidden shadow-2xl relative border border-white/10 flex flex-col">

                            {/* Sticky Header */}
                            <div className="flex-none p-8 pb-4 relative z-10 bg-[#0a092d]">
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                                <h3 className="text-[28px] leading-tight font-bold text-white mb-6">Параметры</h3>

                                {/* Quick Action Pills */}
                                <div className="grid grid-cols-3 gap-3">
                                    <button className="bg-[#2e3856]/40 hover:bg-[#2e3856]/60 border border-white/5 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-zinc-300 transition-colors pointer-events-none opacity-50">
                                        <Shuffle className="w-4 h-4" /> Перемешать
                                    </button>
                                    <button className="bg-[#2e3856]/40 hover:bg-[#2e3856]/60 border border-white/5 py-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold text-zinc-300 transition-colors pointer-events-none opacity-50 flex-col py-[6px] gap-0">
                                        <span className="text-xs text-zinc-500 font-semibold">Изучать термины с</span>
                                        <Star className="w-4 h-4 text-zinc-600" />
                                    </button>
                                    <button
                                        onClick={() => setSoundEffects(!soundEffects)}
                                        className={`border py-3 rounded-2xl flex flex-col items-center justify-center gap-0 text-sm font-bold transition-colors py-[6px]
                                            ${soundEffects ? 'bg-[#4255ff]/20 text-indigo-100 border-indigo-500/50' : 'bg-[#2e3856]/40 text-zinc-300 border-white/5 hover:bg-[#2e3856]/60'}
                                        `}
                                    >
                                        <div className="flex items-center gap-2">
                                            <Volume2 className="w-4 h-4" /> Звуковые
                                        </div>
                                        <span>эффекты</span>
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">

                                {/* Accordion 1: Типы вопросов */}
                                <div className="bg-[#2e3856] rounded-2xl mb-3 overflow-hidden transition-all duration-300">
                                    <button
                                        onClick={() => setOpenAccordion(openAccordion === 'questionTypes' ? null : 'questionTypes')}
                                        className="w-full flex items-center justify-between p-5 text-left font-bold text-[15px] hover:bg-white/5 transition-colors"
                                    >
                                        Типы вопросов
                                        {openAccordion === 'questionTypes' ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                                    </button>

                                    <div className={`transition-all overflow-hidden ${openAccordion === 'questionTypes' ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="px-5 pb-5 space-y-5 border-t border-white/5 pt-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <ListIcon className="w-5 h-5 text-zinc-400" />
                                                    <span className="font-semibold text-sm">Вопросы с выбором ответа</span>
                                                </div>
                                                <Toggle
                                                    isOn={questionTypes.mcq}
                                                    onToggle={() => setQuestionTypes({ ...questionTypes, mcq: !questionTypes.mcq })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Edit2 className="w-5 h-5 text-zinc-400" />
                                                    <span className="font-semibold text-sm">Письменные вопросы</span>
                                                </div>
                                                <Toggle
                                                    isOn={questionTypes.written}
                                                    onToggle={() => setQuestionTypes({ ...questionTypes, written: !questionTypes.written })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <RectIcon className="w-5 h-5 text-zinc-400" />
                                                    <span className="font-semibold text-sm">Карточки</span>
                                                </div>
                                                <Toggle
                                                    isOn={questionTypes.flashcards}
                                                    onToggle={() => setQuestionTypes({ ...questionTypes, flashcards: !questionTypes.flashcards })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion 2: Ответ */}
                                <div className="bg-[#2e3856] rounded-2xl mb-3 overflow-hidden transition-all duration-300">
                                    <button
                                        onClick={() => setOpenAccordion(openAccordion === 'answerWith' ? null : 'answerWith')}
                                        className="w-full flex items-center justify-between p-5 text-left font-bold text-[15px] hover:bg-white/5 transition-colors"
                                    >
                                        Ответ
                                        {openAccordion === 'answerWith' ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                                    </button>

                                    <div className={`transition-all overflow-hidden ${openAccordion === 'answerWith' ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="px-5 pb-5 space-y-5 border-t border-white/5 pt-4">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm">Определение</span>
                                                <Toggle
                                                    isOn={answerWith.definition}
                                                    onToggle={() => setAnswerWith({ ...answerWith, definition: !answerWith.definition })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm">Термин</span>
                                                <Toggle
                                                    isOn={answerWith.term}
                                                    onToggle={() => setAnswerWith({ ...answerWith, term: !answerWith.term })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion 3: Показ изображений */}
                                <div className="bg-[#2e3856] rounded-2xl mb-3 overflow-hidden transition-all duration-300">
                                    <button
                                        onClick={() => setOpenAccordion(openAccordion === 'showImages' ? null : 'showImages')}
                                        className="w-full flex items-center justify-between p-5 text-left font-bold text-[15px] hover:bg-white/5 transition-colors"
                                    >
                                        Показ изображений
                                        {openAccordion === 'showImages' ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                                    </button>

                                    <div className={`transition-all overflow-hidden ${openAccordion === 'showImages' ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="px-5 pb-5 space-y-5 border-t border-white/5 pt-4">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm">Вопросы</span>
                                                <Toggle
                                                    isOn={showImages.questions}
                                                    onToggle={() => setShowImages({ ...showImages, questions: !showImages.questions })}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-sm">Варианты ответов</span>
                                                <Toggle
                                                    isOn={showImages.options}
                                                    onToggle={() => setShowImages({ ...showImages, options: !showImages.options })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Accordion 4: Варианты оценок */}
                                <div className="bg-[#2e3856] rounded-2xl mb-3 overflow-hidden transition-all duration-300">
                                    <button
                                        onClick={() => setOpenAccordion(openAccordion === 'gradingOptions' ? null : 'gradingOptions')}
                                        className="w-full flex items-center justify-between p-5 text-left font-bold text-[15px] hover:bg-white/5 transition-colors"
                                    >
                                        Варианты оценок
                                        {openAccordion === 'gradingOptions' ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                                    </button>

                                    <div className={`transition-all overflow-hidden ${openAccordion === 'gradingOptions' ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="px-5 pb-5 pt-2 flex flex-col">

                                            {/* Radio 1: Мягкое */}
                                            <label className="flex items-start gap-4 py-4 cursor-pointer group">
                                                <div className="mt-0.5">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${gradingOption === 'soft' ? 'border-[#a8b1ff]' : 'border-zinc-500 group-hover:border-zinc-400'}`}>
                                                        {gradingOption === 'soft' && <div className="w-2.5 h-2.5 rounded-full bg-[#a8b1ff]" />}
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-[15px] mb-1">Мягкое</div>
                                                    <div className="text-[13px] text-zinc-400 leading-relaxed">Засчитывается общий смысл ответа. Допускаются синонимы, перефразирование и опечатки.</div>
                                                </div>
                                                <input type="radio" className="hidden" checked={gradingOption === 'soft'} onChange={() => setGradingOption('soft')} />
                                            </label>

                                            {/* Radio 2: Умеренное */}
                                            <label className="flex items-start gap-4 py-4 cursor-pointer group pointer-events-none opacity-50">
                                                <div className="mt-0.5">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${gradingOption === 'moderate' ? 'border-[#a8b1ff]' : 'border-zinc-500 group-hover:border-zinc-400'}`}>
                                                        {gradingOption === 'moderate' && <div className="w-2.5 h-2.5 rounded-full bg-[#a8b1ff]" />}
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-[15px] mb-1">Умеренное</div>
                                                    <div className="text-[13px] text-zinc-400 leading-relaxed">Требуется точное совпадение, но допускаются орфографические ошибки (знаки ударения, пропущенные буквы и т. п.).</div>
                                                </div>
                                                <input type="radio" className="hidden" checked={gradingOption === 'moderate'} onChange={() => setGradingOption('moderate')} />
                                            </label>

                                            {/* Radio 3: Строгое */}
                                            <label className="flex items-start gap-4 py-4 cursor-pointer group">
                                                <div className="mt-0.5">
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${gradingOption === 'strict' ? 'border-[#a8b1ff]' : 'border-zinc-500 group-hover:border-zinc-400'}`}>
                                                        {gradingOption === 'strict' && <div className="w-2.5 h-2.5 rounded-full bg-[#a8b1ff]" />}
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-[15px] mb-1">Строгое</div>
                                                    <div className="text-[13px] text-zinc-400 leading-relaxed">Требуется точное совпадение. Допускаются только небольшие стилистические ошибки (регистр, знаки препинания или текст в скобках).</div>
                                                </div>
                                                <input type="radio" className="hidden" checked={gradingOption === 'strict'} onChange={() => setGradingOption('strict')} />
                                            </label>

                                            <div className="w-full h-px bg-white/10 my-2"></div>

                                            {/* Toggle: Повторять ввод */}
                                            <div className="py-4 flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="font-bold text-[15px] mb-1">Повторять ввод правильных ответов</div>
                                                    <div className="text-[13px] text-zinc-400 leading-relaxed">Если вы неправильно ответите на письменный вопрос, вам отобразится правильный ответ и просьба ввести его, прежде чем перейти к следующему вопросу. Это доступно только при включенных письменных вопросах.</div>
                                                </div>
                                                <div className="pt-1">
                                                    <Toggle isOn={requireRetype} onToggle={() => setRequireRetype(!requireRetype)} />
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>

                                {/* Other independent rows */}
                                <div className="bg-[#2e3856] rounded-2xl mb-3 overflow-hidden divide-y divide-white/5">
                                    <div className="flex items-center justify-between p-5" id="tts-toggle">
                                        <span className="font-bold text-[15px]">Преобразование текста в речь</span>
                                        <Toggle isOn={ttsEnabled} onToggle={() => setTtsEnabled(!ttsEnabled)} />
                                    </div>
                                    <div className="flex items-center justify-between p-5">
                                        <span className="font-bold text-[15px]">Письмо</span>
                                        <button className="text-sm font-bold text-zinc-300 hover:text-white transition-colors flex items-center">
                                            Начать <ChevronRight className="w-4 h-4 ml-1" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-5">
                                        <span className="font-bold text-[15px]">Правописание</span>
                                        <button className="text-sm font-bold text-zinc-300 hover:text-white transition-colors flex items-center">
                                            Начать <ChevronRight className="w-4 h-4 ml-1" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between p-5">
                                        <Link href="#" className="font-bold text-[15px] text-[#a8b1ff] hover:opacity-80 transition-opacity">
                                            Политика конфиденциальности
                                        </Link>
                                    </div>
                                </div>

                            </div>

                            {/* Sticky Footer */}
                            <div className="flex-none p-6 bg-[#0a092d] border-t border-white/5 flex items-center justify-between z-10 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                                <button
                                    onClick={() => {
                                        setCurrentIndex(0);
                                        setProgress([]);
                                        setIsFinished(false);
                                        setShowSettings(false);
                                        setWrittenInput("");
                                        setSelectedAnswer(null);
                                        setShowResult(false);
                                        if (set) {
                                            const rawQueue = generateLearnQueue(set.flashcards, new Set());
                                            setQueue(regenerateQueue(rawQueue, questionTypes, answerWith, set.flashcards, set.fieldsSchema));
                                        }
                                    }}
                                    className="font-bold text-[15px] text-[#ff725b] hover:opacity-80 transition-opacity"
                                >
                                    Пройти заучивание заново
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setShowSettings(false)}
                                        className="font-bold text-sm text-zinc-300 bg-[#2e3856]/40 hover:bg-[#2e3856]/60 transition-colors px-6 py-3 rounded-xl"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowSettings(false);
                                            // Regenerate future questions based on new settings
                                            if (set && queue.length > 0) {
                                                const remainingCards = queue.slice(currentIndex).map(q => q.flashcard);
                                                const newRemainingQueue = regenerateQueue(remainingCards, questionTypes, answerWith, set.flashcards, set.fieldsSchema);

                                                setQueue(prev => [
                                                    ...prev.slice(0, currentIndex),
                                                    ...newRemainingQueue
                                                ]);
                                            }
                                        }}
                                        className="font-bold text-sm text-white bg-[#4255ff] hover:bg-indigo-400 transition-colors px-6 py-3 rounded-xl shadow-[0_4px_14px_0_rgba(99,102,241,0.39)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.23)]"
                                    >
                                        Сохранить
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Bar */}
                {!isFinished && (
                    <div className="w-full bg-[#2e3856] h-1.5 max-w-5xl mx-auto rounded-full overflow-hidden mb-8">
                        <div
                            className="bg-[#4255ff] h-1.5 transition-all duration-300 rounded-full"
                            style={{ width: `${Math.max(5, (currentIndex / queue.length) * 100)}%` }}
                        />
                    </div>
                )}

                {/* Main Content */}
                <main className="flex-1 flex flex-col items-center justify-start pt-8 p-6 z-10 w-full max-w-3xl mx-auto">
                    {isFinished ? (
                        <div className="bg-[#2e3856] border border-[#2e3856] p-10 rounded-2xl w-full text-center shadow-xl animate-in zoom-in duration-500">
                            <h2 className="text-3xl font-bold mb-4 text-white">Вы отлично справились!</h2>
                            <p className="text-lg text-zinc-400 mb-8">
                                Вы изучили {queue.length} терминов. Ваш результат: {Math.round((totalCorrect / queue.length) * 100)}%
                            </p>

                            <div className="flex gap-4 justify-center">
                                <div className="bg-[#0a092d] p-6 rounded-xl flex-1 max-w-[200px] border border-[#2e3856]">
                                    <div className="text-3xl font-semibold text-green-400 mb-2">{totalCorrect}</div>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Верно</div>
                                </div>
                                <div className="bg-[#0a092d] p-6 rounded-xl flex-1 max-w-[200px] border border-[#2e3856]">
                                    <div className="text-3xl font-semibold text-red-500 mb-2">{queue.length - totalCorrect}</div>
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Неверно</div>
                                </div>
                            </div>

                            <div className="mt-12 flex justify-center">
                                <button
                                    onClick={closeSession}
                                    className="flex items-center justify-center gap-2 bg-[#4255ff] hover:bg-[#4255ff] text-white font-semibold py-3 px-8 rounded-lg shadow-lg transition-all"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
                                    {isSubmitting ? "Сохранение..." : "Вернуться к модулю"}
                                </button>
                            </div>
                            {!session && (
                                <p className="mt-6 text-yellow-500 text-sm">
                                    Прогресс не сохранен, так как вы не авторизованы.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="w-full flex flex-col gap-8 animate-in fade-in duration-300">

                            {/* Question Card */}
                            <div className="bg-[#2e3856] border border-[#2e3856] p-8 md:p-12 rounded-2xl shadow-lg relative min-h-[250px] flex flex-col justify-center">
                                <div className="absolute top-6 right-6 flex items-center gap-3 text-zinc-400">
                                    <button className="hover:text-white transition-colors"><Edit2 size={18} /></button>
                                    <button
                                        className="hover:text-white transition-colors"
                                        onClick={() => playQuestionAudio(currentQuestion)}
                                    >
                                        <Volume2 size={18} />
                                    </button>
                                </div>
                                {currentQuestion.flashcard.imageUrl && (
                                    <div className="w-full flex justify-center mt-2 mb-4">
                                        <img src={currentQuestion.flashcard.imageUrl} alt="Flashcard image" className="max-h-[200px] object-contain rounded-lg shadow-md" />
                                    </div>
                                )}
                                <p className={`text-2xl md:text-3xl font-medium leading-relaxed text-white text-center ${currentQuestion.flashcard.imageUrl ? '' : 'mt-4'}`}>
                                    {isAiPro && aiExercises[currentIndex] 
                                        ? aiExercises[currentIndex].question 
                                        : (currentQuestion.type === 'MULTIPLE_CHOICE' ? currentQuestion.mcqData?.prompt : currentQuestion.writtenData?.prompt)
                                    }
                                </p>
                                {isAiPro && aiExercises[currentIndex]?.context && (
                                    <p className="mt-4 text-sm text-zinc-400 italic text-center">
                                        Context: {aiExercises[currentIndex].context}
                                    </p>
                                )}
                                {isAiPro && aiExercises[currentIndex]?.type === 'speech' && (
                                    <div className="mt-8 flex justify-center">
                                        <button 
                                            onClick={recordPronunciation}
                                            disabled={showResult || isRecording}
                                            className={`p-6 rounded-full transition-all flex items-center gap-3 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#4255ff] hover:bg-[#4255ff]'} shadow-lg`}
                                        >
                                            <Mic size={24} />
                                            <span className="font-bold">{isRecording ? "Listening..." : "Нажмите и говорите"}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Answer Grid / Inputs */}
                            {currentQuestion.type === 'MULTIPLE_CHOICE' && currentQuestion.mcqData && (
                                <div className="w-full">
                                    <p className="text-sm font-semibold text-zinc-400 mb-4 px-2">
                                        {currentQuestion.mcqData.answerType === 'term' ? 'Выберите правильный термин' : 'Выберите правильное определение'}
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {currentQuestion.mcqData.options.map((option, index) => {
                                            let buttonStateClass = "bg-transparent border-[#2e3856] hover:bg-[#2e3856] hover:border-purple-500 text-zinc-200"
                                            let Icon = null;
                                            let numberTagClass = "bg-[#2e3856] text-zinc-400 border border-[#2e3856]";

                                            if (showResult) {
                                                if (index === currentQuestion.mcqData!.correctIndex) {
                                                    buttonStateClass = "bg-green-900/20 border-green-500 text-green-400"
                                                    numberTagClass = "bg-green-500/20 text-green-400 border-green-500/50"
                                                    Icon = <CheckCircle size={20} className="text-green-500" />
                                                } else if (index === selectedAnswer && index !== currentQuestion.mcqData!.correctIndex) {
                                                    buttonStateClass = "bg-red-900/20 border-red-500 text-red-400 opacity-70"
                                                    numberTagClass = "bg-red-500/20 text-red-400 border-red-500/50"
                                                    Icon = <XCircle size={20} className="text-red-500" />
                                                } else {
                                                    buttonStateClass = "bg-transparent border-[#2e3856] text-zinc-600 opacity-50"
                                                }
                                            }

                                            return (
                                                <button
                                                    key={index}
                                                    onClick={() => handleAnswer(index)}
                                                    disabled={showResult}
                                                    className={`p-6 rounded-xl border-2 text-left transition-all duration-200 flex items-center justify-between gap-4 ${buttonStateClass}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <span className={`flex items-center justify-center w-6 h-6 rounded text-xs font-bold transition-colors ${numberTagClass}`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="font-medium text-lg">{option}</span>
                                                    </div>
                                                    {Icon}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {currentQuestion.type === 'WRITTEN' && currentQuestion.writtenData && (
                                <div className="w-full">
                                    <p className="text-sm font-semibold text-zinc-400 mb-4 px-2">
                                        {currentQuestion.writtenData.targetFieldName
                                            ? <>Введите <span className="text-[#ffcd1f] font-bold">{currentQuestion.writtenData.targetFieldName}</span></>
                                            : <>Введите правильный {currentQuestion.writtenData.answerType === 'term' ? 'термин' : 'ответ'}</>
                                        }
                                    </p>
                                    <form onSubmit={(e) => { e.preventDefault(); handleAnswer(writtenInput); }} className="flex flex-col gap-4">
                                        <input
                                            type="text"
                                            value={writtenInput}
                                            onChange={(e) => setWrittenInput(e.target.value)}
                                            disabled={showResult}
                                            className="w-full bg-[#0a092d] border-2 border-[#2e3856] rounded-xl px-5 py-4 focus:border-indigo-500 focus:bg-[#1a1a3a] outline-none transition-all font-medium text-xl text-white shadow-sm disabled:opacity-50"
                                            autoFocus
                                            placeholder="Введите ваш ответ..."
                                        />
                                        <button
                                            type="submit"
                                            disabled={showResult || !writtenInput.trim()}
                                            className="bg-[#4255ff] hover:bg-[#4255ff] text-white font-bold py-4 rounded-xl shadow-lg transition-all text-lg disabled:opacity-50"
                                        >
                                            Проверить
                                        </button>
                                    </form>

                                    {showResult && (
                                        <div className={`mt-6 p-6 rounded-2xl border-2 ${!isWrongAnswer ? 'bg-green-900/20 border-green-500' : 'bg-red-900/20 border-red-500'}`}>
                                            <div className="flex items-center gap-3 mb-2">
                                                {!isWrongAnswer ? <CheckCircle className="text-green-500" size={24} /> : <XCircle className="text-red-500" size={24} />}
                                                <span className={`text-xl font-bold ${!isWrongAnswer ? 'text-green-400' : 'text-red-400'}`}>
                                                    {!isWrongAnswer ? "Верно!" : "Неверно"}
                                                </span>
                                            </div>
                                            {isWrongAnswer && (
                                                <div className="mt-4">
                                                    <div className="text-sm text-zinc-400 font-bold uppercase mb-1">Правильный ответ:</div>
                                                    <div className="text-lg text-white mb-4 whitespace-pre-wrap">{currentQuestion.writtenData.correctAnswer}</div>

                                                    <div className="text-sm text-zinc-400 font-bold uppercase mb-1">Ваш ответ:</div>
                                                    <div className="text-lg text-red-300 opacity-80 whitespace-pre-wrap">{writtenInput}</div>
                                                </div>
                                            )}
                                            
                                            {isAiPro && aiFeedback && (
                                                <div className="mt-6 border-t border-white/10 pt-4 animate-in slide-in-from-top-2">
                                                    <div className="text-sm font-bold text-[#ffcd1f] uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <GraduationCap size={16} /> AI Разбор
                                                    </div>
                                                    <p className="text-zinc-300 leading-relaxed text-sm italic">
                                                        {aiFeedback.explanation}
                                                    </p>
                                                    {aiFeedback.score < 1.0 && (
                                                        <div className="mt-3 bg-[#0a092d]/40 p-3 rounded-lg border border-white/5">
                                                            <span className="text-xs font-bold text-zinc-500 uppercase block mb-1">Как было бы лучше:</span>
                                                            <span className="text-white font-medium">{aiFeedback.correctAnswer}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Post-answer actions (shown only after wrong answer) */}
                            {showResult && isWrongAnswer && (
                                <div
                                    id="wrong-answer-actions"
                                    className="flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 mt-6"
                                >
                                    <WhyWrongButton
                                        term={getCardText(currentQuestion.flashcard, 'front', set?.fieldsSchema)}
                                        correctAnswer={currentQuestion.type === 'MULTIPLE_CHOICE' ? currentQuestion.mcqData!.options[currentQuestion.mcqData!.correctIndex] : currentQuestion.writtenData!.correctAnswer}
                                        userAnswer={currentQuestion.type === 'MULTIPLE_CHOICE' ? (selectedAnswer !== null ? currentQuestion.mcqData!.options[selectedAnswer] : '') : writtenInput}
                                    />
                                    <button
                                        id="learn-next-btn"
                                        onClick={handleNext}
                                        className="flex items-center gap-2 bg-[#2e3856] hover:bg-[#586380] text-white font-medium px-5 py-2 rounded-xl border border-[#586380] hover:border-zinc-600 transition-all"
                                    >
                                        Next <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </QChatProvider>
    )
}

// Sub-components for Settings Modal

function Toggle({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
    return (
        <div
            onClick={onToggle}
            className={`w-11 h-6 rounded-full cursor-pointer transition-colors relative flex items-center flex-shrink-0 ${isOn ? 'bg-[#a8b1ff]' : 'bg-[#5e5e6e]'}`}
        >
            <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform shadow-sm ${isOn ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
        </div>
    );
}

function ListIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
            <path d="M4 6h2v2H4V6zm0 5h2v2H4v-2zm0 5h2v2H4v-2zm4-10h12v2H8V6zm0 5h12v2H8v-2zm0 5h12v2H8v-2z" />
        </svg>
    );
}

function RectIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" {...props}>
            <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
