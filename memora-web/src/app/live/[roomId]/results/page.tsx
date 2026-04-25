'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Target, Home, RotateCcw } from 'lucide-react';

const TEAM_EMOJIS: Record<string, string> = {
    Tiger: '🐯', Falcon: '🦅', Shark: '🦈', Panda: '🐼', Dragon: '🐉', Phoenix: '🦄',
};
const TEAM_BG: Record<string, string> = {
    Tiger: 'bg-orange-600', Falcon: 'bg-blue-600', Shark: 'bg-cyan-600',
    Panda: 'bg-zinc-100', Dragon: 'bg-red-600', Phoenix: 'bg-[#4255ff]',
};
const TEAM_TEXT: Record<string, string> = {
    Panda: 'text-zinc-900',
};

interface TeamScore { team: string; score: number; }
interface MissedTerm { term: string; errorCount: number; totalAnswers: number; }

interface ResultsPageProps {
    params: Promise<{ roomId: string }>;
}

// Podium heights: 1st tallest, 2nd medium, 3rd shorter
const PODIUM_HEIGHTS = ['h-44', 'h-32', 'h-24'];
const PODIUM_LABELS = ['🥇 1st', '🥈 2nd', '🥉 3rd'];

export default function ResultsPage({ params }: ResultsPageProps) {
    const router = useRouter();

    const [roomId, setRoomId] = useState<string | null>(null);
    const [scores] = useState<TeamScore[]>(() => {
        const scoresParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('scores') : null;
        if (scoresParam) { try { return JSON.parse(decodeURIComponent(scoresParam)); } catch { /* ignore */ } }
        return [];
    });
    const [missed] = useState<MissedTerm[]>(() => {
        const missedParam = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('missed') : null;
        if (missedParam) { try { return JSON.parse(decodeURIComponent(missedParam)); } catch { /* ignore */ } }
        return [];
    });
    const [isAnimated, setIsAnimated] = useState(false);

    useEffect(() => { params.then(p => setRoomId(p.roomId)); }, [params]);

    // Animate podium after roomId is known
    useEffect(() => {
        if (!roomId) return;
        setTimeout(() => setIsAnimated(true), 100);
    }, [roomId]);

    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const podiumOrder = [sorted[1], sorted[0], sorted[2]].filter(Boolean); // 2nd, 1st, 3rd visual layout

    return (
        <div className="min-h-screen bg-qz-bg text-qz-text flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-qz-border-light">
                <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <span className="font-bold text-sm">Game Over</span>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/dashboard/teacher')}
                        className="flex items-center gap-1.5 text-xs text-qz-text-muted hover:text-qz-text px-3 py-1.5 rounded-lg border border-qz-border hover:border-zinc-500 transition-colors"
                    >
                        <Home className="w-3.5 h-3.5" /> Dashboard
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-1.5 text-xs text-[#ffcd1f] hover:text-indigo-300 px-3 py-1.5 rounded-lg border border-indigo-500/30 hover:border-indigo-500/60 transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Play Again
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center gap-12 p-6 md:p-10">

                {/* Podium */}
                {sorted.length > 0 ? (
                    <section className="w-full max-w-2xl">
                        <h2 className="text-center text-xs uppercase tracking-widest text-zinc-500 mb-8 font-bold">Team Rankings</h2>
                        <div className="flex items-end justify-center gap-4">
                            {podiumOrder.map((team, displayIdx) => {
                                if (!team) return null;
                                const actualRank = sorted.indexOf(team);
                                const bg = TEAM_BG[team.team] ?? 'bg-[#4255ff]';
                                const textColor = TEAM_TEXT[team.team] ?? 'text-qz-text';
                                const podiumH = PODIUM_HEIGHTS[actualRank] ?? 'h-20';
                                const label = PODIUM_LABELS[actualRank] ?? '';

                                return (
                                    <div
                                        key={team.team}
                                        className={`flex flex-col items-center gap-2 transition-all duration-700 ease-out ${isAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                                            }`}
                                        style={{ transitionDelay: `${displayIdx * 150}ms` }}
                                    >
                                        <span className="text-4xl">{TEAM_EMOJIS[team.team] ?? '🏆'}</span>
                                        <span className={`text-sm font-bold ${actualRank === 0 ? 'text-yellow-400' : 'text-qz-text-muted'}`}>
                                            {team.team}
                                        </span>
                                        <span className="text-xs text-zinc-500 tabular-nums">{team.score} pts</span>
                                        <div className={`w-24 ${podiumH} ${bg} rounded-t-xl flex items-end justify-center pb-3 ${textColor} font-bold text-sm shadow-xl`}>
                                            {label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ) : (
                    <div className="text-zinc-600 text-sm text-center mt-8">
                        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        Game results will appear here
                    </div>
                )}

                {/* Top missed terms */}
                {missed.length > 0 && (
                    <section className="w-full max-w-lg">
                        <div className="flex items-center gap-2 mb-5">
                            <Target className="w-4 h-4 text-red-400" />
                            <h2 className="text-sm font-bold uppercase tracking-widest text-qz-text-muted">Top Missed Terms</h2>
                        </div>
                        <div className="flex flex-col gap-3">
                            {missed.slice(0, 3).map((item) => {
                                const errorPct = item.totalAnswers > 0
                                    ? Math.round((item.errorCount / item.totalAnswers) * 100)
                                    : 0;
                                return (
                                    <div key={item.term} className="bg-qz-bg border border-qz-border-light rounded-2xl p-4">
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <p className="font-semibold text-qz-text leading-snug">{item.term}</p>
                                            <span className="text-red-400 text-sm font-bold tabular-nums shrink-0">{errorPct}% wrong</span>
                                        </div>
                                        <div className="w-full bg-qz-card rounded-full h-2">
                                            <div
                                                className="h-2 bg-red-500 rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: isAnimated ? `${errorPct}%` : '0%' }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
