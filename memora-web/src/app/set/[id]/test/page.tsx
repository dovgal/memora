"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { StudySet } from "@/types/schema"
import { generateTest, TestQuestion } from "@/lib/studyUtils"
import { X, CheckCircle, XCircle, RotateCcw, Loader2 } from "lucide-react"

export default function TestModePage({ params }: { params: { id: string } }) {
    const router = useRouter()
    const [set, setSet] = useState<StudySet | null>(null)

    // Test State
    const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([])
    const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})

    // UI State
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitted, setIsSubmitted] = useState(false)
    const [score, setScore] = useState(0)

    useEffect(() => {
        const fetchSet = async () => {
            try {
                const resSet = await fetch(`/api/sets/${params.id}`)

                if (resSet.ok) {
                    const setData: StudySet = await resSet.json()
                    setSet(setData)

                    // Generate a 20 question maximum test
                    const generatedTest = generateTest(setData.flashcards, 20)
                    setTestQuestions(generatedTest)
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
    }, [params.id, router])

    const handleSelectAnswer = (questionId: string, answer: string) => {
        if (isSubmitted) return

        setUserAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }))
    }

    const submitTest = () => {
        let currentScore = 0

        testQuestions.forEach((q) => {
            const userAnswer = userAnswers[q.flashcard.id]

            if (q.type === "MULTIPLE_CHOICE" && q.mcqData) {
                const correctAnswerInfo = q.mcqData.options[q.mcqData.correctIndex]
                if (userAnswer === correctAnswerInfo) currentScore++
            } else if (q.type === "TRUE_FALSE" && q.tfData) {
                const correctBooleanString = String(q.tfData.isTrue)
                if (userAnswer === correctBooleanString) currentScore++
            }
        })

        setScore(currentScore)
        setIsSubmitted(true)
    }

    const restartTest = () => {
        if (!set) return
        setIsSubmitted(false)
        setUserAnswers({})
        setScore(0)
        setTestQuestions(generateTest(set.flashcards, 20))
        window.scrollTo({ top: 0, behavior: "smooth" })
    }

    const closeTest = () => {
        router.push(`/set/${params.id}`)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-500" size={48} />
            </div>
        )
    }

    if (!set || testQuestions.length === 0) {
        return (
            <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
                <p>Not enough flashcards to generate a test.</p>
                <button onClick={closeTest} className="mt-4 text-indigo-400">Return to Set</button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col relative">

            {/* Top Bar */}
            <header className="sticky top-0 bg-zinc-950/80 backdrop-blur-md flex justify-between items-center p-6 z-50 border-b border-zinc-800">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-orange-400 max-w-[60%] truncate">
                        Practice Test: {set.title}
                    </h1>
                </div>
                <div className="flex items-center gap-6">
                    <span className="text-zinc-400 font-medium">{testQuestions.length} Questions</span>
                    <button
                        onClick={closeTest}
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-white"
                    >
                        <X size={24} />
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col p-6 z-10 w-full max-w-4xl mx-auto pb-32">

                {isSubmitted && (
                    <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 p-10 rounded-3xl w-full text-center shadow-2xl animate-in zoom-in duration-500 mb-12">
                        <h2 className="text-4xl font-extrabold mb-4">Test Complete</h2>
                        <p className="text-xl text-zinc-400 mb-8">
                            You scored {Math.round((score / testQuestions.length) * 100)}%
                        </p>

                        <div className="flex gap-4 justify-center">
                            <div className="bg-zinc-950 p-6 rounded-2xl flex-1 max-w-[200px] border border-zinc-800">
                                <div className="text-3xl font-black text-green-400 mb-2">{score}</div>
                                <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Correct</div>
                            </div>
                            <div className="bg-zinc-950 p-6 rounded-2xl flex-1 max-w-[200px] border border-zinc-800">
                                <div className="text-3xl font-black text-red-500 mb-2">{testQuestions.length - score}</div>
                                <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Incorrect</div>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-center gap-4">
                            <button
                                onClick={restartTest}
                                className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 font-bold py-4 px-8 rounded-xl transition-all"
                            >
                                <RotateCcw size={20} /> Retake Test
                            </button>
                            <button
                                onClick={closeTest}
                                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 font-bold py-4 px-8 rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all"
                            >
                                Return to Set
                            </button>
                        </div>
                    </div>
                )}

                {/* Questions List */}
                <div className="flex flex-col gap-12">
                    {testQuestions.map((question, qIndex) => {
                        const isAnswered = userAnswers[question.flashcard.id] !== undefined;

                        return (
                            <div key={question.flashcard.id} className="bg-zinc-900/60 border border-zinc-800 p-8 rounded-3xl">
                                <div className="flex items-start gap-4 mb-6">
                                    <span className="bg-zinc-800 text-zinc-400 text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full shrink-0">
                                        {qIndex + 1}
                                    </span>
                                    <h3 className="text-xl md:text-2xl font-semibold">
                                        {question.type === "TRUE_FALSE" && question.tfData
                                            ? `True or False: ${question.flashcard.term} means "${question.tfData.statement}"`
                                            : question.flashcard.term
                                        }
                                    </h3>
                                </div>

                                <div className="flex flex-col gap-3 ml-12">
                                    {/* MCQ Rendering */}
                                    {question.type === "MULTIPLE_CHOICE" && question.mcqData?.options.map((opt, oIndex) => {
                                        const isSelected = userAnswers[question.flashcard.id] === opt;
                                        const isCorrectAnswer = opt === question.mcqData!.options[question.mcqData!.correctIndex];

                                        let uiStateClass = "bg-zinc-950 border-zinc-800 hover:bg-zinc-800  text-zinc-300";
                                        let Icon = null;

                                        if (isSubmitted) {
                                            if (isCorrectAnswer) {
                                                uiStateClass = "bg-green-950/40 border-green-500 text-green-400";
                                                Icon = <CheckCircle size={20} />
                                            } else if (isSelected && !isCorrectAnswer) {
                                                uiStateClass = "bg-red-950/40 border-red-500 text-red-400";
                                                Icon = <XCircle size={20} />
                                            } else {
                                                uiStateClass = "bg-zinc-950 border-zinc-900 text-zinc-600 opacity-50"
                                            }
                                        } else if (isSelected) {
                                            uiStateClass = "bg-indigo-900/30 border-indigo-500 text-white"
                                        }

                                        return (
                                            <button
                                                key={oIndex}
                                                onClick={() => handleSelectAnswer(question.flashcard.id, opt)}
                                                disabled={isSubmitted}
                                                className={`p-4 rounded-xl border-2 text-left transition-all duration-300 flex justify-between items-center ${uiStateClass}`}
                                            >
                                                <span>{opt}</span>
                                                {Icon}
                                            </button>
                                        )
                                    })}

                                    {/* True/False Rendering */}
                                    {question.type === "TRUE_FALSE" && ["true", "false"].map((opt) => {
                                        const isSelected = userAnswers[question.flashcard.id] === opt;
                                        const isCorrectAnswer = String(question.tfData!.isTrue) === opt;

                                        let uiStateClass = "bg-zinc-950 border-zinc-800 hover:bg-zinc-800  text-zinc-300";
                                        let Icon = null;

                                        if (isSubmitted) {
                                            if (isCorrectAnswer) {
                                                uiStateClass = "bg-green-950/40 border-green-500 text-green-400";
                                                Icon = <CheckCircle size={20} />
                                            } else if (isSelected && !isCorrectAnswer) {
                                                uiStateClass = "bg-red-950/40 border-red-500 text-red-400";
                                                Icon = <XCircle size={20} />
                                            } else {
                                                uiStateClass = "bg-zinc-950 border-zinc-900 text-zinc-600 opacity-50"
                                            }
                                        } else if (isSelected) {
                                            uiStateClass = "bg-indigo-900/30 border-indigo-500 text-white"
                                        }

                                        return (
                                            <button
                                                key={opt}
                                                onClick={() => handleSelectAnswer(question.flashcard.id, opt)}
                                                disabled={isSubmitted}
                                                className={`p-4 rounded-xl border-2 text-left transition-all duration-300 flex justify-between items-center capitalize ${uiStateClass}`}
                                            >
                                                <span>{opt}</span>
                                                {Icon}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Action Button */}
                {!isSubmitted && (
                    <div className="mt-12 flex justify-end sticky bottom-6">
                        <button
                            onClick={submitTest}
                            disabled={Object.keys(userAnswers).length !== testQuestions.length}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold py-4 px-10 rounded-full shadow-2xl transition-all text-lg"
                        >
                            Submit Test
                        </button>
                    </div>
                )}
            </main>
        </div>
    )
}
