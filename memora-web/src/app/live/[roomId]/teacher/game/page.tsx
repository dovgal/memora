'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Trophy, ChevronRight, Clock, Users } from 'lucide-react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

interface TeamScore {
    team: string;
    score: number;
}

interface Question {
    index: number;
    total: number;
    term: string;
    options: string[];
}

interface TeacherGamePageProps {
    params: Promise<{ roomId: string }>;
}

const TEAM_EMOJIS: Record<string, string> = {
    Tiger: '🐯', Falcon: '🦅', Shark: '🦈', Panda: '🐼', Dragon: '🐉', Phoenix: '🦄',
};
const TEAM_COLOURS: Record<string, string> = {
    Tiger: 'bg-orange-500', Falcon: 'bg-blue-500', Shark: 'bg-cyan-500',
    Panda: 'bg-zinc-200', Dragon: 'bg-red-500', Phoenix: 'bg-purple-500',
};

export default function TeacherGamePage({ params }: TeacherGamePageProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session } = useSession();

    const [roomId, setRoomId] = useState<string | null>(null);
    const [question, setQuestion] = useState<Question | null>(null);
    const [scores, setScores] = useState<TeamScore[]>([]);
    const [answer, setAnswer] = useState<string | null>(null); // revealed correct answer
    const [isFinished, setIsFinished] = useState(false);
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
                if (msg.type === 'question') setQuestion(msg as Question);
                if (msg.type === 'reveal_answer') setAnswer(msg.correctAnswer);
                if (msg.type === 'score_update') {
                    setScores(msg.scores);
                    setAnswer(null); // clear for next question
                }
                if (msg.type === 'game_over') {
                    setIsFinished(true);
                    router.push(`/live/${roomId}/results`);
                }
            } catch { /* ignore */ }
        };
    }, [roomId, session, router]);

    useEffect(() => { const c = connectWs(); return c; }, [connectWs]);

    const sendNext = () => {
        wsRef.current?.send(JSON.stringify({ type: 'next_question' }));
    };

    const sendEndGame = () => {
        wsRef.current?.send(JSON.stringify({ type: 'end_game' }));
    };

    const maxScore = Math.max(...scores.map(s => s.score), 1);

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-900/60">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    Live Game
                </div>
                {question && (
                    <span className="text-zinc-500 text-sm tabular-nums">
                        Question {question.index} / {question.total}
                    </span>
                )}
                <button onClick={sendEndGame} className="text-xs text-zinc-600 hover:text-red-400 transition-colors">
                    End Game
                </button>
            </header>

            <main className="flex-1 flex flex-col lg:flex-row gap-0">
                {/* Left: Question */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
                    {question ? (
                        <>
                            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 w-full max-w-2xl text-center shadow-2xl">
                                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Term</p>
                                <p className="text-4xl font-bold leading-tight">{question.term}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
                                {question.options.map((opt, i) => {
                                    const isCorrect = answer === opt;
                                    return (
                                        <div
                                            key={i}
                                            className={`p-5 rounded-2xl border-2 text-sm font-medium transition-all duration-500 ${answer
                                                    ? isCorrect
                                                        ? 'bg-green-950/50 border-green-500 text-green-300'
                                                        : 'bg-zinc-950 border-zinc-800 text-zinc-600 opacity-50'
                                                    : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                                }`}
                                        >
                                            {opt}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex gap-4">
                                {answer ? (
                                    <button
                                        id="teacher-next-btn"
                                        onClick={sendNext}
                                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-3 rounded-xl transition-all"
                                    >
                                        Next Question <ChevronRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 text-zinc-500 text-sm">
                                        <Clock className="w-4 h-4 animate-spin" />
                                        Waiting for answers…
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-zinc-500 flex flex-col items-center gap-3">
                            <Users className="w-8 h-8" />
                            <p className="text-sm">Waiting for game to start…</p>
                        </div>
                    )}
                </div>

                {/* Right: Leaderboard */}
                {scores.length > 0 && (
                    <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-zinc-900/40 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2 text-sm font-bold text-zinc-400 uppercase tracking-widest">
                            <Trophy className="w-4 h-4 text-yellow-400" /> Leaderboard
                        </div>
                        <div className="flex flex-col gap-3">
                            {[...scores].sort((a, b) => b.score - a.score).map((s, i) => (
                                <div key={s.team} className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="flex items-center gap-2 font-medium">
                                            <span>{TEAM_EMOJIS[s.team] ?? '🏆'}</span>
                                            {s.team}
                                            {i === 0 && <span className="text-yellow-400 text-xs">👑</span>}
                                        </span>
                                        <span className="font-bold tabular-nums text-zinc-300">{s.score}</span>
                                    </div>
                                    <div className="w-full bg-zinc-800 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-700 ${TEAM_COLOURS[s.team] ?? 'bg-indigo-500'}`}
                                            style={{ width: `${(s.score / maxScore) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
