"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { SetResponse } from "@/types/schema"
import { generateTest, TestQuestion, TestConfig } from "@/lib/studyUtils"
import { X, CheckCircle, XCircle, RotateCcw, Loader2, FileText, Settings, Layers, ListTodo } from "lucide-react"

function MatchingQuestionView({ question, currentAnswer, onChange }: { question: TestQuestion, currentAnswer: string, onChange: (val: string) => void }) {
    const data = question.matchingData!;
    const [selectedTermId, setSelectedTermId] = React.useState<string | null>(null);
    const [selectedDefId, setSelectedDefId] = React.useState<string | null>(null);
    const [shuffledDefs] = React.useState(() => [...data.pairs].sort(() => 0.5 - Math.random()));
    const parsedAnswer: Record<string, string> = currentAnswer ? JSON.parse(currentAnswer) : {};

    const handleTermClick = (id: string) => {
        if (parsedAnswer[id]) return; // already paired
        if (selectedDefId) {
            const newAnswer = { ...parsedAnswer, [id]: selectedDefId };
            onChange(JSON.stringify(newAnswer));
            setSelectedDefId(null);
        } else {
            setSelectedTermId(id === selectedTermId ? null : id);
        }
    };

    const handleDefClick = (id: string) => {
        if (Object.values(parsedAnswer).includes(id)) return; // already paired
        if (selectedTermId) {
            const newAnswer = { ...parsedAnswer, [selectedTermId]: id };
            onChange(JSON.stringify(newAnswer));
            setSelectedTermId(null);
        } else {
            setSelectedDefId(id === selectedDefId ? null : id);
        }
    };

    const getTermClass = (id: string) => {
        if (parsedAnswer[id]) return "bg-green-500/20 border-green-500/50 text-green-400 opacity-60 cursor-default";
        if (selectedTermId === id) return "bg-[#4255ff]/20 border-indigo-500 text-indigo-300 ring-2 ring-indigo-500/50";
        return "bg-[#0a092d] border-[#2e3856] hover:border-indigo-500 hover:bg-[#1a1a3a] text-zinc-300 shadow-sm";
    };

    const getDefClass = (id: string) => {
        if (Object.values(parsedAnswer).includes(id)) return "bg-green-500/20 border-green-500/50 text-green-400 opacity-60 cursor-default";
        if (selectedDefId === id) return "bg-[#4255ff]/20 border-indigo-500 text-indigo-300 ring-2 ring-indigo-500/50";
        return "bg-[#0a092d] border-[#2e3856] hover:border-indigo-500 hover:bg-[#1a1a3a] text-zinc-300 shadow-sm";
    };

    return (
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
            <div className="flex flex-col gap-3">
                <h4 className="font-bold text-zinc-500 mb-2 uppercase text-xs tracking-wider">Все термины</h4>
                {data.pairs.map((p, i) => (
                    <button key={p.flashcardId} onClick={() => handleTermClick(p.flashcardId)} className={`p-4 rounded-xl border-2 text-left font-medium transition-all duration-200 text-lg ${getTermClass(p.flashcardId)}`}>
                        {p.term}
                    </button>
                ))}
            </div>
            <div className="flex flex-col gap-3">
                <h4 className="font-bold text-zinc-500 mb-2 uppercase text-xs tracking-wider">Выберите определение</h4>
                {shuffledDefs.map((p) => (
                    <button key={p.flashcardId} onClick={() => handleDefClick(p.flashcardId)} className={`p-4 rounded-xl border-2 text-left font-medium transition-all duration-200 text-base leading-relaxed ${getDefClass(p.flashcardId)}`}>
                        {p.definition}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function TestModePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter()
    const { data: session } = useSession()

    const [set, setSet] = useState<SetResponse | null>(null)

    // Config State
    const [isConfiguring, setIsConfiguring] = useState(true)
    const [questionCount, setQuestionCount] = useState(20)
    const [allowedTypes, setAllowedTypes] = useState({
        trueFalse: true,
        multipleChoice: true,
        written: false,
        matching: false
    })

    // Test State
    const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([])
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
    const [hasStarted, setHasStarted] = useState(false)

    // UI State
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [score, setScore] = useState(0)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        const fetchSet = async () => {
            try {
                const resSet = await fetch(`/api/sets/${id}`)

                if (resSet.ok) {
                    const setData: SetResponse = await resSet.json()
                    setSet(setData)
                    setQuestionCount(Math.min(20, setData.flashcards.length))
                } else {
                    router.push('/404')
                }
            } catch (err) {
                console.error("Failed to fetch set data for test", err)
            } finally {
                setIsLoading(false)
            }
        }

        fetchSet()
    }, [id, router])

    const startTest = () => {
        if (!set) return
        const config: TestConfig = {
            limit: questionCount,
            allowedTypes,
            schema: set.fieldsSchema
        }
        setTestQuestions(generateTest(set.flashcards, config))
        setIsConfiguring(false)
        setIsSubmitted(false)
        setHasStarted(true)
        setUserAnswers({})
        setScore(0)
    }

    const closeConfig = () => {
        if (!hasStarted) {
            router.push(`/set/${id}`);
        } else {
            startTest();
        }
    }

    const handleSelectAnswer = (questionId: string, answer: string) => {
        if (isSubmitted) return

        setUserAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }))
    }

    const submitTest = async () => {
        let currentScore = 0
        const progressUpdates: { flashcardId: string; isKnown: boolean }[] = []

        testQuestions.forEach((q) => {
            const userAnswer = userAnswers[q.flashcard.id]
            let isCorrect = false

            if (q.type === "MULTIPLE_CHOICE" && q.mcqData) {
                const correctAnswerInfo = q.mcqData.options[q.mcqData.correctIndex]
                if (userAnswer === correctAnswerInfo) {
                    currentScore++
                    isCorrect = true
                }
            } else if (q.type === "TRUE_FALSE" && q.tfData) {
                const correctBooleanString = String(q.tfData.isTrue)
                if (userAnswer === correctBooleanString) {
                    currentScore++
                    isCorrect = true
                }
            } else if (q.type === "WRITTEN" && q.writtenData) {
                const normalizedUser = (userAnswer || "").trim().toLowerCase()
                const normalizedCorrect = q.writtenData.correctAnswer.trim().toLowerCase()
                if (normalizedUser === normalizedCorrect) {
                    currentScore++
                    isCorrect = true
                }
            } else if (q.type === "MATCHING" && q.matchingData) {
                try {
                    const parsed = JSON.parse(userAnswer || "{}");
                    let correctPairs = 0;
                    q.matchingData.pairs.forEach(pair => {
                        if (parsed[pair.flashcardId] === pair.flashcardId) {
                            correctPairs++;
                        }
                    });
                    if (correctPairs === q.matchingData.pairs.length) {
                        currentScore++
                        isCorrect = true
                    }
                } catch (e) { }
            }

            progressUpdates.push({
                flashcardId: q.flashcard.id,
                isKnown: isCorrect
            })
        })

        setScore(currentScore)
        setIsSubmitted(true)
        setIsSubmitting(true)

        // Dispatch progress to backend for SR
        try {
            await fetch('/api/study/progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    setId: id,
                    progressUpdates
                })
            })
        } catch (err) {
            if (!navigator.onLine) {
                console.log("Offline mode: Test progress saved locally and will sync when online.")
            } else {
                console.error("Error submitting test progress", err)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    const closeTest = () => {
        router.push(`/set/${id}`)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0a092d] flex items-center justify-center">
                <Loader2 className="animate-spin text-[#4255ff]" size={48} />
            </div>
        )
    }

    if (!set || set.flashcards.length === 0) {
        return (
            <div className="min-h-screen bg-[#0a092d] text-white flex flex-col items-center justify-center">
                <p>Not enough flashcards to generate a test.</p>
                <button onClick={closeTest} className="mt-4 text-[#ffcd1f]">Return to Set</button>
            </div>
        )
    }

    // Modal: Configuration Screen
    if (isConfiguring) {
        return (
            <div className="min-h-screen bg-[#0a092d] flex flex-col text-white font-sans items-center justify-center relative">
                <button
                    onClick={closeConfig}
                    className="absolute top-6 left-6 flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm font-semibold"
                >
                    <X size={20} /> Назад
                </button>

                <div className="w-full max-w-2xl bg-[#2e3856] border border-[#2e3856] rounded-2xl p-8 md:p-12 shadow-2xl animate-in zoom-in duration-300">
                    <div className="flex flex-col items-center text-center mb-10">
                        <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center mb-6 border border-orange-500/30">
                            <FileText size={32} className="text-orange-400" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Настройте свой тест</h1>
                        <p className="text-zinc-400 font-medium">Модуль: {set.title}</p>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    <ListTodo size={20} className="text-zinc-400" />
                                    Количество вопросов
                                </h3>
                                <span className="text-zinc-500 text-sm font-medium">Макс: {set.flashcards.length}</span>
                            </div>
                            <input
                                type="number"
                                min={1}
                                max={set.flashcards.length}
                                value={questionCount}
                                onChange={(e) => setQuestionCount(Math.min(set.flashcards.length, Math.max(1, parseInt(e.target.value) || 1)))}
                                className="w-full bg-[#0a092d] border border-[#2e3856] rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors font-medium text-lg"
                            />
                        </div>

                        <div>
                            <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                                <Layers size={20} className="text-zinc-400" />
                                Формат
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex items-center gap-3 p-4 bg-[#0a092d] border border-[#2e3856] rounded-xl cursor-pointer hover:border-zinc-500 transition-colors">
                                    <div className={`w-5 h-5 rounded overflow-hidden flex items-center justify-center border ${allowedTypes.trueFalse ? 'bg-[#4255ff] border-indigo-500' : 'bg-transparent border-zinc-500'}`}>
                                        {allowedTypes.trueFalse && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={allowedTypes.trueFalse}
                                        onChange={() => setAllowedTypes(prev => ({ ...prev, trueFalse: !prev.trueFalse }))}
                                    />
                                    <span className="font-medium">Верно / неверно</span>
                                </label>

                                <label className="flex items-center gap-3 p-4 bg-[#0a092d] border border-[#2e3856] rounded-xl cursor-pointer hover:border-zinc-500 transition-colors">
                                    <div className={`w-5 h-5 rounded overflow-hidden flex items-center justify-center border ${allowedTypes.multipleChoice ? 'bg-[#4255ff] border-indigo-500' : 'bg-transparent border-zinc-500'}`}>
                                        {allowedTypes.multipleChoice && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={allowedTypes.multipleChoice}
                                        onChange={() => setAllowedTypes(prev => ({ ...prev, multipleChoice: !prev.multipleChoice }))}
                                    />
                                    <span className="font-medium">С выбором ответа</span>
                                </label>

                                <label className="flex items-center gap-3 p-4 bg-[#0a092d] border border-[#2e3856] rounded-xl cursor-pointer hover:border-zinc-500 transition-colors">
                                    <div className={`w-5 h-5 rounded overflow-hidden flex items-center justify-center border ${allowedTypes.written ? 'bg-[#4255ff] border-indigo-500' : 'bg-transparent border-zinc-500'}`}>
                                        {allowedTypes.written && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={allowedTypes.written}
                                        onChange={() => setAllowedTypes(prev => ({ ...prev, written: !prev.written }))}
                                    />
                                    <span className="font-medium">Письменный</span>
                                </label>

                                <label className="flex items-center gap-3 p-4 bg-[#0a092d] border border-[#2e3856] rounded-xl cursor-pointer hover:border-zinc-500 transition-colors">
                                    <div className={`w-5 h-5 rounded overflow-hidden flex items-center justify-center border ${allowedTypes.matching ? 'bg-[#4255ff] border-indigo-500' : 'bg-transparent border-zinc-500'}`}>
                                        {allowedTypes.matching && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={allowedTypes.matching}
                                        onChange={() => setAllowedTypes(prev => ({ ...prev, matching: !prev.matching }))}
                                    />
                                    <span className="font-medium">Подбор</span>
                                </label>
                            </div>
                        </div>

                        <button
                            onClick={startTest}
                            disabled={!allowedTypes.trueFalse && !allowedTypes.multipleChoice && !allowedTypes.written && !allowedTypes.matching}
                            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all text-lg mt-8 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {hasStarted ? "Применить и начать заново" : "Начать тест"}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0a092d] text-white flex flex-col relative font-sans">

            {/* Top Bar - Dark Mode */}
            <header className="sticky top-0 bg-[#0a092d] flex justify-between items-center px-6 py-4 z-50 border-b border-[#2e3856] shadow-sm">
                <div className="flex items-center gap-4">
                    <div>
                        <h1 className="text-lg font-bold text-white">Тест</h1>
                        <p className="text-xs font-semibold text-zinc-400 truncate max-w-[200px] md:max-w-md">{set.title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-zinc-400 font-semibold text-sm hidden md:block">Вопросов: {testQuestions.length}</span>
                    <button onClick={() => setIsConfiguring(true)} className="p-2 hover:bg-[#2e3856] rounded-lg transition-colors text-zinc-400 hover:text-white" title="Настройки">
                        <Settings size={24} />
                    </button>
                    <button
                        onClick={closeTest}
                        className="p-2 hover:bg-[#2e3856] rounded-lg transition-colors text-zinc-400 hover:text-white"
                        title="Закрыть тест"
                    >
                        <X size={24} />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col p-6 z-10 w-full max-w-4xl mx-auto pb-32">

                {isSubmitted ? (
                    <div className="bg-[#2e3856] border text-center border-[#2e3856] p-10 rounded-2xl w-full shadow-md animate-in zoom-in duration-500 mb-12 flex flex-col items-center">
                        <div className="w-24 h-24 mb-6 rounded-full border-8 border-orange-500 flex items-center justify-center">
                            <span className="text-3xl font-semibold text-orange-500">{Math.round((score / testQuestions.length) * 100)}%</span>
                        </div>
                        <h2 className="text-3xl font-bold mb-2 text-white">Ваш результат</h2>
                        <p className="text-zinc-400 font-medium mb-10">
                            Вы правильно ответили на {score} из {testQuestions.length} вопросов.
                        </p>

                        <div className="flex gap-6 justify-center w-full max-w-md">
                            <div className="bg-green-500/10 rounded-xl p-4 flex-1 border border-green-500/20">
                                <div className="text-3xl font-semibold text-green-400 mb-1">{score}</div>
                                <div className="text-xs font-bold text-green-400/80 uppercase tracking-widest">Верно</div>
                            </div>
                            <div className="bg-red-500/10 rounded-xl p-4 flex-1 border border-red-500/20">
                                <div className="text-3xl font-semibold text-red-500 mb-1">{testQuestions.length - score}</div>
                                <div className="text-xs font-bold text-red-500/80 uppercase tracking-widest">Неверно</div>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-center gap-4 w-full max-w-md">
                            <button
                                onClick={() => setIsConfiguring(true)}
                                className="flex-1 items-center justify-center gap-2 bg-[#0a092d] border border-[#2e3856] hover:border-zinc-500 text-white font-bold py-3 rounded-xl transition-all"
                            >
                                Настроить
                            </button>
                            <button
                                onClick={startTest}
                                className="flex-1 items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-600/20 transition-all"
                            >
                                <RotateCcw size={18} className="inline mr-2" /> Пройти еще раз
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-10">
                        {testQuestions.map((question, qIndex) => {
                            const isAnswered = userAnswers[question.flashcard.id] !== undefined;

                            return (
                                <div key={question.flashcard.id} className="bg-[#2e3856] border border-[#2e3856] shadow-sm p-8 rounded-2xl">
                                    <div className="flex justify-between items-start mb-6 border-b border-[#2e3856] pb-6">
                                        <h3 className="text-xl md:text-2xl font-semibold leading-relaxed">
                                            {question.type === "TRUE_FALSE" && question.tfData
                                                ? <span className="text-white">Правда или ложь, что <span className="font-bold text-[#ffcd1f] px-1">{question.flashcard.term}</span> означает <span className="font-bold text-[#ffcd1f] px-1">"{question.tfData.statement}"</span>?</span>
                                                : question.type === "MULTIPLE_CHOICE" && question.mcqData
                                                    ? <span className="text-white">Выберите правильный вариант для: <br /><span className="font-bold text-[#ffcd1f] inline-block mt-2 whitespace-pre-wrap">{question.mcqData.prompt}</span></span>
                                                    : question.type === "WRITTEN" && question.writtenData
                                                        ? <span className="text-white">Введите {question.writtenData.answerType === 'term' ? 'термин' : 'определение'} для: <br /><span className="font-bold text-[#ffcd1f] inline-block mt-2 whitespace-pre-wrap">{question.writtenData.prompt}</span></span>
                                                        : question.type === "MATCHING"
                                                            ? <span className="text-white">Сопоставьте термины и определения:</span>
                                                            : <span className="text-white">{question.flashcard.term}</span>
                                            }
                                        </h3>
                                        <span className="text-zinc-400 font-bold text-sm bg-[#0a092d] px-3 py-1 rounded-full shrink-0 ml-4 mt-1 border border-[#2e3856]">{qIndex + 1} / {testQuestions.length}</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* MCQ Rendering */}
                                        {question.type === "MULTIPLE_CHOICE" && question.mcqData?.options.map((opt, oIndex) => {
                                            const isSelected = userAnswers[question.flashcard.id] === opt;
                                            const uiStateClass = isSelected ? "bg-[#4255ff]/20 border-indigo-500 text-indigo-300 ring-2 ring-indigo-500/50" : "bg-[#0a092d] border-[#2e3856] hover:border-indigo-500 hover:bg-[#1a1a3a] text-zinc-300 shadow-sm";

                                            return (
                                                <button
                                                    key={oIndex}
                                                    onClick={() => handleSelectAnswer(question.flashcard.id, opt)}
                                                    className={`p-5 rounded-xl border-2 text-left transition-all duration-200 font-medium text-lg leading-relaxed whitespace-pre-wrap ${uiStateClass}`}
                                                >
                                                    {opt}
                                                </button>
                                            )
                                        })}

                                        {/* True/False Rendering */}
                                        {question.type === "TRUE_FALSE" && ["true", "false"].map((opt) => {
                                            const isSelected = userAnswers[question.flashcard.id] === opt;
                                            const optLabel = opt === "true" ? "Верно" : "Неверно";
                                            const uiStateClass = isSelected ? "bg-[#4255ff]/20 border-indigo-500 text-indigo-300 ring-2 ring-indigo-500/50" : "bg-[#0a092d] border-[#2e3856] hover:border-indigo-500 hover:bg-[#1a1a3a] text-zinc-300 shadow-sm";

                                            return (
                                                <button
                                                    key={opt}
                                                    onClick={() => handleSelectAnswer(question.flashcard.id, opt)}
                                                    className={`p-5 rounded-xl border-2 text-center transition-all duration-200 font-bold text-lg ${uiStateClass}`}
                                                >
                                                    {optLabel}
                                                </button>
                                            )
                                        })}

                                        {/* Written Rendering */}
                                        {question.type === "WRITTEN" && question.writtenData && (
                                            <div className="col-span-1 md:col-span-2">
                                                <input
                                                    type="text"
                                                    value={userAnswers[question.flashcard.id] || ""}
                                                    onChange={(e) => handleSelectAnswer(question.flashcard.id, e.target.value)}
                                                    placeholder="Введите ваш ответ..."
                                                    className="w-full bg-[#0a092d] border border-[#2e3856] rounded-xl px-5 py-4 focus:border-indigo-500 outline-none transition-all font-medium text-xl text-white shadow-sm"
                                                    autoComplete="off"
                                                />
                                            </div>
                                        )}

                                        {/* Matching Rendering */}
                                        {question.type === "MATCHING" && question.matchingData && (
                                            <MatchingQuestionView
                                                question={question}
                                                currentAnswer={userAnswers[question.flashcard.id] || ""}
                                                onChange={(val) => handleSelectAnswer(question.flashcard.id, val)}
                                            />
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Action Button */}
                {!isSubmitted && (
                    <div className="mt-12 flex justify-end sticky bottom-6 bg-[#0a092d]/80 backdrop-blur border border-[#2e3856] p-4 rounded-2xl shadow-lg">
                        <button
                            onClick={submitTest}
                            disabled={Object.keys(userAnswers).length !== testQuestions.length || isSubmitting}
                            className="bg-orange-600 hover:bg-orange-500 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white font-bold py-4 px-10 rounded-xl transition-all text-lg flex items-center justify-center gap-2 min-w-[200px]"
                        >
                            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Завершить тест"}
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}

