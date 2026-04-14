'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { CheckCircle, XCircle } from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

// Option colours — visually distinguish choices like Kahoot
const OPTION_COLOURS = [
    { bg: 'bg-red-600', hoverBg: 'hover:bg-red-500', border: 'border-red-500' },
    { bg: 'bg-blue-600', hoverBg: 'hover:bg-blue-500', border: 'border-blue-500' },
    { bg: 'bg-yellow-500', hoverBg: 'hover:bg-yellow-400', border: 'border-yellow-400' },
    { bg: 'bg-green-600', hoverBg: 'hover:bg-green-500', border: 'border-green-500' },
];

interface Question {
    index: number;
    total: number;
    term: string;
    options: string[];
}

interface StudentGamePageProps {
    params: Promise<{ roomId: string }>;
}

export default function StudentGamePage({ params }: StudentGamePageProps) {
    const router = useRouter();
    const { data: session } = useSession();

    const [roomId, setRoomId] = useState<string | null>(null);
    const [question, setQuestion] = useState<Question | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
    const [team, setTeam] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);

    useEffect(() => { params.then(p => setRoomId(p.roomId)); }, [params]);

    const connectWs = useCallback(() => {
        if (!roomId) return;
        // @ts-expect-error id_token injected by custom authOptions
        const token = session?.id_token ?? 'anonymous';
        const ws = new WebSocket(`${WS_URL}/api/live/ws?room_id=${roomId}&token=${token}`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string);
                if (msg.type === 'team_assigned') setTeam(msg.team);
                if (msg.type === 'question') {
                    setQuestion(msg as Question);
                    setSelectedAnswer(null);
                    setCorrectAnswer(null);
                }
                if (msg.type === 'reveal_answer') setCorrectAnswer(msg.correctAnswer);
                if (msg.type === 'game_over') router.push(`/live/${roomId}/results`);
            } catch { /* ignore */ }
        };
    }, [roomId, session, router]);

    useEffect(() => { const c = connectWs(); return c; }, [connectWs]);

    const handleAnswer = (index: number) => {
        if (selectedAnswer !== null || !question || !wsRef.current) return;
        setSelectedAnswer(index);
        wsRef.current.send(JSON.stringify({
            type: 'answer',
            optionIndex: index,
            term: question.term,
        }));
    };

    if (!question) {
        return (
            <div className="min-h-screen bg-[#0a092d] flex flex-col items-center justify-center gap-4 text-white">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-500 text-sm">Waiting for the next question…</p>
            </div>
        );
    }

    const isAnswered = selectedAnswer !== null;

    return (
        <div className="min-h-screen bg-[#0a092d] text-white flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-[#2e3856] bg-[#0a092d]/60">
                {team && <span className="text-sm font-bold text-zinc-400">Team {team}</span>}
                <span className="text-sm text-zinc-500 tabular-nums mx-auto">
                    Q {question.index} / {question.total}
                </span>
                {isAnswered && (
                    <span className="text-xs text-zinc-600">Waiting for others…</span>
                )}
            </header>

            {/* Term */}
            <div className="px-6 py-8 text-center">
                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Term</p>
                <p className="text-2xl md:text-3xl font-bold leading-snug">{question.term}</p>
            </div>

            {/* Answer grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 items-start">
                {question.options.map((opt, i) => {
                    const colour = OPTION_COLOURS[i % OPTION_COLOURS.length];
                    const isSelected = selectedAnswer === i;
                    const isCorrect = correctAnswer === opt;
                    const isWrong = isSelected && correctAnswer !== null && !isCorrect;

                    let stateClass = `${colour.bg} ${colour.hoverBg} ${colour.border}`;
                    if (correctAnswer !== null) {
                        if (isCorrect) stateClass = 'bg-green-600 border-green-400';
                        else if (isWrong) stateClass = 'bg-red-900/60 border-red-700 opacity-70';
                        else stateClass = 'bg-[#2e3856] border-[#586380] opacity-40';
                    }

                    return (
                        <button
                            key={i}
                            id={`answer-option-${i}`}
                            onClick={() => handleAnswer(i)}
                            disabled={isAnswered}
                            className={`relative w-full rounded-2xl border-2 p-6 text-left font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed ${stateClass} ${isSelected && !correctAnswer ? 'ring-4 ring-white/30 scale-[0.98]' : ''
                                }`}
                        >
                            <span className="leading-relaxed">{opt}</span>
                            {correctAnswer !== null && isCorrect && (
                                <CheckCircle className="absolute top-4 right-4 w-6 h-6 text-green-300" />
                            )}
                            {correctAnswer !== null && isWrong && (
                                <XCircle className="absolute top-4 right-4 w-6 h-6 text-red-400" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Submitted state */}
            {isAnswered && !correctAnswer && (
                <div className="p-4 text-center">
                    <p className="text-zinc-500 text-sm">Answer locked in ✓ Waiting for results…</p>
                </div>
            )}
        </div>
    );
}
